# PocketBeane — Player Data Schema

This document is the authoritative reference for the player data model used in `src/data/players.json` and `src/data/mlb_players.json`. All ingestion scripts, AI prompts, and UI components should be written against this schema.

---

## NBA Player (`players.json`)

```json
{
  "id": "nikola-jokic",
  "name": "Nikola Jokic",
  "team": "DEN",
  "positions": ["C"],
  "yahoo_positions": ["C"],
  "adp": 1.3,
  "adp_source": "FantasyPros Yahoo 10-team 2026",
  "prior_season": {
    "pts": 27.7,
    "reb": 12.9,
    "ast": 10.7,
    "stl": 1.4,
    "blk": 0.8,
    "to": 3.7,
    "fg_pct": 0.569,
    "ft_pct": 0.831,
    "three_pm": 1.7,
    "gp": 65
  },
  "current_season": {
    "as_of_date": "2026-06-30",
    "pts": 26.8,
    "reb": 12.5,
    "ast": 10.9,
    "stl": 1.2,
    "blk": 0.7,
    "to": 3.5,
    "fg_pct": 0.558,
    "ft_pct": 0.819,
    "three_pm": 1.5,
    "gp": 14,
    "trend": "stable",
    "injury_status": "healthy",
    "injury_note": null,
    "source": "hermes_weekly_pull",
    "note": null
  },
  "age": 30,
  "injury_risk": false,
  "injury_notes": null,
  "injury_status": "healthy",
  "contract_year": false,
  "notes": null
}
```

### NBA `prior_season` fields

| Field | Type | Description |
|---|---|---|
| `pts` | number | Points per game |
| `reb` | number | Rebounds per game |
| `ast` | number | Assists per game |
| `stl` | number | Steals per game |
| `blk` | number | Blocks per game |
| `to` | number | Turnovers per game |
| `fg_pct` | number | Field goal percentage (0–1) |
| `ft_pct` | number | Free throw percentage (0–1) |
| `three_pm` | number | Three-pointers made per game |
| `gp` | number | Games played |

### NBA `current_season` fields

`current_season` is **optional and nullable**. Absent or `null` means no in-season snapshot exists — all code must handle this gracefully by falling back to `prior_season`.

| Field | Type | Required | Description |
|---|---|---|---|
| `as_of_date` | string (ISO date) | Yes | Date the snapshot was last updated. Used for staleness checks (stale = 14+ days old). |
| `pts` | number | Yes | Points per game (current season) |
| `reb` | number | Yes | Rebounds per game |
| `ast` | number | Yes | Assists per game |
| `stl` | number | Yes | Steals per game |
| `blk` | number | Yes | Blocks per game |
| `to` | number | Yes | Turnovers per game |
| `fg_pct` | number | Yes | Field goal percentage (0–1) |
| `ft_pct` | number | Yes | Free throw percentage (0–1) |
| `three_pm` | number | Yes | Three-pointers made per game |
| `gp` | number | Yes | Games played this season |
| `trend` | string | Yes | `"improving"`, `"slightly-improving"`, `"stable"`, `"slightly-declining"`, or `"declining"` — computed by `calculateTrend()` (T1-3), never set externally |
| `injury_status` | string | Yes | `"healthy"`, `"day-to-day"`, or `"out"` |
| `injury_note` | string\|null | Yes | Human-readable injury detail (e.g. `"Left knee tendinopathy — re-evaluated daily"`). `null` when healthy. |
| `source` | string | Yes | `"hermes_weekly_pull"` or `"manual_entry"` — provenance tracking for data quality debugging |
| `note` | string\|null | Yes | Reserved for future use (e.g. `"role change"`, `"injury return"`). Leave `null` for now. |

### Trend calculation

`trend` is computed by `calculateTrend(priorSeason, currentSeason, profile?)` (see `scripts/mergeCurrentSeasonData.js` and T1-3 spec). The primary signal is `pts`, `reb`, and `ast` for NBA (sport-specific profiles for MLB — see below). A combined deviation beyond `TREND_THRESHOLD` (15%) vs `prior_season` in either direction is a full `"improving"`/`"declining"`; a deviation beyond `TREND_MINOR_THRESHOLD` (5%) but not `TREND_THRESHOLD` is `"slightly-improving"`/`"slightly-declining"`; otherwise `"stable"`.

Both thresholds are named constants in the calculation utility (`TREND_THRESHOLD = 0.15`, `TREND_MINOR_THRESHOLD = 0.05`) — tune there, not in the data.

### Staleness

If `current_season.as_of_date` is more than 14 days old, AI prompts and UI labels should treat the data as stale and caveat accordingly. The staleness threshold is `STALENESS_DAYS = 14` — defined in the prompt/UI layer, not here.

---

## MLB Player (`mlb_players.json`)

```json
{
  "id": "shohei-ohtani",
  "name": "Shohei Ohtani",
  "team": "LAD",
  "positions": ["SP", "DH"],
  "yahoo_positions": ["SP", "DH"],
  "player_type": "pitcher",
  "adp": 1,
  "adp_source": "FantasyPros Yahoo 10-team 2026 MLB",
  "auction_value": 65,
  "prior_season": {
    "w": 1,
    "sv": 0,
    "k": 62,
    "era": 2.87,
    "whip": 1.043,
    "gp": 14,
    "gs": 14
  },
  "current_season": null,
  "age": 30,
  "injury_risk": false,
  "injury_notes": null,
  "injury_status": "healthy",
  "contract_year": false,
  "notes": null
}
```

### MLB `prior_season` fields

MLB splits by `player_type`. A player may have one or both sets depending on their role (two-way players like Ohtani carry pitcher stats when used as SP).

**Pitchers** (`player_type: "pitcher"`):

| Field | Type | Description |
|---|---|---|
| `w` | number | Wins |
| `sv` | number | Saves |
| `k` | number | Strikeouts |
| `era` | number | Earned run average (lower is better) |
| `whip` | number | Walks + hits per inning pitched (lower is better) |
| `gp` | number | Games pitched |
| `gs` | number | Games started |

**Hitters** (`player_type: "hitter"`):

| Field | Type | Description |
|---|---|---|
| `r` | number | Runs scored |
| `hr` | number | Home runs |
| `rbi` | number | Runs batted in |
| `sb` | number | Stolen bases |
| `avg` | number | Batting average (0–1) |
| `gp` | number | Games played |

### MLB `current_season` fields

The sport-agnostic wrapper (`as_of_date`, `trend`, `injury_status`, `injury_note`, `source`, `note`) is identical to NBA. The stat fields inside differ by `player_type`:

**Pitcher `current_season` stats:** `w`, `sv`, `k`, `era`, `whip`, `gp`, `gs`

**Hitter `current_season` stats:** `r`, `hr`, `rbi`, `sb`, `avg`, `gp`

`trend` for MLB uses `k`, `era`, `whip` as the primary signal for pitchers and `hr`, `rbi`, `avg` for hitters, normalized to per-game rates before comparison (`hr`/`rbi`/`k` are season-to-date totals in this schema, not rates — comparing raw totals against a full prior season would read as "declining" for most of the year regardless of real form). Same `TREND_THRESHOLD`/`TREND_MINOR_THRESHOLD` constants as NBA. Pitcher trend uses an averaged per-stat percentage deviation rather than a single summed-total deviation, since `era`/`whip` are sign-flipped (lower is better) and summing a sign-flipped stat against a "higher is better" one (`k`) can invert the result for small samples.

**Note:** MLB `current_season` data is live in `mlb_players.json` as of 2026-07-06 via `scripts/scrape_mlb.py` + `scripts/mergeCurrentSeasonData.js` (Hermes-sourced weekly pull, 293 players).

---

## NFL Player (`nfl_players.json`)

Unlike NBA/MLB (roto/category leagues), NFL is modeled for a **Head-to-Head Points (half-PPR)** league. Rather than a parallel "points mode" through every category-consuming file, `SPORT_CONFIGS.nfl` (`src/config/sports.js`) exposes a single synthetic category, `fantasy_ppg`, computed once at build time and stored on `prior_season` — everything downstream (category grading, `valueCalculator`, `draftDNA`, season prompts) then treats NFL as a 1-category league, which degrades correctly to "rank by best available value" for a points format.

```json
{
  "id": "bijan-robinson",
  "name": "Bijan Robinson",
  "team": "ATL",
  "positions": ["RB"],
  "yahoo_positions": ["RB"],
  "adp": 1.3,
  "adp_source": "FantasyPros Consensus 2026 NFL",
  "auction_value": 65,
  "prior_season": {
    "pass_yd": null,
    "pass_td": null,
    "int": null,
    "rush_yd": 1720,
    "rush_td": 20,
    "rec": 51,
    "rec_yd": 420,
    "rec_td": 3,
    "gp": 17,
    "fantasy_ppg": 19.72
  },
  "age": 24,
  "injury_risk": false,
  "injury_notes": null,
  "injury_status": "healthy",
  "contract_year": false,
  "notes": null
}
```

### NFL `prior_season` fields

| Field | Type | Description |
|---|---|---|
| `pass_yd` | number\|null | Passing yards (season total) — QBs only |
| `pass_td` | number\|null | Passing touchdowns (season total) — QBs only |
| `int` | number\|null | Interceptions thrown (season total) — QBs only |
| `rush_yd` | number\|null | Rushing yards (season total) |
| `rush_td` | number\|null | Rushing touchdowns (season total) |
| `rec` | number\|null | Receptions (season total) |
| `rec_yd` | number\|null | Receiving yards (season total) |
| `rec_td` | number\|null | Receiving touchdowns (season total) |
| `gp` | number | Games played |
| `fantasy_ppg` | number\|null | Half-PPR fantasy points per game, computed from the fields above (see formula below) |

`prior_season` is `null` for K/DEF — Pro-Football-Reference's passing/rushing/receiving tables don't cover those positions, so they're ranked by ADP alone, same fallback `valueCalculator.js` already uses for any player with no matched stats row.

**`fantasy_ppg` formula** (built by `scripts/build-nfl-players.js`, matching this league's actual Yahoo scoring):

```
total = 0.04·pass_yd + 4·pass_td − 1·int + 0.1·rush_yd + 6·rush_td + 0.5·rec + 0.1·rec_yd + 6·rec_td
fantasy_ppg = total / gp
```

**Deliberate omission:** fumbles-lost (−2), return TDs (+6), and 2-point conversions (+2) are excluded — Pro-Football-Reference's standard tables expose total fumbles (not fumbles *lost*) and don't isolate return TDs per player, so including them isn't possible from this data source. This is an approximation, same spirit as ADP itself being an approximation. K/DEF scoring (field-goal-distance brackets, points-allowed tiers) isn't modeled at all for the same reason.

### NFL `current_season`

Not yet populated — `mergeCurrentSeasonData.js`'s `buildTrendInputs()` has no NFL branch yet (falls through to NBA's trend profile, which is wrong for a weekly sport). Deferred to Phase 2, once in-season stats matter (after the draft).

---

## Team Schedule (`nba_schedule.json`, `mlb_schedule.json`)

Season-long game list, one file per sport that supports the Start/Sit Advisor (Y-05). Unlike `current_season` player stats, a team's full-season schedule is fixed and known in advance — these files are a one-time-per-season data drop, not a weekly-refreshed pipeline output. `src/config/sports.js`'s `getScheduleFile(sport)`/`hasScheduleSupport(sport)` drive which sports have this data; a sport with no `scheduleFile` configured (currently NHL, NFL) gets a clean "not available yet" response from the advisor instead of a hardcoded sport check — adding NHL/NFL support later is a pure data-file drop plus one `sports.js` config entry, no code changes to the advisor.

```json
{
  "season": "2026-27",
  "sport": "nba",
  "source": "manual_seed_sample",
  "games": [
    { "date": "2026-11-16", "home": "DEN", "away": "LAL" }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `season` | string | Season label, e.g. `"2026-27"` (NBA) or `"2026"` (MLB) |
| `sport` | string | `"nba"` or `"mlb"` |
| `source` | string | `"manual_seed_sample"` (current placeholder data) or the name of a future import script |
| `games[].date` | string (ISO date) | Game date, no time component |
| `games[].home` | string | Home team code — **must match `player.team` codes exactly** in the corresponding player file, including this project's non-standard NBA abbreviations (`PHO`, `UTH`, `NOR`, `WAS`) |
| `games[].away` | string | Away team code, same rules |

**Current state:** both files are hand-seeded samples, **not real, verified schedules** — `nba_schedule.json` covers 6 teams across two weeks (Nov 16–29, 2026); `mlb_schedule.json` covers 6 teams for the week of Jul 6–12, 2026 (chosen to match `mlb_players.json`'s real `current_season.as_of_date`, so the MLB advisor is live-demoable with no params). Swapping in a real season export is a pure data-file replacement — same `{season, sport, source, games[]}` shape, no changes needed in `src/utils/schedule.js` or `pages/api/season/startsit-advice.js`.

**MLB caveat:** MLB hitters play near-daily, so team-schedule density isn't a strong start/sit signal for hitters the way it is for NBA. The real MLB signal — pitcher probable starts (1-start vs. 2-start weeks) — isn't tracked yet; the advisor uses team-schedule games-this-week as an approximate proxy for pitchers in the meantime and says so in its output. See BACKLOG Y-05c for the planned upgrade.

### Schedule utility

`src/utils/schedule.js` — pure date-math functions (`getTeamGamesInRange`, `countGamesInRange`, `findBackToBacks`, `hasBackToBack`, `getWeekRange`), sport-agnostic by design. Written as CommonJS (like `scripts/calculateTrend.js`) so it's testable via plain `node` (`scripts/test/schedule.test.js`, `npm run test:schedule`) and still importable from Next.js API routes.

---

## Field ownership rules

These rules exist to prevent the merge script from corrupting curated data.

| Field | Owned by | Never touched by |
|---|---|---|
| `prior_season` | Manual curation / build scripts | Merge script |
| `adp`, `adp_source` | Manual curation / build scripts | Merge script |
| `auction_value` | Manual curation / build scripts | Merge script |
| `injury_risk` | Manual curation | Merge script |
| `injury_notes` | Manual curation | Merge script |
| `injury_status` (top-level) | Manual curation | Merge script |
| `current_season` | Merge script / Hermes | Manual (except for `manual_entry` source) |
| `current_season.trend` | `calculateTrend()` utility | External data sources |
| `nba_schedule.json` / `mlb_schedule.json` (whole file) | Manual curation / future schedule-import script | Merge script, `calculateTrend()` |
