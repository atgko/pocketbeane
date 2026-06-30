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
| `trend` | string | Yes | `"improving"`, `"stable"`, or `"declining"` — computed by `calculateTrend()` (T1-3), never set externally |
| `injury_status` | string | Yes | `"healthy"`, `"day-to-day"`, or `"out"` |
| `injury_note` | string\|null | Yes | Human-readable injury detail (e.g. `"Left knee tendinopathy — re-evaluated daily"`). `null` when healthy. |
| `source` | string | Yes | `"hermes_weekly_pull"` or `"manual_entry"` — provenance tracking for data quality debugging |
| `note` | string\|null | Yes | Reserved for future use (e.g. `"role change"`, `"injury return"`). Leave `null` for now. |

### Trend calculation

`trend` is computed by `calculateTrend(priorSeason, currentSeason)` (see `scripts/mergeCurrentSeasonData.js` and T1-3 spec). The primary signal is `pts`, `reb`, and `ast`. A combined deviation of more than 15% vs `prior_season` in either direction = `"improving"` or `"declining"`; otherwise `"stable"`.

The threshold is defined as `TREND_THRESHOLD = 0.15` in the calculation utility — tune there, not in the data.

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

`trend` for MLB uses `k`, `era`, `whip` as the primary signal for pitchers and `hr`, `rbi`, `avg` for hitters. Threshold is the same `TREND_THRESHOLD = 0.15` constant.

**Note:** MLB `current_season` sample data is intentionally absent from `mlb_players.json` until the Hermes scraping pipeline is scoped for MLB. The schema above documents the intended shape for when that work begins.

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
