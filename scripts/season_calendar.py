#!/usr/bin/env python3
"""PocketBeane season calendar guardrail — determines active sports for a given date."""

from datetime import date

MLB_ACTIVE = (4, 10)
NBA_ACTIVE = (10, 4)    # Late Oct through mid-Apr (special case)
NHL_ACTIVE = (10, 4)    # Late Oct through mid-Apr
NFL_ACTIVE = (9, 2)     # September through February inclusive


def is_month_in_range(month, start, end):
    if start <= end:
        return start <= month <= end
    # wraps year boundary
    return month >= start or month <= end


def active_sports(d=None):
    if d is None:
        d = date.today()
    m = d.month
    sports = {}
    sports['mlb'] = is_month_in_range(m, *MLB_ACTIVE)
    # NBA/NHL are (Oct-Apr) which wraps year boundary
    sports['nba'] = is_month_in_range(m, *NBA_ACTIVE)
    sports['nhl'] = is_month_in_range(m, *NHL_ACTIVE)
    # NFL is Sep-Feb, which also wraps
    sports['nfl'] = is_month_in_range(m, *NFL_ACTIVE)
    return sports


if __name__ == '__main__':
    d = date.today()
    sports = active_sports(d)
    print(f'Date: {d}')
    for sport, active in sports.items():
        status = 'ACTIVE' if active else 'OFFSEASON'
        print(f'  {sport.upper()}: {status}')
    print()
    active = [s for s, a in sports.items() if a]
    print(f'Active sports this week: {", ".join(active) if active else "none"}')
