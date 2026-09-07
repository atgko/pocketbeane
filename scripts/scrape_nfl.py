#!/usr/bin/env python3
"""NFL scraper — pulls live season stats from Sleeper's public stats API
(api.sleeper.app, no auth required) and ESPN injury data, produces
PocketBeane-compatible current-season JSON for the merge step.

Scope: QB/RB/WR/TE only. K/DEF have no stat source in build-nfl-players.js's
prior_season either (PFR's tables don't cover them) — weekly current_season
stays scoped the same way rather than introducing a schema PocketBeane
doesn't validate yet.

Sleeper's `pts_half_ppr` field was verified live (2026-09-07) to exactly
match the league's real half-PPR scoring weights already coded in
build-nfl-players.js's SCORING constant (0.04/pass_yd, 4/pass_td, -1/int,
0.1/rush_yd or rec_yd, 6/TD, 0.5/rec) — checked by hand against real 2025
QB and WR rows. fantasy_ppg is derived from that field directly instead of
re-summing raw stats, so it can't drift from the prior_season formula.

Usage:
  python scripts/scrape_nfl.py
  python scripts/scrape_nfl.py --date=2026-09-14
  python scripts/scrape_nfl.py --season=2026
"""

import json
import os
import re
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
    pass  # fall back to default verification; fine on machines without the quirk noted in scrape_mlb.py

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATA_DIR = os.path.join(REPO_ROOT, 'src', 'data')
UPDATES_DIR = os.path.join(REPO_ROOT, 'data-updates')
PLAYERS_FILE = os.path.join(DATA_DIR, 'nfl_players.json')

# Undocumented but public and stable — no auth, no per-IP rate limit issue at
# one call/week (unlike /v1/players/nfl, which Sleeper's own docs say to
# cache; this endpoint is small and safe to call directly).
STATS_API = 'https://api.sleeper.app/stats/nfl/{season}'
ESPN_INJURIES_API = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries'

SUPPORTED_POSITIONS = {'QB', 'RB', 'WR', 'TE'}


# ---------------------------------------------------------------------------
# Name normalization — ports build-nfl-players.js's normalizeName/slugify
# byte-for-byte so lookups line up with src/data/nfl_players.json ids without
# re-deriving them (ids there are already slugify(name) — see that file).
# ---------------------------------------------------------------------------
def normalize_name(raw: str) -> str:
    name = str(raw)
    name = unicodedata.normalize('NFD', name)
    name = ''.join(c for c in name if not unicodedata.combining(c))
    name = name.replace('?', '')
    name = name.lower()
    name = name.replace('.', '')
    name = re.sub(r'\b(jr|sr|ii|iii|iv)\b', '', name)
    name = re.sub(r"[^a-z\s'-]", '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def slugify(raw: str) -> str:
    name = normalize_name(raw)
    name = re.sub(r"['\s]+", '-', name)
    name = re.sub(r'-+', '-', name)
    return name.strip('-')


# ---------------------------------------------------------------------------
# ESPN injury fetch — same endpoint family/shape as scrape_mlb.py, sport
# segment swapped to football/nfl.
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
    s = status.strip()
    t = type_name.strip()
    if 'IL' in s or 'IL' in t or 'IR' in s or 'IR' in t:
        return 'il'
    if 'Day-To-Day' in s or 'DAYTODAY' in t or 'Questionable' in s:
        return 'day-to-day'
    if s == 'Out' or 'OUT' in t:
        return 'out'
    if any(k in (s, t) for k in ('Suspension', 'SUSPENSION')):
        return 'out'
    return 'out'


def build_injury_map(espn_data) -> dict:
    if not espn_data or 'injuries' not in espn_data:
        return {}
    injury_map = {}
    for team in espn_data['injuries']:
        for entry in team.get('injuries', []):
            athlete = entry.get('athlete', {})
            raw_name = athlete.get('displayName', '')
            if not raw_name:
                continue
            norm = slugify(raw_name)
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
# Sleeper season-cumulative stats fetch — one call, no pagination. Returns a
# list of {stats, player, ...} rows, one per player, `week: null` meaning
# season-to-date totals (verified live against both 2025 and pre-season 2026).
# ---------------------------------------------------------------------------
def fetch_season_stats(season: int) -> list:
    params = {'season_type': 'regular'}
    url = f'{STATS_API.format(season=season)}?{urlencode(params)}'
    req = Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; PocketBeane/1.0)',
        'Accept': 'application/json',
    })
    with urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode('utf-8'))


def parse_float(val):
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def stat_num(stats: dict, key: str) -> float:
    """Sleeper omits stat keys entirely when a player recorded a zero for
    them (e.g. a WR with no carries has no 'rush_yd' key at all) rather than
    writing 0 — default to 0.0 so required numeric fields always validate."""
    val = parse_float(stats.get(key))
    return val if val is not None else 0.0


def build_sleeper_map(records: list) -> dict:
    """{normalized_slug: stats_dict}. First occurrence wins — a collision
    would mean two real players share a normalized name, the same edge case
    scrape_mlb.py accepts silently."""
    out = {}
    for rec in records:
        player = rec.get('player') or {}
        stats = rec.get('stats') or {}
        full_name = f"{player.get('first_name', '')} {player.get('last_name', '')}".strip()
        if not full_name:
            continue
        norm = slugify(full_name)
        if norm in out:
            continue
        out[norm] = stats
    return out


def build_stat_record(position_type: str, stats: dict) -> dict:
    gp = int(round(stat_num(stats, 'gp')))
    pts_half_ppr = stat_num(stats, 'pts_half_ppr')
    fantasy_ppg = round(pts_half_ppr / gp, 2) if gp > 0 else None

    record = {
        'position_type': position_type,
        'gp': gp,
        'fantasy_ppg': fantasy_ppg,
    }
    if position_type == 'QB':
        record['pass_yd'] = int(round(stat_num(stats, 'pass_yd')))
        record['pass_td'] = int(round(stat_num(stats, 'pass_td')))
        record['int'] = int(round(stat_num(stats, 'pass_int')))
        record['rush_yd'] = int(round(stat_num(stats, 'rush_yd')))
        record['rush_td'] = int(round(stat_num(stats, 'rush_td')))
    else:
        record['rush_yd'] = int(round(stat_num(stats, 'rush_yd')))
        record['rush_td'] = int(round(stat_num(stats, 'rush_td')))
        record['rec'] = int(round(stat_num(stats, 'rec')))
        record['rec_yd'] = int(round(stat_num(stats, 'rec_yd')))
        record['rec_td'] = int(round(stat_num(stats, 'rec_td')))
    return record


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

    print(f'Fetching NFL {season} season stats from {STATS_API.format(season=season)} ...')
    try:
        records = fetch_season_stats(season)
    except (URLError, TimeoutError) as exc:
        print(f'ERROR: Sleeper stats API request failed: {exc}')
        return 1

    print(f'Fetched {len(records)} player-season rows from Sleeper')
    sleeper_by_name = build_sleeper_map(records)

    espn_data = fetch_espn_injuries()
    injury_map = build_injury_map(espn_data)
    injury_available = bool(injury_map)
    print(f'Fetched ESPN injuries: {"OK" if injury_available else "FAILED — all players will have injury_status=null"} ({len(injury_map)} injured players found)')

    with open(PLAYERS_FILE, 'r', encoding='utf-8') as f:
        players = json.load(f)

    by_id = {p['id']: p for p in players}

    out_players = []
    skipped = []

    for pid, pdata in by_id.items():
        positions = pdata.get('positions') or []
        position_type = positions[0] if positions else None

        if position_type not in SUPPORTED_POSITIONS:
            continue  # K/DEF (or unknown) — no stat source, see module docstring

        norm = pid  # ids are already slugify(name) — see build-nfl-players.js
        stats = sleeper_by_name.get(norm)
        if not stats or stat_num(stats, 'gp') <= 0:
            skipped.append({'id': pid, 'name': pdata['name'], 'reason': 'no_games_played'})
            continue

        record = build_stat_record(position_type, stats)
        record['as_of_date'] = as_of

        if injury_available:
            inj = injury_map.get(norm)
            if inj:
                record['injury_status'] = inj['status']
                record['injury_note'] = inj['note']
            else:
                record['injury_status'] = 'healthy'
                record['injury_note'] = None
        else:
            record['injury_status'] = None
            record['injury_note'] = None

        out_players.append({'id': pid, 'name': pdata['name'], 'current_season': record})

    output = {
        'as_of_date': as_of,
        'sport': 'nfl',
        'season': str(season),
        'source': 'hermes_weekly_pull',
        'players_updated': len(out_players),
        'players_skipped': len(skipped),
        'players': out_players,
        'skipped': skipped,
    }

    os.makedirs(UPDATES_DIR, exist_ok=True)
    out_path = os.path.join(UPDATES_DIR, f'nfl-current-season-{as_of}.json')
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
