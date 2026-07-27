#!/usr/bin/env python3
"""MLB scraper — pulls live season stats from the public MLB Stats API
(statsapi.mlb.com, no auth required) and ESPN injury data, produces
PocketBeane-compatible current-season JSON for the merge step.

Replaces the original Baseball Reference HTML scraper (P-02, BACKLOG.md):
that version read pre-downloaded bbref-batting.html/bbref-pitching.html
snapshots that nothing ever re-fetched, so every weekly run just re-stamped
the same July 6 numbers with a fresh as_of_date — real data never moved,
only the (formerly trustworthy) "how fresh is this" label did.

Usage:
  python scripts/scrape_mlb.py
  python scripts/scrape_mlb.py --date 2026-07-07
  python scripts/scrape_mlb.py --season 2026

Requires `truststore` (pip install truststore) on machines where the
bundled OpenSSL trust store rejects statsapi.mlb.com's chain with
"Basic Constraints of CA cert not marked critical" — same fix already
applied in fetch_mlb_schedule.py and run_weekly.py's Yahoo calls.
"""

import json
import re
import os
import sys
import unicodedata
from datetime import date
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

try:
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    pass  # fall back to default verification; fine on machines without the quirk above

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATA_DIR = os.path.join(REPO_ROOT, 'src', 'data')
UPDATES_DIR = os.path.join(REPO_ROOT, 'data-updates')
PLAYERS_FILE = os.path.join(DATA_DIR, 'mlb_players.json')

STATS_API = 'https://statsapi.mlb.com/api/v1/stats'
ESPN_INJURIES_API = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/injuries'
MLB_SPORT_ID = 1
PAGE_LIMIT = 1000

# A real full-season player pool is ~650-750 per group. Anything far below
# that means the API came back short/empty — don't silently feed a broken
# response into the merge step (same defensive-threshold philosophy as
# fetch_mlb_schedule.py's MIN_GAMES_THRESHOLD).
MIN_HITTERS = 300
MIN_PITCHERS = 300


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
# ESPN injury fetch (unchanged — already a live API, not part of P-02)
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
# MLB Stats API fetch
# ---------------------------------------------------------------------------
def fetch_stats_group(group: str, season: int) -> list:
    """Fetch every player's season stat line for `group` ('hitting' or
    'pitching'), paginating if the league's full player pool exceeds one
    page. `playerPool=all` is required — without it the API defaults to a
    qualified-leaders-only subset (~150 players instead of the full ~700)."""
    splits = []
    offset = 0
    while True:
        params = {
            'stats': 'season',
            'group': group,
            'season': season,
            'sportId': MLB_SPORT_ID,
            'limit': PAGE_LIMIT,
            'offset': offset,
            'playerPool': 'all',
        }
        req = Request(f'{STATS_API}?{urlencode(params)}', headers={
            'User-Agent': 'Mozilla/5.0 (compatible; PocketBeane/1.0)',
            'Accept': 'application/json',
        })
        with urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        page = data.get('stats', [{}])[0]
        page_splits = page.get('splits', [])
        splits.extend(page_splits)

        total = page.get('totalSplits', len(splits))
        if len(splits) >= total or not page_splits:
            break
        offset += PAGE_LIMIT

    players = []
    seen = set()
    for split in splits:
        player = split.get('player', {})
        raw_name = player.get('fullName')
        if not raw_name:
            continue
        norm = normalize_name(raw_name)
        if norm in seen:
            continue
        seen.add(norm)
        players.append({'raw_name': raw_name, 'norm_name': norm, 'stat': split.get('stat', {})})
    return players


def parse_float(val):
    if val is None:
        return None
    try:
        return float(val)
    except ValueError:
        return None


def parse_int(val):
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Build hitter / pitcher records — output field names unchanged from the
# Baseball Reference version, so mergeCurrentSeasonData.js/calculateTrend.js
# need no changes downstream.
# ---------------------------------------------------------------------------
def build_hitter(stat: dict) -> dict:
    return {
        'position_type': 'hitter',
        'avg': parse_float(stat.get('avg')),
        'obp': parse_float(stat.get('obp')),
        'slg': parse_float(stat.get('slg')),
        'ops': parse_float(stat.get('ops')),
        'hr': parse_int(stat.get('homeRuns')),
        'rbi': parse_int(stat.get('rbi')),
        'r': parse_int(stat.get('runs')),
        'sb': parse_int(stat.get('stolenBases')),
        'bb': parse_int(stat.get('baseOnBalls')),
        'so': parse_int(stat.get('strikeOuts')),
        'pa': parse_int(stat.get('plateAppearances')),
        'g': parse_int(stat.get('gamesPlayed')),
        'trend': None,
        'injury_status': None,
        'injury_note': None,
        'source': 'hermes_weekly_pull',
        'note': None,
    }


def build_pitcher(stat: dict) -> dict:
    return {
        'position_type': 'pitcher',
        'w': parse_int(stat.get('wins')),
        'l': parse_int(stat.get('losses')),
        'sv': parse_int(stat.get('saves')),
        'era': parse_float(stat.get('era')),
        'whip': parse_float(stat.get('whip')),
        'so': parse_int(stat.get('strikeOuts')),
        'ip': parse_float(stat.get('inningsPitched')),
        'bb': parse_int(stat.get('baseOnBalls')),
        'g': parse_int(stat.get('gamesPitched')),
        'gs': parse_int(stat.get('gamesStarted')),
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
    season = date.today().year
    for a in sys.argv[1:]:
        if a.startswith('--date='):
            as_of = a.split('=', 1)[1]
        elif a.startswith('--season='):
            season = int(a.split('=', 1)[1])

    print(f'Fetching MLB {season} season stats from {STATS_API} ...')
    try:
        batters = fetch_stats_group('hitting', season)
        pitchers = fetch_stats_group('pitching', season)
    except (URLError, TimeoutError) as exc:
        print(f'ERROR: MLB Stats API request failed: {exc}')
        return 1

    print(f'Fetched {len(batters)} batters, {len(pitchers)} pitchers')
    if len(batters) < MIN_HITTERS or len(pitchers) < MIN_PITCHERS:
        print(f'ERROR: only {len(batters)} batters / {len(pitchers)} pitchers returned, '
              f'below safety thresholds ({MIN_HITTERS}/{MIN_PITCHERS}). Not proceeding — '
              'the API likely returned a partial/empty response.')
        return 1

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
        gs = parse_int(row['stat'].get('gamesStarted')) or 0
        sv = parse_int(row['stat'].get('saves')) or 0
        if gs > 5 or sv > 0:
            pitcher_norms.add(row['norm_name'])

    two_way_norms = set()
    for row in batters:
        pa = parse_int(row['stat'].get('plateAppearances')) or 0
        if row['norm_name'] in pitcher_norms and pa > 20:
            two_way_norms.add(row['norm_name'])

    bat_by_name = {r['norm_name']: r['stat'] for r in batters}
    pit_by_name = {r['norm_name']: r['stat'] for r in pitchers}

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
        elif position_type == 'pitcher' and norm in pit_by_name:
            stats = build_pitcher(pit_by_name[norm])
        else:
            skipped.append({
                'id': pid,
                'name': pdata['name'],
                'reason': 'missing_stat_data',
                'position_type': position_type,
                'matched_batter': norm in bat_by_name,
                'matched_pitcher': norm in pit_by_name,
            })
            continue

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
        out_players.append({'id': pid, 'name': pdata['name'], 'current_season': stats})

    if len(out_players) < threshold:
        print(f'WARNING: Updated {len(out_players)} players, below threshold {threshold}')

    output = {
        'as_of_date': as_of,
        'sport': 'mlb',
        'season': str(season),
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
    return 0


if __name__ == '__main__':
    sys.exit(main())
