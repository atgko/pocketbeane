#!/usr/bin/env python3
"""Orchestrator for PocketBeane weekly data pipeline.

Runs through guardrail checks, calls sport-specific scrapers, runs merges,
and sends confirmation emails.
"""

import base64
import json
import os
import re
import smtplib
import ssl
import sys
import subprocess
import time
import urllib.parse
import urllib.request
import urllib.error
from datetime import date, datetime, timedelta, timezone
from email.mime.text import MIMEText
from pathlib import Path

import truststore

REPO_ROOT = Path(__file__).resolve().parent.parent

# Plain urllib + OpenSSL rejects this machine's antivirus HTTPS-scanning root
# cert ("Basic Constraints of CA cert not marked critical") even though it's
# the actual root in the local trust chain. truststore delegates verification
# to the OS (Schannel) instead of OpenSSL's stricter manual chain-building —
# the same trust decision the browser and Node's --use-system-ca already make
# successfully on this machine.
YAHOO_SSL_CONTEXT = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
UPDATES_DIR = REPO_ROOT / 'data-updates'
SCRAPERS = {
    'mlb': REPO_ROOT / 'scripts' / 'scrape_mlb.py',
    'nba': REPO_ROOT / 'scripts' / 'scrape_nba.py',
    'nhl': REPO_ROOT / 'scripts' / 'scrape_nhl.py',
    'nfl': REPO_ROOT / 'scripts' / 'scrape_nfl.py',
}
MERGE_SCRIPT = REPO_ROOT / 'scripts' / 'mergeCurrentSeasonData.js'
SCHEDULE_SCRAPERS = {
    'mlb': REPO_ROOT / 'scripts' / 'fetch_mlb_schedule.py',
}
AUTH_PATH = Path(r'C:\Users\athav\AppData\Local\hermes\auth.json')
# Guards against double-running when both the Hermes cron job and the
# wake-and-run Task Scheduler backstop fire for the same Monday.
RUN_MARKER = REPO_ROOT / 'data-updates' / '.last_run'
NOTIFY_TO = 'athavan.elangko@gmail.com'
THRESHOLDS = {'mlb': 20, 'nba': 50, 'nhl': 30, 'nfl': 30}
MLB_ACTIVE = (4, 10)
NBA_ACTIVE = (10, 4)
NHL_ACTIVE = (10, 4)
NFL_ACTIVE = (9, 2)


def is_month_in_range(month, start, end):
    if start <= end:
        return start <= month <= end
    return month >= start or month <= end


def active_sports(d=None):
    if d is None:
        d = date.today()
    m = d.month
    return {
        'mlb': is_month_in_range(m, *MLB_ACTIVE),
        'nba': is_month_in_range(m, *NBA_ACTIVE),
        'nhl': is_month_in_range(m, *NHL_ACTIVE),
        'nfl': is_month_in_range(m, *NFL_ACTIVE),
    }


def load_env(path):
    vals = {}
    if not path.exists():
        return vals
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            m = re.match(r'([A-Za-z_][A-Za-z0-9_]*)=(.*)', line)
            if m:
                vals[m.group(1)] = m.group(2).strip()
    return vals


def load_yahoo_tokens(path):
    if not path.exists():
        return None
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    providers = data.get('providers', {})
    creds = data.get('credential_pool', {})
    for section in [providers, creds]:
        for name, entry in section.items():
            if isinstance(entry, dict) and 'access_token' in entry:
                return entry
            if isinstance(entry, list):
                for e in entry:
                    if isinstance(e, dict) and 'access_token' in e:
                        return e
    return None


# Matches the 5-minute-before-expiry margin used by
# src/utils/yahooAuth.js's getValidToken() and
# scripts/send-waiver-digest.mjs's getValidHermesToken() — the two other
# places this exact refresh dance already lives.
YAHOO_TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000


def refresh_yahoo_token(refresh_token, env):
    """POST a refresh_token grant to Yahoo, mirroring refreshYahooToken() in
    src/utils/yahooAuth.js / scripts/send-waiver-digest.mjs."""
    client_id = env.get('YAHOO_CLIENT_ID') or os.environ.get('YAHOO_CLIENT_ID')
    client_secret = env.get('YAHOO_CLIENT_SECRET') or os.environ.get('YAHOO_CLIENT_SECRET')
    if not client_id or not client_secret:
        raise RuntimeError('YAHOO_CLIENT_ID/YAHOO_CLIENT_SECRET not set (checked .env.local and environment)')

    credentials = base64.b64encode(f'{client_id}:{client_secret}'.encode('utf-8')).decode('ascii')
    body = urllib.parse.urlencode({
        'grant_type': 'refresh_token',
        'refresh_token': refresh_token,
    }).encode('ascii')
    req = urllib.request.Request(
        'https://api.login.yahoo.com/oauth2/get_token',
        data=body,
        headers={
            'Authorization': f'Basic {credentials}',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=15, context=YAHOO_SSL_CONTEXT) as resp:
        data = json.loads(resp.read().decode('utf-8'))
    return {
        'access_token': data['access_token'],
        # Yahoo sometimes omits a new refresh token — keep the existing one.
        'refresh_token': data.get('refresh_token', refresh_token),
        'expires_at': int(time.time() * 1000) + data['expires_in'] * 1000,
        'expires_in': data.get('expires_in'),
    }


def get_valid_yahoo_token(path):
    """Load the Hermes-persisted Yahoo token, refreshing and persisting it
    back to auth.json if it's within 5 minutes of expiry (or already
    expired). Without this, a run against a stale token would 403 on every
    Yahoo call the moment the access token (short-lived, ~1hr) expires
    between weekly runs — see P-03."""
    if not path.exists():
        return None
    with open(path, 'r', encoding='utf-8') as f:
        auth = json.load(f)

    stored = auth.get('credential_pool', {}).get('yahoo')
    if not isinstance(stored, dict) or 'access_token' not in stored:
        # Unexpected shape — fall back to the permissive search rather than
        # fail outright. Refresh isn't possible without knowing where to
        # write the result back, so this path can't self-heal an expired
        # token, but it's no worse than the prior behavior.
        return load_yahoo_tokens(path)

    expires_at = stored.get('expires_at')
    if expires_at is None or expires_at - int(time.time() * 1000) >= YAHOO_TOKEN_REFRESH_MARGIN_MS:
        return stored

    refresh_token = stored.get('refresh_token')
    if not refresh_token:
        print('  WARNING: Yahoo token expired/expiring with no refresh_token in auth.json — using stale token as-is.')
        return stored

    env = load_env(REPO_ROOT / '.env.local')
    try:
        refreshed = refresh_yahoo_token(refresh_token, env)
    except Exception as exc:
        print(f'  WARNING: Yahoo token refresh failed ({exc}) — using stale token as-is.')
        return stored

    auth['credential_pool']['yahoo'] = {**stored, **refreshed}
    auth['updated_at'] = datetime.now(timezone.utc).isoformat()
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(auth, f, indent=2)
    print('  Yahoo token refreshed and persisted to auth.json.')
    return auth['credential_pool']['yahoo']


def yahoo_fetch(token, endpoint):
    url = f'https://fantasysports.yahooapis.com/fantasy/v2/{endpoint}?format=json'
    req = urllib.request.Request(url, headers={
        'Authorization': f'Bearer {token["access_token"]}',
        'User-Agent': 'PocketBeane/1.0',
    })
    try:
        with urllib.request.urlopen(req, timeout=15, context=YAHOO_SSL_CONTEXT) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        return {'_http_error': exc.code, '_body': exc.read().decode('utf-8', errors='replace')}
    except Exception as exc:
        return {'_exception': str(exc)}


def _merge_meta(fragments):
    """Yahoo's JSON represents an object's metadata as an array of single-key
    dicts (plus stray empty-list padding entries) instead of one flat dict."""
    merged = {}
    if isinstance(fragments, list):
        for entry in fragments:
            if isinstance(entry, dict):
                merged.update(entry)
    return merged


def get_league_keys(token, sport):
    """Return the user's active (non-completed) league keys for this sport.

    Mirrors scripts/send-waiver-digest.mjs's getUserLeaguesAndTeamKeys(), the
    proven-working reference for this same endpoint/response shape.
    """
    result = yahoo_fetch(token, f'users;use_login=1/games;game_codes={sport}/teams')
    if '_http_error' in result or '_exception' in result:
        return []

    league_keys = []
    try:
        user = result['fantasy_content']['users']['0']['user']
        games = user[1]['games']
        for i in range(games.get('count', 0)):
            game_arr = games.get(str(i), {}).get('game', [{}])
            if len(game_arr) < 2:
                continue
            if game_arr[0].get('is_game_over'):
                continue  # skip completed/past-season leagues
            teams = game_arr[1].get('teams', {})
            for j in range(teams.get('count', 0)):
                team_arr = teams.get(str(j), {}).get('team', [])
                if not team_arr:
                    continue
                team_key = _merge_meta(team_arr[0]).get('team_key')
                if team_key and '.t.' in team_key:
                    league_keys.append(team_key.split('.t.')[0])
    except Exception:
        pass
    # Dedupe while preserving order (rare multi-team-per-league edge case).
    return list(dict.fromkeys(league_keys))


def check_playoff_status(token, league_key):
    """Returns (current_week, playoff_start_week) for a league, or (None, None)."""
    result = yahoo_fetch(token, f'league/{league_key}/settings')
    if '_http_error' in result or '_exception' in result:
        return None, None
    try:
        league_arr = result['fantasy_content']['league']
        meta = league_arr[0]
        settings = league_arr[1].get('settings', [{}])[0]
        return meta.get('current_week'), settings.get('playoff_start_week')
    except Exception:
        return None, None


def should_skip_playoffs(token, sport):
    """Return True if all leagues for this sport are in playoff weeks."""
    league_keys = get_league_keys(token, sport)
    if not league_keys:
        print(f'  No Yahoo leagues found for {sport} — cannot verify playoff status.')
        return False

    any_active = False
    for key in league_keys:
        current_week, playoff_start = check_playoff_status(token, key)
        print(f'    League {key}: current_week={current_week} playoff_start={playoff_start}')
        if current_week is None or playoff_start is None:
            continue
        if current_week < playoff_start:
            any_active = True

    return not any_active


def confirm_season_data_year(output_path, expected_year):
    """Confirm the output file contains current season data."""
    if not output_path.exists():
        return False
    with open(output_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    season = str(data.get('season', ''))
    return season == expected_year


def send_user_digests(sports_ok):
    """T3-5: after a successful stats refresh, fire the user-facing waiver
    digest email for each sport that updated cleanly this run. Runs the
    Node script directly (no Next.js server required) — failures here must
    never fail the pipeline, since the dev-status email below is the more
    important signal."""
    if not sports_ok:
        print('  No sports updated cleanly this run — skipping waiver digests.')
        return
    script = REPO_ROOT / 'scripts' / 'send-waiver-digest.mjs'
    env = dict(os.environ, NODE_OPTIONS='--use-system-ca')
    try:
        proc = subprocess.run(
            ['node', str(script), *sports_ok],
            cwd=str(REPO_ROOT), capture_output=True, text=True, timeout=180, env=env,
        )
        print(proc.stdout)
        if proc.stderr:
            print(proc.stderr)
        if proc.returncode != 0:
            print(f'  [send_user_digests] script exited {proc.returncode}')
    except subprocess.TimeoutExpired:
        print('  [send_user_digests] timed out')
    except Exception as exc:
        print(f'  [send_user_digests] unexpected error: {exc}')


def git_commit_changes(results):
    """Commit the data files this run actually touched. Local commit only —
    never pushes, and a git failure here must never fail the pipeline."""
    updated_sports = [s for s, r in results.items() if r['status'] == 'ok']
    if not updated_sports:
        return {'committed': False, 'reason': 'no sports updated cleanly this run'}

    paths = [REPO_ROOT / 'src' / 'data' / 'mlb_schedule.json']
    for sport in updated_sports:
        players_file = 'mlb_players.json' if sport == 'mlb' else 'players.json'
        paths.append(REPO_ROOT / 'src' / 'data' / players_file)
    today_str = date.today().isoformat()
    paths.extend(p for p in UPDATES_DIR.glob('*-current-season-*.json') if today_str in p.name)

    existing = [str(p) for p in paths if p.exists()]
    if not existing:
        return {'committed': False, 'reason': 'no changed files found to stage'}

    try:
        subprocess.run(['git', 'add', *existing], cwd=str(REPO_ROOT), check=True, capture_output=True, text=True)
        staged = subprocess.run(['git', 'diff', '--cached', '--quiet'], cwd=str(REPO_ROOT))
        if staged.returncode == 0:
            return {'committed': False, 'reason': 'no changes to commit'}

        summary = ', '.join(f'{s.upper()} {results[s]["players_updated"]}' for s in updated_sports)
        message = f'chore: weekly data update {today_str} ({summary})'
        commit = subprocess.run(
            ['git', 'commit', '-m', message], cwd=str(REPO_ROOT), capture_output=True, text=True,
        )
        if commit.returncode != 0:
            return {'committed': False, 'reason': f'commit failed: {commit.stderr.strip()}'}

        sha = subprocess.run(
            ['git', 'rev-parse', '--short', 'HEAD'], cwd=str(REPO_ROOT), capture_output=True, text=True,
        ).stdout.strip()
        return {'committed': True, 'sha': sha, 'message': message}
    except subprocess.CalledProcessError as exc:
        return {'committed': False, 'reason': f'git add failed: {exc.stderr.strip()}'}


def next_weekly_run(from_date):
    """Next Monday 5am after from_date, matching the Hermes cron expr 0 5 * * 1."""
    days_ahead = (0 - from_date.weekday()) % 7 or 7  # Monday=0; today's own run doesn't count
    return from_date + timedelta(days=days_ahead)


def already_ran_today():
    if not RUN_MARKER.exists():
        return False
    return RUN_MARKER.read_text(encoding='utf-8').strip() == date.today().isoformat()


def mark_run_complete():
    RUN_MARKER.parent.mkdir(parents=True, exist_ok=True)
    RUN_MARKER.write_text(date.today().isoformat(), encoding='utf-8')


def send_email(to_addr, subject, body):
    env = load_env(REPO_ROOT / '.env.local')
    gmail_user = env.get('GMAIL_USER') or os.environ.get('GMAIL_USER')
    gmail_pass = env.get('GMAIL_APP_PASSWORD') or os.environ.get('GMAIL_APP_PASSWORD')

    if not gmail_user or not gmail_pass:
        print('ERROR: Gmail credentials not found in .env.local or environment.')
        return False

    msg = MIMEText(body, 'plain', 'utf-8')
    msg['Subject'] = subject
    msg['From'] = gmail_user
    msg['To'] = to_addr

    try:
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(gmail_user, gmail_pass)
            server.sendmail(gmail_user, [to_addr], msg.as_string())
        print(f'Email sent to {to_addr}')
        return True
    except Exception as exc:
        print(f'Email send failed: {exc}')
        return False


def main():
    today = date.today()
    as_of = today.isoformat()
    run_start = date.today()

    # Both the Hermes cron job and the Task Scheduler wake-and-run backstop
    # can trigger this script for the same Monday — only let the first one
    # through.
    if already_ran_today():
        print(f'Pipeline already ran today ({as_of}) — skipping duplicate trigger.')
        return 0
    mark_run_complete()

    sports = active_sports(today)
    print(f'Date: {today}')
    results = {}
    any_skipped = False
    any_failed = False

    token = get_valid_yahoo_token(AUTH_PATH)
    if not token:
        print('WARNING: No Yahoo token found — league playoff check will be skipped.')
        print('  Expected location:', AUTH_PATH)

    for sport, active in sports.items():
        print(f'\n{"="*60}')
        print(f'Sport: {sport.upper()}')
        print(f'{"="*60}')

        # Check 1: Calendar
        if not active:
            print(f'  [{sport}] Check 1 FAIL (offseason) — skipping')
            results[sport] = {
                'status': 'skipped',
                'reason': 'offseason',
                'players_updated': 0,
                'players_skipped': 0,
            }
            any_skipped = True
            continue

        # Check 2: Yahoo playoff status
        if token:
            skip_playoffs = should_skip_playoffs(token, sport)
            if skip_playoffs:
                print(f'  [{sport}] Check 2 FAIL (all leagues in playoffs) — skipping')
                results[sport] = {
                    'status': 'skipped',
                    'reason': 'playoffs',
                    'players_updated': 0,
                    'players_skipped': 0,
                }
                any_skipped = True
                continue
        else:
            print(f'  [{sport}] Check 2 SKIP (no Yahoo token)')

        # Check 3: Run scraper
        scraper = SCRAPERS.get(sport)
        if not scraper or not scraper.exists():
            print(f'  [{sport}] Check 3 FAIL (no scraper found) — skipping')
            results[sport] = {
                'status': 'failed',
                'reason': 'no_scraper',
                'players_updated': 0,
                'players_skipped': 0,
            }
            any_failed = True
            continue

        print(f'  [{sport}] Running scraper: {scraper.name}')
        try:
            proc = subprocess.run(
                [sys.executable, str(scraper)],
                cwd=str(REPO_ROOT),
                capture_output=True,
                text=True,
                timeout=300,
            )
            if proc.returncode != 0:
                print(f'  [{sport}] Scraper failed:\n{proc.stderr}')
                results[sport] = {
                    'status': 'failed',
                    'reason': 'scraper_error',
                    'stdout': proc.stdout,
                    'stderr': proc.stderr,
                }
                any_failed = True
                continue
            print(proc.stdout)
        except subprocess.TimeoutExpired:
            print(f'  [{sport}] Scraper timed out')
            results[sport] = {'status': 'failed', 'reason': 'timeout'}
            any_failed = True
            continue

        # Find output file
        output_files = sorted(UPDATES_DIR.glob(f'{sport}-current-season-*.json'))
        if not output_files:
            print(f'  [{sport}] No output file produced')
            results[sport] = {'status': 'failed', 'reason': 'no_output'}
            any_failed = True
            continue

        output_path = output_files[-1]
        expected_year = str(today.year) if sport == 'mlb' else str(today.year)
        if sport in ('nba', 'nhl', 'nfl'):
            # NBA/NHL season crosses year boundary
            if today.month >= 10:
                expected_year = f'{today.year}-{today.year + 1}'
            else:
                expected_year = f'{today.year - 1}-{today.year}'

        # Confirm season year in output
        with open(output_path, 'r', encoding='utf-8') as f:
            output_data = json.load(f)
        if str(output_data.get('season')) != expected_year:
            print(f'  [{sport}] Season year mismatch: expected {expected_year}, got {output_data.get("season")}')
            results[sport] = {'status': 'failed', 'reason': 'season_year_mismatch'}
            any_failed = True
            continue

        players_updated = output_data.get('players_updated', 0)
        threshold = THRESHOLDS.get(sport, 20)
        if players_updated < threshold:
            print(f'  [{sport}] Low match count: {players_updated} < {threshold} — not merging')
            results[sport] = {
                'status': 'failed',
                'reason': 'low_match_count',
                'players_updated': players_updated,
                'threshold': threshold,
            }
            any_failed = True
            continue

        # Run merge
        players_file = 'mlb_players.json' if sport == 'mlb' else 'players.json'
        merge_cmd = [
            sys.executable, '-c',
            f'import json; from mergeCurrentSeasonData import mergeCurrentSeasonData; '
            f'incoming = json.load(open("{output_path}")); '
            f'existing = json.load(open("src/data/{players_file}")); '
            f'result = mergeCurrentSeasonData(incoming, existing); '
            f'if not result["ok"]: exit(1); '
            f'json.dump(result["players"], open(f"src/data/{players_file}", "w"), indent=2)'
        ]
        # Actually use node CLI for merge
        merge_cmd = [
            'node', str(MERGE_SCRIPT), str(output_path),
            '--players', str(REPO_ROOT / 'src' / 'data' / players_file)
        ]
        print(f'  [{sport}] Merging: {" ".join(str(x) for x in merge_cmd)}')
        try:
            merge_proc = subprocess.run(merge_cmd, cwd=str(REPO_ROOT), capture_output=True, text=True, timeout=60)
            print(merge_proc.stdout)
            if merge_proc.returncode != 0:
                print(f'  [{sport}] Merge failed:\n{merge_proc.stderr}')
                results[sport] = {
                    'status': 'failed',
                    'reason': 'merge_error',
                    'stdout': merge_proc.stdout,
                    'stderr': merge_proc.stderr,
                }
                any_failed = True
                continue
        except subprocess.TimeoutExpired:
            print(f'  [{sport}] Merge timed out')
            results[sport] = {'status': 'failed', 'reason': 'merge_timeout'}
            any_failed = True
            continue

        results[sport] = {
            'status': 'ok',
            'players_updated': output_data.get('players_updated', 0),
            'players_skipped': output_data.get('players_skipped', 0),
            'injury_data': output_data.get('injury_data', 'unknown'),
            'merge_output': merge_proc.stdout,
        }

    # T3-5: automated waiver digest email, one per sport that updated cleanly
    # this run. Independent of the checks below — never lets a digest
    # failure fail the whole weekly run.
    print(f'\n{"="*60}')
    print('WAIVER DIGEST EMAIL')
    print(f'{"="*60}')
    try:
        send_user_digests([s for s, r in results.items() if r['status'] == 'ok'])
    except Exception as exc:
        print(f'  [send_user_digests] unexpected error: {exc}')

    # Schedule refresh (Start/Sit Advisor games-this-week/back-to-back data).
    # Independent of the per-sport current-season loop above — never lets a
    # schedule fetch failure fail the whole weekly run.
    print(f'\n{"="*60}')
    print('SCHEDULE REFRESH')
    print(f'{"="*60}')
    for sport, scraper in SCHEDULE_SCRAPERS.items():
        if not sports.get(sport):
            print(f'  [{sport}] Skipping schedule refresh (offseason)')
            continue
        try:
            proc = subprocess.run(
                [sys.executable, str(scraper)],
                cwd=str(REPO_ROOT),
                capture_output=True,
                text=True,
                timeout=60,
            )
            print(proc.stdout)
            if proc.returncode != 0:
                print(f'  [{sport}] Schedule refresh failed:\n{proc.stderr}')
        except subprocess.TimeoutExpired:
            print(f'  [{sport}] Schedule refresh timed out')

    # Commit the data files this run touched. Independent of the checks
    # above — never lets a git failure fail the whole weekly run.
    print(f'\n{"="*60}')
    print('GIT COMMIT')
    print(f'{"="*60}')
    try:
        git_result = git_commit_changes(results)
    except Exception as exc:
        git_result = {'committed': False, 'reason': f'unexpected error: {exc}'}
    if git_result.get('committed'):
        print(f'  Committed {git_result["sha"]}: {git_result["message"]}')
    else:
        print(f'  Not committed — {git_result.get("reason")}')

    # Build summary
    duration = (date.today() - run_start).total_seconds()

    email_body = build_email_body(as_of, duration, results, token, git_result)
    subject = build_subject(results)

    # Always attempt to send for visibility
    send_email(NOTIFY_TO, subject, email_body)

    print(f'\n{"="*60}')
    print('PIPELINE COMPLETE')
    print(f'{"="*60}')
    for sport, res in results.items():
        print(f'{sport.upper()}: {res["status"]} — {res.get("reason", "OK")}')

    if not token:
        print('\nNOTE: Yahoo token missing from', AUTH_PATH)
        print('      League playoff check and league season summary were skipped.')

    return 0 if not any_failed else 1


def build_subject(results):
    failed = [s for s, r in results.items() if r['status'] == 'failed']
    if failed:
        return f'⚠️ PocketBeane — {", ".join(failed).upper()} Update FAILED {date.today().isoformat()}'
    ok_sports = [s.upper() for s, r in results.items() if r['status'] == 'ok']
    return f'✅ PocketBeane — Weekly Data Update {date.today().isoformat()}'


def build_email_body(run_date, duration, results, token, git_result):
    next_run = next_weekly_run(date.fromisoformat(run_date))
    lines = []
    lines.append(f'PocketBeane weekly data pipeline complete.')
    lines.append(f'Date: {run_date} | Run time: {duration}s')
    lines.append('')
    lines.append('SPORT SUMMARY')
    lines.append('─' * 40)

    for sport in ['mlb', 'nba', 'nhl', 'nfl']:
        r = results.get(sport, {'status': 'unknown'})
        status_icon = {'ok': '✅', 'skipped': '⏸', 'failed': '⚠️'}.get(r['status'], '?')
        reason = r.get('reason', '')
        if r['status'] == 'skipped' and reason == 'offseason':
            if sport in ('nba', 'nhl'):
                next_active = 'October 2026'
            elif sport == 'nfl':
                next_active = 'September 2026'
            else:
                next_active = 'unknown'
            lines.append(f'{sport.upper()} {status_icon}  Offseason — next active: {next_active}')
        elif r['status'] == 'ok':
            lines.append(f'{sport.upper()} {status_icon}  Players updated: {r.get("players_updated", 0)} | Skipped: {r.get("players_skipped", 0)} | Injury data: ✅')
        elif r['status'] == 'skipped' and reason == 'playoffs':
            lines.append(f'{sport.upper()} {status_icon}  All leagues in playoffs — skipped')
        elif r['status'] == 'failed':
            lines.append(f'{sport.upper()} {status_icon}  Failed: {reason}')
        else:
            lines.append(f'{sport.upper()} {status_icon}  {r.get("status", "unknown")}')

    lines.append('')
    lines.append('─' * 40)
    lines.append('LEAGUE SEASON CHECK')
    if token:
        for sport in ['mlb']:
            league_keys = get_league_keys(token, sport)
            for key in league_keys:
                cw, ps = check_playoff_status(token, key)
                lines.append(f'  {key}: Week {cw} — playoffs week {ps}')
    else:
        lines.append('  [Blocked: Yahoo token not found — cannot verify leagues]')

    for sport in ['mlb'] if results.get('mlb', {}).get('status') == 'ok' else []:
        lines.append(f'')
        lines.append('─' * 40)
        lines.append(f'MERGE OUTPUT — {sport.upper()}')
        lines.append(results[sport].get('merge_output', 'N/A'))

    lines.append('')
    lines.append('─' * 40)
    lines.append('GIT STATUS')
    if git_result.get('committed'):
        lines.append(f'  Committed {git_result["sha"]}: {git_result["message"]}')
    else:
        lines.append(f'  Not committed — {git_result.get("reason", "unknown")}')
    lines.append('')
    lines.append(f'Next scheduled run: Monday {next_run.isoformat()} at 5:00 AM')

    if any(r.get('status') == 'failed' for r in results.values()):
        failed_sport = next(s for s, r in results.items() if r.get('status') == 'failed')
        lines.append('')
        lines.append('=' * 60)
        lines.append(f'FAILURE ALERT: {failed_sport.upper()}')
        lines.append('=' * 60)
        lines.append(f'{failed_sport.upper()} data update failed. No data was merged for this sport.')
        lines.append(f'')
        lines.append(f'Date: {run_date}')
        lines.append(f'Failure reason: {results[failed_sport].get("reason", "unknown")}')
        lines.append(f'')
        lines.append(f'Error details:')
        lines.append(results[failed_sport].get('stdout', '') or results[failed_sport].get('stderr', 'N/A'))
        lines.append(f'')
        lines.append(f'No changes were made to players.json for {failed_sport.upper()}.')
        lines.append(f'Other sports processed this week are unaffected.')
        lines.append(f'Next retry: Monday {next_run.isoformat()} at 5:00 AM')

    return '\n'.join(lines)


if __name__ == '__main__':
    sys.exit(main())
