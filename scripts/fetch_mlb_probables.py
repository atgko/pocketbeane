#!/usr/bin/env python3
"""MLB probable-starting-pitcher fetch — FanGraphs RosterResource Probables
Grid (fangraphs.com/roster-resource/probables-grid), which aggregates
RotoWire's probable pitcher data.

Replaces the team-games-per-week proxy the Pitching Starts panel used as a
stand-in for pitcher-level data (see BACKLOG Y-05c). The proxy stays in
place as an explicit fallback — src/utils/schedule.js and mlb_schedule.json
are untouched by this script and keep being refreshed by
fetch_mlb_schedule.py, for whenever probables data is missing, stale, or
doesn't cover the requested week yet.

The page is a Next.js app; rather than parse the rendered HTML table, this
reads the same data the table is built from — a React Query cache dehydrated
into a `<script id="__NEXT_DATA__">` JSON blob server-side. Confirmed via a
live fetch (2026-08-06): `props.pageProps.dehydratedState.queries[].state.data.games`
is a flat list of {team, date} rows, each carrying that team's probable
starter (`team.sp`) and the opponent's (`opponent.sp`). No JS rendering
needed — this is the actual API response the page hydrates from, already
serialized into the static HTML.

Usage:
  python scripts/fetch_mlb_probables.py

Requires `truststore` (pip install truststore) on machines where the
bundled OpenSSL trust store rejects real-world CA chains — same fix already
applied in fetch_mlb_schedule.py / scrape_mlb.py / run_weekly.py.
"""

import json
import os
import re
import sys
import unicodedata
from datetime import date, datetime, timedelta, timezone
from urllib.error import URLError
from urllib.request import Request, urlopen

try:
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    pass  # fall back to default verification; fine on machines without the quirk above

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PLAYERS_FILE = os.path.join(REPO_ROOT, 'src', 'data', 'mlb_players.json')
PROBABLES_FILE = os.path.join(REPO_ROOT, 'src', 'data', 'mlb_probables.json')

PROBABLES_URL = 'https://www.fangraphs.com/roster-resource/probables-grid'

# FanGraphs' abbName -> PocketBeane's mlb_players.json team code. Every other
# team's FanGraphs abbreviation already matches players.json. Confirmed by
# diffing the live page's 30 team codes against mlb_players.json's "team"
# values (2026-08-06).
ABBR_OVERRIDES = {
    'KCR': 'KC',
    'SDP': 'SD',
    'TBR': 'TB',
    'SFG': 'SF',
    'WSN': 'WSH',
    'CHW': 'CWS',
}

# A live pull covers ~30 teams x ~10 days minus off-days — observed 298 rows
# on 2026-08-06. Anything far below that means the page's data shape changed
# or the response came back short/empty — don't silently overwrite a good
# file with a bad one (same defensive-threshold philosophy as
# fetch_mlb_schedule.py's MIN_GAMES_THRESHOLD).
MIN_ROWS_THRESHOLD = 100

# Probables are provisional by nature (rotations shuffle, rainouts, injuries)
# and the brief calls for flagging — not trusting — data older than this.
STALE_AFTER = timedelta(hours=48)


# ---------------------------------------------------------------------------
# Name normalization — identical convention to scrape_mlb.py's normalize_name,
# which is how mlb_players.json's `id` field itself is built. Matching against
# `id` directly (rather than a separate stored name field) is the most
# reliable option available today since no FanGraphs cross-reference id is
# stored on players.json yet.
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


def fetch_page_html():
    req = Request(PROBABLES_URL, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; PocketBeane/1.0)',
        'Accept': 'text/html',
    })
    with urlopen(req, timeout=30) as resp:
        return resp.read().decode('utf-8')


def extract_next_data(html: str) -> dict:
    match = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        html, re.S,
    )
    if not match:
        raise ValueError('__NEXT_DATA__ script tag not found — page structure changed')
    return json.loads(match.group(1))


def find_probables_query(next_data: dict) -> dict:
    """Locate the react-query cache entry for the probables grid. Matched by
    queryKey substring rather than a fixed list index, so an unrelated query
    being added/reordered on the page doesn't silently point this at the
    wrong data."""
    queries = next_data.get('props', {}).get('pageProps', {}).get('dehydratedState', {}).get('queries', [])
    for q in queries:
        key = q.get('queryKey', [])
        if any('probables-grid' in str(k) for k in key):
            return q
    raise ValueError('No probables-grid query found in __NEXT_DATA__ — page structure changed')


def extract_updated_label(html: str) -> str | None:
    """Best-effort human-readable freshness label from the page footer, for
    the log/output only — the authoritative freshness check uses the query's
    own dataUpdatedAt timestamp below. Next.js SSR splits the text node
    around React hydration markers (`<!-- -->`), so this captures up to the
    closing tag and strips those markers out rather than matching contiguous
    text."""
    match = re.search(r'Updated:\s*(.*?)</span>', html, re.S)
    if not match:
        return None
    label = match.group(1).replace('<!-- -->', '').strip()
    return label or None


def build_pitcher_id_map(players: list) -> dict:
    """{normalized_hyphenated_name: player_id} for every pitcher (including
    two-way players who carry pitcher stats). players.json ids are already
    built with this exact normalization, so a direct dict lookup is the
    match — no fuzzy comparison needed."""
    id_map = {}
    for p in players:
        if p.get('player_type') == 'pitcher':
            id_map[normalize_name(p['name'])] = p['id']
    return id_map


def parse_starts(games: list, id_map: dict):
    starts = []
    skipped_rows = 0
    unmatched_names = set()

    for row in games:
        game_date = row.get('gameDate')
        team_raw = row.get('abbName')
        opponent_raw = row.get('opponent', {}).get('abbName')
        sp = row.get('team', {}).get('sp')
        is_home = row.get('isHome')

        if not game_date or not team_raw or not opponent_raw or not sp or not sp.get('name') or is_home is None:
            skipped_rows += 1
            continue

        pitcher_name = sp['name']
        norm = normalize_name(pitcher_name)
        pitcher_id = id_map.get(norm)
        if pitcher_id is None:
            unmatched_names.add(pitcher_name)

        starts.append({
            'date': game_date,
            'team': ABBR_OVERRIDES.get(team_raw, team_raw),
            'opponent': ABBR_OVERRIDES.get(opponent_raw, opponent_raw),
            'home': bool(is_home),
            'pitcher_id': pitcher_id,
            'pitcher_name': pitcher_name,
            'pitcher_fangraphs_id': sp.get('playerId'),
            'throws': sp.get('throws'),
        })

    return starts, skipped_rows, sorted(unmatched_names)


def main():
    print(f'Fetching probables grid from {PROBABLES_URL} ...')
    try:
        html = fetch_page_html()
    except (URLError, TimeoutError) as exc:
        print(f'ERROR: probables grid request failed: {exc}')
        return 1

    try:
        next_data = extract_next_data(html)
        query = find_probables_query(next_data)
        games = query['state']['data']['games']
    except (ValueError, KeyError, TypeError) as exc:
        print(f'ERROR: could not parse probables grid page structure: {exc}')
        print('  Not writing/overwriting an existing file — see BACKLOG Y-05c.')
        return 1

    if not isinstance(games, list) or len(games) < MIN_ROWS_THRESHOLD:
        got = len(games) if isinstance(games, list) else 'non-list'
        print(f'ERROR: only {got} rows parsed, below safety threshold {MIN_ROWS_THRESHOLD}. '
              f'Not overwriting {PROBABLES_FILE}.')
        return 1

    data_updated_at_ms = query['state'].get('dataUpdatedAt')
    updated_at = (
        datetime.fromtimestamp(data_updated_at_ms / 1000, tz=timezone.utc)
        if data_updated_at_ms else None
    )
    updated_at_label = extract_updated_label(html)
    stale = updated_at is not None and (datetime.now(timezone.utc) - updated_at) > STALE_AFTER
    if updated_at is None:
        print('WARNING: no dataUpdatedAt timestamp found — cannot verify data freshness.')
    elif stale:
        print(f'WARNING: probables data is stale — last updated {updated_at.isoformat()} '
              f'({updated_at_label or "no label"}), more than {STALE_AFTER} ago. '
              'Writing anyway with stale=true; consumers should treat this cautiously.')
    else:
        print(f'Data freshness OK — last updated {updated_at.isoformat()} ({updated_at_label or "no label"})')

    with open(PLAYERS_FILE, 'r', encoding='utf-8') as f:
        players = json.load(f)
    id_map = build_pitcher_id_map(players)

    starts, skipped_rows, unmatched_names = parse_starts(games, id_map)
    matched_count = sum(1 for s in starts if s['pitcher_id'] is not None)

    print(f'Parsed {len(starts)} probable-start rows ({skipped_rows} skipped — missing/malformed fields)')
    print(f'  Matched to players.json: {matched_count}/{len(starts)}')
    if unmatched_names:
        print(f'  Unmatched pitchers ({len(unmatched_names)}): {", ".join(unmatched_names[:15])}'
              + (' ...' if len(unmatched_names) > 15 else ''))

    dates = sorted({s['date'] for s in starts})
    output = {
        'as_of_date': date.today().isoformat(),
        'sport': 'mlb',
        'source': 'fangraphs_rosterresource_probables_grid',
        'updated_at': updated_at.isoformat() if updated_at else None,
        'updated_at_label': updated_at_label,
        'stale': stale,
        'date_range': {'start': dates[0], 'end': dates[-1]} if dates else None,
        'starts': starts,
        'players_matched': matched_count,
        'players_unmatched': len(unmatched_names),
        'unmatched_pitchers': unmatched_names,
    }

    with open(PROBABLES_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        f.write('\n')

    print(f'Wrote {PROBABLES_FILE}')
    if dates:
        print(f'  date range: {dates[0]} to {dates[-1]}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
