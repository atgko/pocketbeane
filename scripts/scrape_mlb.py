#!/usr/bin/env python3
"""MLB scraper — reads pre-downloaded Baseball Reference HTML files and ESPN
injury API, produces PocketBeane-compatible current-season JSON for the merge step.

Usage:
  python scripts/scrape_mlb.py
  python scripts/scrape_mlb.py --date 2026-07-07
"""

import json
import re
import os
import sys
import unicodedata
from datetime import date
from urllib.error import URLError
from urllib.request import Request, urlopen

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATA_DIR = os.path.join(REPO_ROOT, 'src', 'data')
UPDATES_DIR = os.path.join(REPO_ROOT, 'data-updates')
BATTING_FILE = os.path.join(os.path.dirname(__file__), 'bbref-batting.html')
PITCHING_FILE = os.path.join(os.path.dirname(__file__), 'bbref-pitching.html')
PLAYERS_FILE = os.path.join(DATA_DIR, 'mlb_players.json')

ESPN_INJURIES_API = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/injuries'

# ---------------------------------------------------------------------------
# Name normalization — matches build-players/build-mlb-players convention
# ---------------------------------------------------------------------------
def normalize_name(raw: str) -> str:
    name = str(raw)
    name = re.sub(r'[*#]', '', name).strip()
    name = unicodedata.normalize('NFD', name)
    name = ''.join(c for c in name if not unicodedata.combining(c))
    name = name.lower()
    name = name.replace('.', '')
    name = name.replace("'", '')
    name = name.replace(',', '')
    name = re.sub(r'\b(jr|sr|ii|iii|iv)\b', '', name)
    name = re.sub(r'[^a-z\s-]', '', name)
    name = re.sub(r'\s+', '-', name.strip())
    return name


# ---------------------------------------------------------------------------
# ESPN injury fetch
# ---------------------------------------------------------------------------
def fetch_espn_injuries():
    req = Request(ESPN_INJURIES_API, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; PocketBeane/1.0)',
        'Accept': 'application/json',
    })
    try:
        with urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as exc:
        print(f'WARNING: ESPN injuries API failed: {exc}')
        return None


def map_injury_status(status: str, type_name: str) -> str:
    """Map ESPN raw status/type name to PocketBeane injury_status value."""
    s = status.strip()
    t = type_name.strip()

    # Any IL designation
    if 'IL' in s or 'IL' in t:
        return 'il'
    # Explicit day-to-day
    if 'Day-To-Day' in s or 'DAYTODAY' in t:
        return 'day-to-day'
    # Out
    if s == 'Out' or 'OUT' in t:
        return 'out'
    # Paternity, bereavement, suspension — player is unavailable
    if any(k in (s, t) for k in ('Paternity', 'PATERNITY', 'Bereavement', 'BEREAVEMENT', 'Suspension', 'SUSPENSION')):
        return 'out'
    return 'out'


def build_injury_map(espn_data) -> dict:
    """Return {normalized_name: {'status': ..., 'note': ...}} from ESPN JSON."""
    if not espn_data or 'injuries' not in espn_data:
        return {}

    injury_map = {}
    for team in espn_data['injuries']:
        for entry in team.get('injuries', []):
            athlete = entry.get('athlete', {})
            raw_name = athlete.get('displayName', '')
            if not raw_name:
                continue
            norm = normalize_name(raw_name)
            status = entry.get('status', 'Out')
            type_info = entry.get('type', {})
            type_name = type_info.get('name', '') if isinstance(type_info, dict) else str(type_info)
            long_comment = entry.get('longComment', '') or ''

            injury_map[norm] = {
                'status': map_injury_status(status, type_name),
                'note': long_comment[:100].strip(),
            }
    return injury_map


# ---------------------------------------------------------------------------
# HTML table parser (unchanged from prior T1-2)
# ---------------------------------------------------------------------------
def parse_table(html_path: str) -> list:
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()
    m = re.search(r'<table[^>]+id="players_standard_(batting|pitching)"[^>]*>(.*?)</table>', html, re.DOTALL)
    if not m:
        raise SystemExit(f'Could not find stats table in {html_path}')
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', m.group(2), re.DOTALL)
    headers = re.findall(r'data-stat="([^"]+)"', rows[0])
    players = []
    seen = set()
    for row in rows[1:]:
        cells = re.findall(r'<(?:th|td)[^>]*>(.*?)</(?:th|td)>', row, re.DOTALL)
        if len(cells) < len(headers):
            continue
        entry = {}
        for i, h in enumerate(headers):
            val = re.sub(r'<[^>]+>', '', cells[i]).strip()
            if val == '':
                val = None
            entry[h] = val
        raw_name = entry.get('name_display')
        if not raw_name:
            continue
        norm = normalize_name(raw_name)
        if norm in seen:
            continue
        seen.add(norm)
        players.append({'raw_name': raw_name, 'norm_name': norm, 'data': entry})
    return players


def parse_float(val: str):
    if val is None:
        return None
    try:
        return float(val)
    except ValueError:
        return None


def parse_int(val: str):
    if val is None:
        return None
    try:
        return int(val)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Build hitter / pitcher records
# ---------------------------------------------------------------------------
def build_hitter(e: dict) -> dict:
    return {
        'position_type': 'hitter',
        'avg': parse_float(e.get('b_batting_avg')),
        'obp': parse_float(e.get('b_onbase_perc')),
        'slg': parse_float(e.get('b_slugging_perc')),
        'ops': parse_float(e.get('b_onbase_plus_slugging')),
        'hr': parse_int(e.get('b_hr')),
        'rbi': parse_int(e.get('b_rbi')),
        'r': parse_int(e.get('b_r')),
        'sb': parse_int(e.get('b_sb')),
        'bb': parse_int(e.get('b_bb')),
        'so': parse_int(e.get('b_so')),
        'pa': parse_int(e.get('b_pa')),
        'g': parse_int(e.get('b_games')),
        'trend': None,
        'injury_status': None,
        'injury_note': None,
        'source': 'hermes_weekly_pull',
        'note': None,
    }


def build_pitcher(e: dict) -> dict:
    return {
        'position_type': 'pitcher',
        'w': parse_int(e.get('p_w')),
        'l': parse_int(e.get('p_l')),
        'sv': parse_int(e.get('p_sv')),
        'era': parse_float(e.get('p_earned_run_avg')),
        'whip': parse_float(e.get('p_whip')),
        'so': parse_int(e.get('p_so')),
        'ip': parse_float(e.get('p_ip')),
        'bb': parse_int(e.get('p_bb')),
        'g': parse_int(e.get('p_g')),
        'gs': parse_int(e.get('p_gs')),
        'trend': None,
        'injury_status': None,
        'injury_note': None,
        'source': 'hermes_weekly_pull',
        'note': None,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    as_of = date.today().isoformat()
    arg_date = None
    for a in sys.argv[1:]:
        if a.startswith('--date='):
            arg_date = a.split('=', 1)[1]
    if arg_date:
        as_of = arg_date

    if not os.path.exists(BATTING_FILE) or not os.path.exists(PITCHING_FILE):
        raise SystemExit('Missing bbref-batting.html or bbref-pitching.html. Download them from Baseball Reference first.')

    batters = parse_table(BATTING_FILE)
    pitchers = parse_table(PITCHING_FILE)
    print(f'Parsed {len(batters)} batters, {len(pitchers)} pitchers')

    # Fetch ESPN injuries
    espn_data = fetch_espn_injuries()
    injury_map = build_injury_map(espn_data)
    injury_available = bool(injury_map)
    print(f'Fetched ESPN injuries: {"OK" if injury_available else "FAILED — all players will have injury_status=null"} ({len(injury_map)} injured players found)')

    with open(PLAYERS_FILE, 'r', encoding='utf-8') as f:
        players = json.load(f)

    by_id = {p['id']: p for p in players}

    out_players = []
    skipped = []
    threshold = 20

    # Position detection: pitcher if GS>5 or SV>0; else hitter
    pitcher_norms = set()
    for row in pitchers:
        gs = parse_int(row['data'].get('p_gs')) or 0
        sv = parse_int(row['data'].get('p_sv')) or 0
        if gs > 5 or sv > 0:
            pitcher_norms.add(row['norm_name'])

    two_way_norms = set()
    for row in batters:
        pa = parse_int(row['data'].get('b_pa')) or 0
        if row['norm_name'] in pitcher_norms and pa > 20:
            two_way_norms.add(row['norm_name'])

    bat_by_name = {r['norm_name']: r['data'] for r in batters}
    pit_by_name = {r['norm_name']: r['data'] for r in pitchers}

    for pid, pdata in by_id.items():
        norm = pid
        if norm in two_way_norms:
            position_type = 'pitcher'
        elif norm in pitcher_norms or pdata.get('player_type') == 'pitcher':
            position_type = 'pitcher'
        else:
            position_type = 'hitter'

        if position_type == 'hitter' and norm in bat_by_name:
            stats = build_hitter(bat_by_name[norm])
            stats['as_of_date'] = as_of
            if injury_available:
                inj = injury_map.get(norm)
                if inj:
                    stats['injury_status'] = inj['status']
                    stats['injury_note'] = inj['note']
                else:
                    stats['injury_status'] = 'healthy'
                    stats['injury_note'] = None
            else:
                stats['injury_status'] = None
                stats['injury_note'] = None
            record = {'id': pid, 'name': pdata['name'], 'current_season': stats}
            out_players.append(record)
        elif position_type == 'pitcher' and norm in pit_by_name:
            stats = build_pitcher(pit_by_name[norm])
            stats['as_of_date'] = as_of
            if injury_available:
                inj = injury_map.get(norm)
                if inj:
                    stats['injury_status'] = inj['status']
                    stats['injury_note'] = inj['note']
                else:
                    stats['injury_status'] = 'healthy'
                    stats['injury_note'] = None
            else:
                stats['injury_status'] = None
                stats['injury_note'] = None
            record = {'id': pid, 'name': pdata['name'], 'current_season': stats}
            out_players.append(record)
        else:
            skipped.append({
                'id': pid,
                'name': pdata['name'],
                'reason': 'missing_stat_data',
                'position_type': position_type,
                'matched_batter': norm in bat_by_name,
                'matched_pitcher': norm in pit_by_name,
            })

    if len(out_players) < threshold:
        print(f'WARNING: Updated {len(out_players)} players, below threshold {threshold}')

    output = {
        'as_of_date': as_of,
        'sport': 'mlb',
        'season': '2026',
        'source': 'hermes_weekly_pull',
        'players_updated': len(out_players),
        'players_skipped': len(skipped),
        'players': out_players,
        'skipped': skipped,
    }

    os.makedirs(UPDATES_DIR, exist_ok=True)
    out_path = os.path.join(UPDATES_DIR, f'mlb-current-season-{as_of}.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)
        f.write('\n')

    print(f'Wrote {out_path}')
    print(f'  players_updated: {len(out_players)}')
    print(f'  players_skipped: {len(skipped)}')
    if skipped:
        for s in skipped[:10]:
            print(f'    skipped {s["id"]} - {s["reason"]}')
    return output, len(out_players) < threshold


if __name__ == '__main__':
    main()
