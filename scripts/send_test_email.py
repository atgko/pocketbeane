#!/usr/bin/env python3
"""Send PocketBeane weekly summary test email via Gmail SMTP."""

import json
import os
import re
import smtplib
from email.mime.text import MIMEText
from datetime import date

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ENV_FILE = os.path.join(REPO_ROOT, '.env.local')

def load_env(path):
    vals = {}
    if not os.path.exists(path):
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


def build_email_body(run_date, duration_seconds):
    body = f"""PocketBeane weekly data pipeline complete.
Date: {run_date} | Run time: {duration_seconds}s

SPORT SUMMARY
─────────────────────────────────────────
MLB ✅  Players updated: 293 | Skipped: 7 | Injury data: ✅
NBA ⏸  Offseason — next active: October 2026
NHL ⏸  Offseason — next active: October 2026
NFL ⏸  Offseason — next active: September 2026

─────────────────────────────────────────
LEAGUE SEASON CHECK
  [Blocked: Yahoo token not found at C:/Users/athav/AppData/Local/hermes/auth.json]

─────────────────────────────────────────
MERGE OUTPUT — MLB
  ✓ Updated:  293 players
  ⚠ Skipped:  0 players (no match in players.json)
  ✗ Invalid:  0 entries (validation errors — not written)
  Output: src/data/mlb_players.json

─────────────────────────────────────────
SKIPPED PLAYERS — MLB (7)
  [Blocked: no Yahoo API access to cross-reference]

─────────────────────────────────────────
GIT STATUS
  [Skipped — not auto-committing in this test run]

Next scheduled run: Monday 2026-07-13 at 7:00 AM ET
"""
    return body


def send_email(to_addr, subject, body):
    env = load_env(ENV_FILE)
    gmail_user = env.get('GMAIL_USER') or os.environ.get('GMAIL_USER')
    gmail_pass = env.get('GMAIL_APP_PASSWORD') or os.environ.get('GMAIL_APP_PASSWORD')

    if not gmail_user or not gmail_pass:
        missing_user = "found" if gmail_user else "missing"
        missing_pass = "found" if gmail_pass else "missing"
        print('ERROR: Gmail credentials not found in .env.local or environment.')
        print(f'  GMAIL_USER: {missing_user}')
        print(f'  GMAIL_APP_PASSWORD: {missing_pass}')
        print('Set GMAIL_USER and GMAIL_APP_PASSWORD in .env.local or as environment variables.')
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


if __name__ == '__main__':
    to = 'athavan.elangko@gmail.com'
    subject = '✅ PocketBeane — Weekly Data Update 2026-07-07'
    body = build_email_body('2026-07-07', '45')
    ok = send_email(to, subject, body)
    exit(0 if ok else 1)
