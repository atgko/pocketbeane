#!/usr/bin/env python3
"""MLB full-season schedule fetch — replaces the one-week manual_seed_sample
in src/data/mlb_schedule.json with the real regular-season schedule from the
public MLB Stats API (statsapi.mlb.com, no auth required).

Consumed by src/utils/schedule.js for the Start/Sit Advisor's games-this-week
and back-to-back detection (see Y-05, BACKLOG.md).

Usage:
  python scripts/fetch_mlb_schedule.py
  python scripts/fetch_mlb_schedule.py --season 2026

Requires `truststore` (pip install truststore) on machines where the
bundled OpenSSL trust store rejects statsapi.mlb.com's chain with
"Basic Constraints of CA cert not marked critical" — a known OpenSSL 3.x
strictness issue with some real-world CA certs that Windows' own trust
store accepts fine. truststore routes verification through the OS store
instead, mirroring the `--use-system-ca` flag already used for `npm run dev`.
"""

import json
import os
import sys
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
SCHEDULE_FILE = os.path.join(REPO_ROOT, 'src', 'data', 'mlb_schedule.json')

SCHEDULE_API = 'https://statsapi.mlb.com/api/v1/schedule'
TEAMS_API = 'https://statsapi.mlb.com/api/v1/teams'
MLB_SPORT_ID = 1

# Stats API abbreviation -> PocketBeane's mlb_players.json abbreviation.
# Every other team's Stats API abbreviation already matches players.json.
ABBR_OVERRIDES = {'AZ': 'ARI'}

# Real regular season is ~2430 games (30 teams x 162 / 2) plus makeups.
# Anything far below that means the API call came back short/empty —
# don't silently overwrite a good schedule file with a bad one.
MIN_GAMES_THRESHOLD = 2000


def fetch_json(url, params):
    full_url = f'{url}?{urlencode(params)}'
    req = Request(full_url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; PocketBeane/1.0)',
        'Accept': 'application/json',
    })
    with urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode('utf-8'))


def fetch_team_abbr_map():
    data = fetch_json(TEAMS_API, {'sportId': MLB_SPORT_ID})
    abbr_by_id = {}
    for team in data.get('teams', []):
        team_id = team.get('id')
        abbr = team.get('abbreviation')
        if team_id is None or not abbr:
            continue
        abbr_by_id[team_id] = ABBR_OVERRIDES.get(abbr, abbr)
    return abbr_by_id


def fetch_season_games(season):
    data = fetch_json(SCHEDULE_API, {
        'sportId': MLB_SPORT_ID,
        'season': season,
        'gameType': 'R',
    })
    return data.get('dates', [])


def build_games(date_entries, abbr_by_id):
    seen = set()
    games = []
    unmatched_team_ids = set()

    for entry in date_entries:
        for g in entry.get('games', []):
            game_date = g.get('officialDate')
            teams = g.get('teams', {})
            home_id = teams.get('home', {}).get('team', {}).get('id')
            away_id = teams.get('away', {}).get('team', {}).get('id')
            if not game_date or home_id is None or away_id is None:
                continue

            home_abbr = abbr_by_id.get(home_id)
            away_abbr = abbr_by_id.get(away_id)
            if not home_abbr:
                unmatched_team_ids.add(home_id)
            if not away_abbr:
                unmatched_team_ids.add(away_id)
            if not home_abbr or not away_abbr:
                continue

            key = (game_date, home_abbr, away_abbr)
            if key in seen:
                continue
            seen.add(key)
            games.append({'date': game_date, 'home': home_abbr, 'away': away_abbr})

    games.sort(key=lambda g: (g['date'], g['home']))
    return games, unmatched_team_ids


def main():
    season = date.today().year
    for a in sys.argv[1:]:
        if a.startswith('--season='):
            season = int(a.split('=', 1)[1])
        elif a == '--season' and len(sys.argv) > sys.argv.index(a) + 1:
            season = int(sys.argv[sys.argv.index(a) + 1])

    print(f'Fetching MLB {season} regular season schedule from {SCHEDULE_API} ...')
    try:
        abbr_by_id = fetch_team_abbr_map()
        date_entries = fetch_season_games(season)
    except (URLError, TimeoutError) as exc:
        print(f'ERROR: MLB Stats API request failed: {exc}')
        return 1

    games, unmatched_team_ids = build_games(date_entries, abbr_by_id)
    print(f'Parsed {len(games)} unique (date, home, away) games across {len(date_entries)} calendar dates')

    if unmatched_team_ids:
        print(f'WARNING: {len(unmatched_team_ids)} team id(s) had no abbreviation mapping and were dropped: {sorted(unmatched_team_ids)}')

    if len(games) < MIN_GAMES_THRESHOLD:
        print(f'ERROR: only {len(games)} games parsed, below safety threshold {MIN_GAMES_THRESHOLD}. '
              f'Not overwriting {SCHEDULE_FILE}.')
        return 1

    teams_covered = {g['home'] for g in games} | {g['away'] for g in games}
    print(f'Teams covered: {len(teams_covered)}/30')

    output = {
        'season': str(season),
        'sport': 'mlb',
        'source': 'mlb_stats_api',
        'as_of_date': date.today().isoformat(),
        'games': games,
    }

    with open(SCHEDULE_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)
        f.write('\n')

    print(f'Wrote {SCHEDULE_FILE}')
    print(f'  date range: {games[0]["date"]} to {games[-1]["date"]}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
