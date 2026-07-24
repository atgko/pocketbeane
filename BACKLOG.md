# PocketBeane — Active Backlog

Last updated: 2026-07-24 (MLB schedule UAT fix — `mlb_schedule.json` was a one-week manual sample from 2026-07-07, replaced with a real full-season fetch via new `scripts/fetch_mlb_schedule.py` (MLB Stats API), wired into `run_weekly.py`; waiver wire advisor now shows ADP for owned roster players, not just free agents, and weighs asset value before recommending a drop. See two new pipeline-freshness tickets in the Data Pipeline Incident Log, both deferred to after the first real Hermes cron run 2026-07-27. Previously: 2026-07-07, Y-05 Start/Sit Advisor built — NBA + MLB, schedule-aware via `nba_schedule.json`/`mlb_schedule.json` + `src/utils/schedule.js`; `sports.js` generalized with `playerFile`/`scheduleFile`/`getPlayerFile`/`getScheduleFile`/`hasScheduleSupport` so NHL/NFL start/sit needs zero code changes once their data lands, only a config entry + data files; new Y-05c ticket tracks MLB pitcher probable-starts as a future accuracy upgrade, not a blocker)

Items are grouped by dependency tier. Within each tier, order reflects rough priority / logical sequencing.

---

## DECISION — Side project vs. commercial product (June 2026)

After cross-referencing the PMF backlog against the codebase, we split the PMF
gap tickets into two buckets:

**Build — makes the product genuinely better:**
~~PMF-01~~ ✅ (rate limiting), ~~PMF-02~~ ✅ (philosophy quiz UX), ~~PMF-04~~ ✅ (shareable recap
card), PMF-08 (data refresh). These improve the actual draft/season experience
regardless of whether PocketBeane ever has other users.

**Defer — commercial theater for a side project:**
PMF-03 (freemium tier architecture), PMF-05 (email capture), PMF-07 (analytics),
PMF-09 ($4.99 trial tier). These only make sense with a real user base and
billing infrastructure. Building them now adds complexity that makes the tool
worse to use personally. The PMF simulation + product architecture already tell
the portfolio story without a fake paywall.

Yahoo roadmap: Y-02 ✅ → Y-04 ✅ → Y-03 (August build / September validate) → **Y-05 (active next)**.
Note: Y-03 requires a live Yahoo draft for end-to-end validation so infrastructure ships in August. Y-05 is fully unblocked — start with waiver wire advisor + head-to-head matchup advisor, then trade analyzer as a separate sprint.

Multi-sport: MLB-01 ✅ → NHL-01 (August data) → NFL-01 (August data).

---

## Tier 1 — Yahoo-connected features

### ~~Y-02 · League Selection After Auth~~ ✅ DONE
Setup page fetches `/api/yahoo/my-leagues`, renders dropdown, maps selection
to `yahooLeagueKey` on the league config. Home page has auto-match logic for
existing leagues. Full Y-02 spec covered.

---

### ~~Y-06 · Draft History Recap Page~~ ✅ DONE
`DraftComplete.jsx` renders full roster table (round-by-round picks with prior
season stats), category report with grade bars, and Beane's Season Outlook
(Claude-generated strengths / vulnerabilities / narrative). Triggered
automatically when draft is synced from Yahoo.

---

### Y-03 · Live Draft Sync via Polling
**Goal:** During a live Yahoo draft, PocketBeane auto-detects new picks and
updates the board without manual input.

**Approach:** Poll Yahoo's draft picks endpoint every 8–10 seconds during an
active draft session. Diff against local pick state. Apply new picks
automatically. Manual input remains as fallback.

**Prerequisite:** Y-01 ✓, Y-02 ✓

**Note:** Yahoo does not offer WebSocket or webhook events for draft picks.
Polling is the correct approach.

**Timing constraint:** Infrastructure can be built any time, but end-to-end
validation requires a live Yahoo draft in progress. Target build: August 2026,
validate during September draft window.

---

### ~~Y-04 · Post-Draft Roster Sync~~ ✅ DONE
`/api/yahoo/sync-rosters` fetches all 10 team rosters + standings in parallel,
matches players to `players.json` IDs by name normalization, stores result as
`league.leagueRosters` in Zustand. Season Hub shows standings table with
expandable team rosters; user's team auto-expands and is highlighted. Refresh
button for in-season updates.

---

### Y-05 · Season Management Suite (in progress)
**Goal:** Full in-season advisor powered by live Yahoo data.

**Sub-features:**

| Sub-feature | Status | Description |
|---|---|---|
| Waiver wire advisor | ✅ UAT complete | `/api/season/waiver-advice` — diffs all team rosters vs players.json, top 25 FAs by ADP, Claude add/drop recs |
| Head-to-head matchup advisor | ✅ UAT complete (NBA) — ⚠️ MLB blocked 2026-07-24 | `/api/season/matchup-advice` — fetches scoreboard, finds opponent, Claude category-by-category breakdown. See "Yahoo API throttle" note below the status table — the MLB league's `/scoreboard` and `/settings` calls are currently 403ing at the Yahoo API level (not a code bug); needs a retest once that clears. |
| Start/sit advisor | ✅ UAT complete (2026-07-24) | `/api/season/startsit-advice` — schedule-aware (games-this-week, back-to-back), form, and injury-aware weekly lineup recommendation. NBA and MLB (MLB pitcher signal is an approximate schedule proxy, see Y-05c). NHL/NFL return a clean "not available yet" until their data lands — no code changes needed when it does, see docs/SCHEMA.md. |
| Trade analyzer | ✅ Built (2026-07-24) — needs browser UAT | `/api/season/trade-advice` — `getTradeAdvice()`, pure POST like the waiver advisor (no live Yahoo call, unaffected by the scoreboard/settings throttle). Give/receive text input on Season Hub; validates give against the user's roster and receive against a single opposing team's roster, then Claude evaluates net category impact, positional fit, and buy-low/sell-high signal using the same current-season-aware reasoning as the waiver advisor. Smoke-tested end-to-end via synthetic roster payload — real output, correct JSON shape. Not yet exercised against a real synced league in the browser. |
| Trade value index | ✅ Built (2026-07-24) — needs browser UAT | `/api/season/trade-value-index` — `getTradeValueIndex()`, pure POST (no live Yahoo call). Scans the user's own roster for sell-high candidates (current-season overperformance vs. baseline/ADP) and every other team's roster for buy-low targets (real pedigree, depressed current trend). Caught and fixed a real model-output bug in testing: Claude occasionally suggested "buying low" on the user's own player — added a server-side filter dropping any `buyLowTargets` entry matching the user's own roster, on top of tightening the prompt. Smoke-tested end-to-end, fix verified. |
| League pulse | ✅ Built (2026-07-24) — needs browser UAT | `/api/season/league-pulse` — `getLeaguePulse()`, pure POST (no live Yahoo call). Uses cached standings (rank/wins/losses, already part of `leagueRosters`) plus every team's roster to identify dominating teams, rebuilding/weak teams, and specific trade-partner opportunities for the user. Smoke-tested end-to-end via synthetic 3-team payload — real, well-reasoned output. |
| Roster health score | Later (PMF S5) | Single-team weekly 1–10 score — category win rate, injury exposure, upcoming schedule strength, waiver opportunity; trend arrow + one-line Claude insight. Requires user-logged weekly W/L per category (no Yahoo endpoint for this). |

**Architecture:**
- Waiver advice: pure POST (no Yahoo token needed) — uses `leagueRosters` state + players.json. Sport-agnostic (nba/mlb).
- Matchup advice: POST with Yahoo token — fetches `/league/{key}/scoreboard` for current week opponent, then enriches both rosters with players.json stats.
- Trade advice: pure POST like waiver advice (no live Yahoo call) — validates give/receive against cached `leagueRosters`, enriches with players.json stats.
- Trade value index: pure POST — scans own roster (sell-high) + every other team's roster (buy-low) using ADP/trend data already in players.json.
- League pulse: pure POST — uses cached standings (rank/wins/losses) + every roster to summarize the league and surface trade partners.
- All five return structured JSON rendered in Season Hub panels: headline/moves for waiver, outlook/win-lose-tossup/keyNote for matchup, verdict/category-impact/positional/buy-sell for trade, headline/sellHigh/buyLowTargets for trade value index, headline/dominating/rebuilding/tradeOpportunities for league pulse.

**Yahoo API throttle (found 2026-07-24):** the MLB league (`469.l.209547`) started 403ing on `/league/{key}/settings` and `/league/{key}/scoreboard` with "This application is not authorized to perform this action" after a burst of OAuth reconnects + `/me` polling during same-session debugging. Basic account-level calls (`/users/games`) still work, and roster/standings calls were unconfirmed either way (`sync-rosters` also failed the same way once tested). Likely a transient app/account-level rate-limit, not a permissions or code bug — retest after a cooldown period. Separately (real bug, fixed): `pages/api/auth/yahoo/me.js` was collapsing "cookie valid but a live Yahoo call failed" into the same `connected: false` as "no cookie," causing the connection banner to flicker between connected/disconnected on transient network errors — fixed to trust the cookie and treat the profile-name lookup as best-effort. All six Yahoo API routes (`sync-rosters`, `settings`, `my-leagues`, `league`, `league-full`, `sync-draft`) also had no top-level error handling, so any Yahoo failure crashed into Next's HTML error page instead of clean JSON — fixed across all six.

**Prerequisite:** Y-01 ✓, Y-02 ✓, Y-04 ✓

---

### Start/Sit Advisor · UAT — ✅ passed 2026-07-24

Endpoint logic was verified end-to-end against real `players.json`/`mlb_players.json` data and live Claude calls (not just curl against synthetic fixtures) — including catching and fixing three real model-output bugs (duplicate player across two slots, position-ineligible placements, an eligibility violation that survived the first fix and needed a server-side validation pass). `npm run test:schedule` covers the pure date-math. The remaining browser/UI pass (NBA + MLB panels, empty states, repeat-refresh stability) was confirmed by the user 2026-07-24 — Y-05 status table updated accordingly.

---

### Trade Analyzer · UAT (pending — needs a browser pass)

`getTradeAdvice()` was smoke-tested end-to-end via a synthetic roster payload (curl, not the browser) — real Claude call, correct JSON shape, sensible verdict/category/positional/buy-sell reasoning. What's *not* yet verified — the part that needs the actual UI and a real synced league:

- [ ] Season Hub — enter a real give/receive from your own MLB league roster, confirm loading/error states match the other panels and a real verdict renders (badge color, category badges, positional/buy-sell notes)
- [ ] Enter a player NOT on your roster as "give" — confirm the clean 400 error ("These aren't on your roster: ...") surfaces in the UI instead of a generic failure
- [ ] Enter "receive" players split across two different opposing teams — confirm the clean error ("Couldn't find a single team rostering all of: ...") surfaces correctly
- [ ] Confirm an NBA league works the same way once one is synced (endpoint is sport-agnostic via `getPlayerFile`/`getSportConfig`, but only tested against MLB data so far)
- [ ] Refresh with a different give/receive combo on the same league — confirm no stale state bleeds from the previous query

Once this passes, flip the Y-05 status table's Trade analyzer row to "✅ UAT complete".

---

### Y-05d · Yahoo API League-Scope Throttle (found 2026-07-24)

**Symptom:** the MLB league (`469.l.209547`) started returning 403 "This application is not authorized to perform this action" on `/league/{key}/settings` and `/league/{key}/scoreboard` (via Matchup Advisor) and on the roster/standings calls behind Season Hub's "Refresh" button (`sync-rosters` — surfaced client-side as a confusing `Unexpected token '<'` JSON-parse error before the error-handling fix below). Basic account-level calls (`/users/games`, used by the connection-status check) kept working throughout.

**Likely cause:** a burst of OAuth reconnects (5+ code exchanges) plus `/me` polling in quick succession during same-session debugging of an unrelated connection-status bug (see fix below) — this pattern is consistent with a transient app/account-level Yahoo rate-limit, not a real permissions or code bug. Not confirmed with certainty since Yahoo doesn't document this behavior.

**Fixed in the same session (real bugs, unrelated to the throttle itself):**
- `pages/api/auth/yahoo/me.js` was collapsing "cookie valid but a live Yahoo verification call failed" into the same `connected: false` as "no cookie at all" — this caused the home page's connection banner to flicker between connected/disconnected on ordinary transient network errors. Fixed to trust a valid cookie as connected regardless of whether the best-effort screen-name lookup succeeds.
- All six Yahoo API routes (`sync-rosters`, `settings`, `my-leagues`, `league`, `league-full`, `sync-draft`) had no top-level error handling — any Yahoo failure crashed into Next's HTML error page instead of returning clean JSON, which is what produced the `Unexpected token '<'` symptom. Fixed across all six to return `502 { error }`.

**Still open:**
- [ ] Retest `/league/469.l.209547/settings`, `/scoreboard`, and Season Hub's roster "Refresh" after a cooldown period (try 30–60 min, longer if still failing) — confirm whether the 403s clear on their own
- [ ] If still failing after a real cooldown, investigate further (wrong/stale `yahooLeagueKey`, league-level Yahoo privacy/API-access setting, or an app-level Yahoo Developer Console flag) rather than assuming rate-limit
- [ ] Once resolved, re-run the Head-to-Head Matchup Advisor UAT pass specifically against this MLB league to confirm the status table's "✅ UAT complete (NBA) — ⚠️ MLB blocked" caveat can be cleared

---

### Trade Value Index · UAT (pending — needs a browser pass)

`getTradeValueIndex()` was smoke-tested via a synthetic 3-team roster payload (curl) — real Claude call, correct JSON shape, and a real model-output bug (self-suggested buy-low target) was caught and fixed with a server-side filter. What's *not* yet verified — the part that needs the actual UI and a real synced league:

- [ ] Season Hub — click "Get Beane's Take" on a real MLB league with 2+ synced opponent rosters, confirm sell-high and buy-low sections render correctly with real player data
- [ ] Confirm the empty state ("No standout sell-high or buy-low signals this week") renders sanely rather than a blank panel when the model returns nothing notable
- [ ] Confirm no buy-low target ever lists the user's own team — the server-side filter should make this structurally impossible, but worth a real-data check since the synthetic test only had 3 players per team
- [ ] Confirm an NBA league works the same way once one has 2+ synced opponent rosters

Once this passes, flip the Y-05 status table's Trade value index row to "✅ UAT complete".

---

### League Pulse · UAT (pending — needs a browser pass)

`getLeaguePulse()` was smoke-tested via the same synthetic 3-team payload — real Claude call, correct JSON shape, sensible standings-aware reasoning. What's *not* yet verified:

- [ ] Season Hub — click "Get Beane's Take" on a real MLB league, confirm dominating/rebuilding/trade-opportunities sections render correctly against real standings and rosters
- [ ] Confirm behavior with a 2-team-only edge case isn't broken (the endpoint requires 2+ teams — verify the error message is legible if a league somehow syncs with fewer)
- [ ] Confirm an NBA league works the same way once synced

Once this passes, flip the Y-05 status table's League pulse row to "✅ UAT complete".

---

### Y-05c · MLB Pitcher Probable-Start Tracking
**Goal:** Sharpen the Start/Sit Advisor's MLB pitcher signal. Deferred out of the initial Start/Sit Advisor build (2026-07-07) because it's a fundamentally different data problem from the NBA/MLB team-schedule work that ticket shipped.

**Why this is separate:** MLB hitters play ~6 games/week almost every week (162g/~26wk), so team-schedule density isn't a differentiating signal for hitters — the schedule-file approach already covers them fine. The real MLB lineup lever is pitcher probable starts (a 1-start vs. 2-start week is the single biggest swing in a category league), but starting rotations are only announced ~5 days out — not known for a full season the way team schedules are. That makes this a weekly dynamic-data problem much closer to `mergeCurrentSeasonData.js`/Hermes than the ship-once `mlb_schedule.json` file.

**Current state:** the Start/Sit Advisor already runs for MLB using team-schedule games-this-week as an approximate proxy for pitcher starts, with an explicit lower-confidence caveat in the Claude prompt. This ticket is about replacing that proxy with real data, not unblocking MLB (it's already unblocked).

**Prerequisite:** a probable-starts data source (Hermes or similar) + a weekly ingestion script analogous to T1-2/`mergeCurrentSeasonData.js`.

---

---

## Current Season Data Model (T1) + AI Integration (T2) + Email (T3)

*Added 2026-06-30. These take priority over Y-05 start/sit and trade analyzer. T1 → T2 → T3 in sequence; T1 and T3 do not depend on each other and can be parallelized.*

*Note on T3 vs PMF-05: PMF-05 (deferred) is freemium commercial email capture infrastructure. T3 is email as a product feature for personal in-season use — waiver wire digest and draft recap. Architecturally distinct, scoped for personal use now, not gated behind a paywall.*

---

### T1-1 · Current Season Data Schema

**Goal:** Extend the player data model to support a current-season snapshot alongside the frozen prior-season stats.

**Schema to add — `current_season` object per player:**
```json
"current_season": {
  "as_of_date": "2026-11-15",
  "pts": 14.2,
  "reb": 6.1,
  "ast": 4.8,
  "stl": 1.1,
  "blk": 0.6,
  "to": 2.9,
  "fg_pct": 0.471,
  "ft_pct": 0.802,
  "three_pm": 1.8,
  "gp": 12,
  "trend": "declining",
  "source": "hermes_weekly_pull",
  "note": null
}
```

**Field notes:**
- `as_of_date` — required, always present; used for staleness transparency in UI and AI prompts
- `trend` — one of `"improving" | "stable" | "declining"` — computed in this codebase (T1-3), not set externally
- `source` — `"hermes_weekly_pull"` or `"manual_entry"` — provenance tracking for data quality debugging
- `note` — nullable, reserved for future use (e.g. "role change", "injury return"); leave null, no UI needed yet

**Storage:** `current_season` is an optional/nullable field on each player object in `players.json`. All existing reads must handle `null` gracefully.

**Acceptance criteria:**
- [x] Schema documented (players.json or schema reference file — match existing project convention)
- [x] At least 5 sample players manually populated with `current_season` data for testing
- [x] Draft board, recommendations, and Season Hub do not break when `current_season` is null — verified: all consumers (PlayerPool, RecommendationPanel, RosterView, DraftComplete, DraftRecap, scarcity.js, matchup-advice.js, waiver-advice.js, recommend.js) destructure specific fields or route through `formatStats()`/`enrichRoster()`, never serialize full player objects

---

### T1-2 · Data Ingestion / Merge Script

**Goal:** Build a CLI script that safely merges incoming current-season snapshots into `players.json` without touching any other field.

**Input shape:**
```json
{
  "as_of_date": "2026-11-15",
  "players": [
    { "id": "nikola-jokic", "pts": 27.1, "reb": 13.2, ... }
  ]
}
```

**What to build:** `scripts/mergeCurrentSeasonData.js`, runnable as:
```
node scripts/mergeCurrentSeasonData.js path/to/incoming-data.json
```

**Behaviour:**
- Validates incoming file against T1-1 schema — rejects and logs clearly if malformed (before any writes)
- Matches players by `id` field
- On match: updates `current_season`, sets `source: "hermes_weekly_pull"`, computes `trend` (T1-3)
- On no match: skips with a warning log, continues processing the rest (do not fail the batch)
- Writes updated `players.json` back to disk
- Outputs a clear console summary: players updated, players skipped with reasons, validation errors

**Critical safety:** Script must NEVER modify `prior_season`, `adp`, `injury_risk`, or any other existing field — only `current_season`. A test must verify this.

**Acceptance criteria:**
- [x] Runs from command line with a file path argument
- [x] Successfully matches and updates players by ID
- [x] Unmatched players skipped with warning, no crash
- [x] Malformed input rejected before any writes
- [x] No field other than `current_season` is ever modified — verified with a test
- [x] Console summary is clear and scannable
- [x] Test run with: valid players + one unmatched ID + one malformed entry — all three cases handled correctly in one run

**Implemented:** `scripts/mergeCurrentSeasonData.js` + `npm run merge-current-season -- <file>`. Tests in `scripts/test/mergeCurrentSeasonData.test.js` (`npm run test:merge-current-season`), including a CLI integration test against temp files.

---

### T1-3 · Trend Calculation Logic

**Goal:** Pure function that computes whether a player is trending up, down, or stable vs. their prior-season baseline.

**Signature:** `calculateTrend(priorSeason, currentSeason, profile?)` → `"improving" | "slightly-improving" | "stable" | "slightly-declining" | "declining"`

**Logic:** Compare weighted core stats (`pts`, `reb`, `ast` as primary signal for NBA — most stable cross-position indicators; sport-specific profiles for MLB, see T1-3 follow-up below). Deviation beyond `TREND_THRESHOLD` (15%) in either direction = full `"improving"`/`"declining"`; beyond `TREND_MINOR_THRESHOLD` (5%) but not 15% = `"slightly-improving"`/`"slightly-declining"`; otherwise `"stable"`. Both thresholds are named constants, not magic numbers.

**Called from:** Inside the T1-2 merge script, every time a player's `current_season` is updated.

**Acceptance criteria:**
- [x] Function is pure and unit-testable (no side effects, no API calls)
- [x] Test cases: significantly improving, significantly declining, roughly stable, slightly improving, slightly declining
- [x] Threshold is a named constant (e.g. `TREND_THRESHOLD = 0.15`, `TREND_MINOR_THRESHOLD = 0.05`)

**Implemented:** `scripts/calculateTrend.js`. Built alongside T1-2 since the merge script has a hard dependency on it. Tests in `scripts/test/calculateTrend.test.js` (`npm run test:calculate-trend`).

**T1-3 follow-up (2026-07-06) — MLB support + 5-tier granularity:** Original implementation was NBA-only (`pts`/`reb`/`ast` hardcoded) and only had a single ±15% threshold, so any real-but-modest movement (e.g. a player quietly trending up 8%) read identically to a player with zero change — both showed `"stable"`. Fixed in the same session as the MLB data pipeline bug fixes (see `bugreport.md` #6):
- Added `TREND_PROFILES` (`nba`, `mlb_hitter`, `mlb_pitcher`) so MLB players get a real signal instead of always defaulting to `"stable"`.
- `hr`/`rbi`/`k` are season-to-date totals, not rates — normalized to per-game rates before comparison (`mergeCurrentSeasonData.js`'s `buildTrendInputs()`) so a partial current season doesn't read as "declining" against a full prior season purely from fewer games played.
- Pitcher profile (`era`/`whip` sign-flipped, lower-is-better) uses an averaged per-stat percentage deviation rather than one summed-total deviation — summing a sign-flipped stat against a "higher is better" one could push the total negative and invert the result for small samples (caught via Carlos Estévez: a disastrous 1-game outing was initially reading as `"improving"`).
- Added `TREND_MINOR_THRESHOLD = 0.05` and the `"slightly-improving"`/`"slightly-declining"` tiers on top of the fixes above.
- UI: `TREND_STYLES` in `pages/season.jsx` renders `↗`/`↘` at 70% opacity for the slight tiers vs. full-strength `↑`/`↓` for the significant ones.
- AI prompts: `waiver-advice.js`'s system prompt now references `slightly-improving` explicitly and instructs the model to treat the slight tiers as real-but-modest, not noise and not full-strength.
- Real MLB data distribution after this fix (293 players): 52 improving, 26 slightly-improving, 58 stable, 47 slightly-declining, 110 declining.

---

### T2-1 · Inject Current Season Data into AI Prompts

**Goal:** Make waiver wire, trade analyzer, matchup, and start/sit advisors aware of both prior-season baseline and current-season performance.

**Applies to:** Waiver wire advisor, trade analyzer, matchup advisor, start/sit advisor. Does NOT apply to draft-day engine — that is correctly scoped to `prior_season` + ADP only.

**Per-player data block to add to prompts:**
```
Player: [name]
Prior season average: [prior_season stats summary]
Current season average (as of [as_of_date], [gp] games played): [current_season stats summary]
Trend: [trend]
```

**Reasoning instruction to add:**
> When current_season data is available, reason explicitly about any gap between prior_season and current_season performance. Consider: buy-low opportunity (underperforming, likely to regress upward), genuine decline (role change/age/injury, likely to continue), or sell-high opportunity (overperformance unlikely to sustain). If current_season is unavailable or as_of_date is more than 14 days old, note that the assessment is based on prior season data only.

**Acceptance criteria:**
- [ ] Trade analyzer visibly references current vs. prior season gaps when `current_season` exists for involved players — **deferred**, trade analyzer doesn't exist yet (Y-05 tier-4, own sprint). Apply this same pattern (`formatCurrentSeasonLine` + `CURRENT_SEASON_REASONING_INSTRUCTION` from `src/ai/seasonStats.js`) when it's built.
- [x] Start/sit advisor weighs current-season form alongside prior-season baseline when recommending a weekly lineup — implemented 2026-07-07, uses the same `formatStats`/`formatCurrentSeasonLine`/`CURRENT_SEASON_REASONING_INSTRUCTION` from `src/ai/seasonStats.js` as the other two advisors.
- [x] Waiver wire advisor surfaces trending players appropriately
- [x] `current_season: null` falls back to prior season gracefully — no broken prompt text
- [x] Staleness check: if `as_of_date` is 14+ days old, recommendation includes a staleness caveat

**Implemented:** Extracted shared `src/ai/seasonStats.js` (`formatStats`, `formatCurrentSeasonLine`, `CURRENT_SEASON_REASONING_INSTRUCTION`, `STALENESS_DAYS = 14`) — both `waiver-advice.js` and `matchup-advice.js` already duplicated `formatStats`/`fmt`, so the new current-season logic was added there once instead of tripling the duplication. Each roster/FA line now gets a `CURRENT (as of ..., N GP, trend[, STALE])` suffix when `current_season` exists; staleness is computed server-side (not left to the model) and tagged inline. Verified against the 5 real sample players (Jokic/Wembanyama/SGA/Luka/Embiid) — trend labels and stale-tagging both correct.

---

### T2-2 · Surface Trend and Staleness in UI

**Goal:** Make current-season data and its freshness visible in Season Hub wherever player data is shown.

**What to build:**
- Trend arrow/icon (↑ / → / ↓) next to player name when `current_season` exists
- Small "Stats as of [date]" text near any current-season figures shown
- If `current_season` is null or stale (14+ days old): subtle "prior season data" label

**Design constraint:** Lightweight — small badge/icon addition, not a screen redesign.

**Acceptance criteria:**
- [x] Trend indicator visible next to relevant players in Season Hub views
- [x] "Stats as of [date]" shown wherever current_season figures are displayed
- [x] Stale or missing data clearly distinguished from fresh data
- [x] No layout breakage on existing Season Hub screens

**Implemented:** `TrendBadge` in `pages/season.jsx`, wired into the Waiver Wire Advisor's add/drop player names — the only place individual player names actually render in the current Season Hub (the Y-04 "standings table with expandable rosters" described in this backlog doesn't exist in `season.jsx` as written; the Matchup Advisor only shows category win/lose/tossup badges, no per-player rows). Renders `↑/→/↓ {date}` colored by trend, muted gray + `stale·{date}` prefix when `as_of_date` is 14+ days old (reuses `STALENESS_DAYS` from `src/ai/seasonStats.js`), nothing at all when `current_season` is null — chosen over an explicit "prior season data" label everywhere since only 5/350 players currently have a snapshot and badging all the rest would violate the "lightweight, not a redesign" constraint. Player names are matched back to `players.json` via a shared `normalizeName` (extracted to `src/utils/playerName.js`, deduplicating what `waiver-advice.js`/`matchup-advice.js` each had inline). Verified via a real `/api/season/waiver-advice` call (no Yahoo needed) — Claude recommended Wembanyama/SGA citing their actual current-season numbers, and both names resolved to correct badges (↑ green, → gray). Caught and fixed a real timezone bug in the process: `toLocaleDateString` without `timeZone: 'UTC'` shifted date-only strings back a day on this UTC-6 machine.

Start/sit advisor and trade analyzer don't exist yet — apply the same `TrendBadge` pattern when those are built (see T2-1's deferred notes).

---

### T3-1 · Resend Integration via Serverless Function

**Goal:** Email sending capability as a serverless function, following the same security pattern as `/api/recommend`.

**What to build:**
- New function: `pages/api/send-email.js`
- Accepts: recipient email, subject, body (HTML or plain text), email type identifier for logging
- `RESEND_API_KEY` in Vercel env vars — never client-side exposed
- Manual step: create Resend account and obtain API key

**Acceptance criteria:**
- [ ] Test email successfully sends to a real address — **not yet verified against a real Resend account**; no `RESEND_API_KEY` configured locally. Endpoint is built and validated end-to-end except for the live Resend call.
- [x] API key not exposed in any client-side code or network request
- [x] Function returns clear success/failure response
- [x] Failed sends logged with enough detail to debug

**Implemented:** `src/server/email.js` (`sendEmail({ to, subject, html, type })`, lazily constructs the Resend client so a missing `RESEND_API_KEY` is a caught, JSON error rather than a process-level crash at import time) + `pages/api/send-email.js` (validates `to`/`subject`/`body`, delegates to `sendEmail`). `RESEND_API_KEY` / `RESEND_FROM_EMAIL` added to `.env.example`. Verified locally: missing key, invalid email, and missing fields all return clean `{ error }` JSON with matching status codes instead of a Next.js crash page.

---

### T3-2 · User Email Storage (Personal Use)

**Goal:** Store an email address per user so PocketBeane knows where to send digests.

**What to build:** Simple email input in a settings/profile area. Stored in localStorage alongside existing PocketBeane state. Optional — Season Hub functions fully without one set.

**Acceptance criteria:**
- [x] User can enter and save an email address in settings
- [x] Email persists across sessions via localStorage
- [x] No email set → digest emails simply don't send; no broken states

**Implemented:** `src/utils/userSettings.js` (`getUserEmail`/`saveUserEmail`/`clearUserEmail`, `localStorage` key `pocketbeane_user_email` — same pattern as `gmProfile.js`). New `EmailDigestSettings` card on `/gm-profile` (a global, not per-league, settings area — matches how GM Profile itself is scoped) with edit/save/clear and inline validation. Waiver Wire Advisor on Season Hub reads `getUserEmail()` and shows an "Add your email" prompt linking to GM Profile instead of a send button when none is set.

---

### T3-3 · Monday Morning Waiver Wire Digest Email *(priority)*

**Goal:** Deliver waiver wire recommendations to the user's inbox — the highest-value email use case from PMF research.

**What to build:** Manual trigger button in Season Hub: "Email me this week's waiver wire recommendations". Button triggers existing waiver wire advisor logic, formats output as email body, calls `/api/send-email`.

**Note on scheduling:** Do NOT build a serverless cron inside Vercel for this. Manual trigger is correct MVP scope. Automatic weekly scheduling is a future integration point (likely Hermes calling this endpoint on a schedule), not in scope here.

**Email template:**
- Subject: `"Your Week [X] Waiver Wire Picks — [League Name]"`
- Content: top 3 recommendations with one-line rationale each, league name clearly shown
- PocketBeane voice — scannable digest, not a report

**Acceptance criteria:**
- [x] Button in Season Hub triggers digest generation and send
- [ ] Email arrives with correct, current waiver wire recommendations — logic verified end-to-end (real roster → Claude recs → formatted HTML), send call verified up to Resend; not confirmed against a real inbox pending a `RESEND_API_KEY` (see T3-1)
- [x] Works correctly for both leagues independently (correct league data, clearly labeled)
- [x] No email saved → button shows prompt to add email instead of failing silently
- [x] In-app confirmation shown after successful send

**Implemented:** `pages/api/season/email-waiver-digest.js` — reuses `getWaiverAdvice()` (extracted from `waiver-advice.js`'s handler so the Claude prompt/roster logic isn't duplicated), formats the top 3 moves into an inline-styled HTML email (dark theme, matches app palette), computes an ISO week number for the subject line (`Your Week [X] Waiver Wire Picks — [League Name]`), sends via `sendEmail()`. Season Hub's `WaiverPanel` gained an "Email me this week's picks" action next to the existing recs, plus inline sent/error state. Verified with real `players.json` data through to the Resend call boundary.

---

### T3-1/T3-2/T3-3 · UAT (pending — needs a live Resend key + browser pass)

Everything below the Resend send call was verified with curl (validation errors, malformed input, missing-config paths) and the waiver logic was verified end-to-end against real `players.json` data. What's *not* yet verified — the part a real user has to check in-browser and in a real inbox:

- [ ] Create a real Resend account, add `RESEND_API_KEY` (and a verified sender / `RESEND_FROM_EMAIL`) to `.env.local`
- [ ] `/gm-profile` — add, edit, and clear an email address through the actual UI; confirm it survives a page refresh (localStorage) and the invalid-email inline error shows correctly
- [ ] Season Hub waiver panel — with no email saved, confirm the "Add your email" prompt shows and links to `/gm-profile`; with one saved, click "Email me this week's picks" and confirm the in-app "Sent to …" confirmation appears
- [ ] Open the actual received email — confirm it renders sanely in at least one real client (Gmail web/app is the most likely one in practice). The template uses a dark background with inline styles; several clients (Gmail, Outlook) strip or override `<body>` background color and some apply their own dark-mode color inversion, so the as-sent look may not match the in-app dark theme — check for legibility, not just that it arrived
- [ ] Repeat the send for a second league (NBA + MLB, if both are in use) — confirm subject/league name/week number are correct per-league and nothing bleeds across leagues
- [ ] Confirm `RESEND_API_KEY` never appears in any client-side network request (Network tab, POST to `/api/season/email-waiver-digest`) — should only ever see `to`/`leagueName`/`sport`/roster data in the request body

Once this passes, flip T3-1/T3-2/T3-3's remaining unchecked acceptance criteria above and mark the trio UAT complete in the Y-05-style status table.

---

### T3-5 · Automated Weekly Waiver Digest via Hermes Cron

**Goal:** The Monday waiver wire digest (T3-3) currently requires a manual click in Season Hub every week — not useful as a season-long retention feature if the user has to remember to open the app. Make it fire automatically as part of the existing Hermes weekly pipeline (`run_weekly.py`, cron: Monday 5am, next run 2026-07-27).

**Why this isn't already wired up (found 2026-07-24):** `run_weekly.py` and `/api/season/email-waiver-digest` are two independent systems today. The cron job only refreshes `players.json`/`mlb_players.json` stats and emails *the developer* a pipeline status report via Gmail — it has never touched the digest endpoint. Two real gaps block wiring them together:
1. `/api/season/email-waiver-digest` requires the caller to hand it `leagueRosters` in the POST body — it never fetches anything itself. Only the browser (Season Hub's manual "Refresh") builds that payload today.
2. Recipient email (`getUserEmail()`) and which-leagues-to-notify live only in browser `localStorage`. There is no server-side or file-based persistence anywhere in the app for this — the whole app is currently a stateless API layer in front of a client-only store.

**Decision (2026-07-24):** the app will write its own server-side notification config automatically, rather than the user hand-maintaining a JSON file. When the user saves an email in `/gm-profile` and/or syncs a league via Yahoo, the app also persists `{ leagueKey, sport, leagueName, email }` server-side (a small JSON file alongside `src/data/`, written by a new lightweight API route — exact shape TBD at implementation time) so a non-browser process can read "who gets a digest for which league" without the browser being open.

**What still needs deciding at implementation time:**
- Whether Hermes calls a running Next.js instance (`localhost:3000` in dev, or a deployed prod URL) to reuse the existing Node/Claude waiver-advice logic as-is, vs. porting roster-fetch + name-matching + Claude-prompt + email-format logic into Python so the digest send doesn't depend on any web server being up when the cron fires at 5am (the pattern `run_weekly.py` already uses for its own Yahoo calls and Gmail send — see `yahoo_fetch()`/`send_email()`). The second is more reliable for an unattended cron but duplicates non-trivial logic across two languages.
- How multi-league / multi-sport users are handled (loop over all leagues in the config file, one digest email per league).

**Prerequisite:** T3-1/T3-2/T3-3 UAT complete (send path proven end-to-end with a real Resend key — done 2026-07-24).

---

### T3-4 · Draft DNA Recap Email *(lower priority)*

**Goal:** Automatically send the Draft DNA card recap via email after draft completion.

**Trigger:** Draft marked complete AND email already saved in settings. If no email saved, skip silently — do not interrupt the Draft Recap flow.

**Email content:** Archetype name, tagline, top category edges, bold prediction — mirrors the shareable card.

**Acceptance criteria:**
- [ ] Email sends automatically on draft completion if email is set
- [ ] Draft Recap flow completely unaffected if no email is set
- [ ] Email content matches in-app Draft DNA card

**Priority note:** Build after T3-3 is solid. The waiver wire digest is the retention driver; this reinforces the shareable draft moment but is not where core product value lives.

---

## Tier 2 — Speculative / Needs investigation

### P-01 · Premium Refresh Gate (Monetization)
**Goal:** Gate "Get Beane's Insights" manual refreshes behind a paid tier once billing infrastructure exists.

**Current state:** Free tier has a 5-refresh-per-draft budget (implemented). Counter is visible in the UI. When exhausted, button is disabled with "No refreshes remaining."

**Premium version:** Replace the disabled state with an upgrade CTA modal. Unlimited manual refreshes as a Pro feature. Budget constant (`REFRESH_BUDGET`) lives in `RecommendationPanel.jsx` — easy to raise or remove per tier.

**Prerequisite:** Billing/subscription layer (Stripe or similar). Do not build until payment infra is in place.

---

### S-01 · AI Autopick (Premium Feature Candidate)
**Goal:** When connected to an active Yahoo draft, PocketBeane selects the pick automatically based on the configured strategy.

**Status: BLOCKED — needs API research.** Yahoo's Fantasy Sports API is largely read-only. The ability to make a programmatic draft pick via the API is unconfirmed. Do not build toward this until API capability is verified.

**If feasible:** This is a premium/opt-in feature. User explicitly enables autopick mode per draft. Strategy is sourced from B-01 philosophy settings.

---

## Multi-Sport Expansion

All sport expansions require a `{sport}_players.json` file with ADP rankings and prior season stats before recommendation logic can be calibrated. The `sports.js` config already has stub entries for NHL, NFL, and MLB — the architecture is sport-config driven and ready. The Yahoo OAuth layer supports all three sports via `game_codes={sport}`.

---

### ~~MLB-01 · MLB League Support~~ ✅ DONE
Full MLB 5×5 draft experience shipped 2026-06-27. Multi-sport architecture generalized across the entire codebase — `lowerIsBetter` config field drives ERA/WHIP grading correctly; `filterPositions` drives scarcity engine; `game_codes=mlb` wired into roster sync. `mlb_players.json` built from FantasyPros 2026 ADP + Baseball Reference 2025 stats via `scripts/build-mlb-players.js` — 300 players (181 hitters, 119 pitchers), 28 rookies/injured included with `prior_season: null` so they appear on board by ADP.

---

### NHL-01 · NHL League Support
**Status: Blocked on data — nhl_players.json needed (August 2026)**

**Goal:** Full NHL draft experience using the existing sports.js stub as the foundation.

**Complexity note:** Goalies and skaters have completely separate stat profiles. The category grading engine will need to handle `sv_pct` as a percentage category and `gaa` as a lower-is-better category. The `G` position (goalie) has no overlap with skater positions — slot logic must treat them as distinct pools.

**What's needed:**
- `nhl_players.json` — skaters + goalies, 2026-27 projected ADP + 2025-26 prior season stats
  - Source: FantasyPros NHL ADP (August), Hockey Reference (per-game stats)
- `sports.js` NHL config entry (stub already commented in):
  - `filterPositions: ['C', 'LW', 'RW', 'W', 'D', 'G']`
  - Skater categories: `G`, `A`, `+/-`, `PIM`, `PPP`, `SHP`, `SOG`
  - Goalie categories: `W`, `GAA`, `SV%`, `SO`
  - `percentageCategories: ['sv_pct']`
  - `lowerIsBetter: ['gaa']`
- Claude prompt tuning for NHL context (goalie streaming, early-season regression, etc.)
- `sync-rosters.js` game_codes=nhl variant

**Testing constraint:** No completed NHL league available. End-to-end validation requires a test draft or an active league. October 2026 season start = first real test window.

**Timing:** Data available August 2026. Build alongside PMF-08 data refresh sprint.

---

### NFL-01 · NFL League Support
**Status: Blocked on data — nfl_players.json needed (August 2026)**

**Goal:** Full NFL draft experience — same structure as NHL, same timeline.

**Complexity note:** NFL has the most position heterogeneity of any sport. QB is a completely separate stat pool (passing yards, TDs, INTs, rushing). K and DST are streaming positions that change weekly. Bye weeks add lineup complexity that doesn't exist in NBA/NHL. Standard scoring vs. PPR vs. half-PPR creates divergent ADP curves — need to decide which format to target first (PPR is the most common).

**What's needed:**
- `nfl_players.json` — ~200 relevant skill-position players, PPR ADP + 2025 season stats
  - Source: FantasyPros NFL ADP (August), Pro Football Reference
- `sports.js` NFL config entry (stub already commented in):
  - `filterPositions: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'FLEX', 'BN']`
  - Scoring format: PPR (first pass), with `scoringFormat` config supporting `ppr | half_ppr | standard`
  - Point categories (NFL is typically points-based, not category): `pts`, `passYds`, `rushYds`, `recYds`, `passTDs`, `rushRecTDs`
- Claude prompt tuning for NFL draft strategy (Zero RB, Hero RB, Robust RB, TE-premium)
- `sync-rosters.js` game_codes=nfl variant

**Testing constraint:** No completed NFL league available. September 2026 draft window is the first test opportunity.

**Timing:** Data available August 2026. Build alongside PMF-08 and NHL-01 data sprint.

---

## Platform & Design

---

### D-01 · Full App UI Revamp
**Status: No external dependency — can start any time; research component required**

**Goal:** Overhaul the visual identity of PocketBeane from the current monochrome Tailwind default into a polished, premium sports analytics product.

**Current state:** Dark background + single green accent (`#22c55e`, Tailwind `green-500`), monospace typography for data labels, no imagery, no logo beyond the wordmark. Functional but not visually distinctive.

**What this covers:**

| Area | Current | Target |
|---|---|---|
| Color palette | Single green on dark | Proper design system — primary, accent, muted, destructive tokens |
| Imagery | None | Player silhouettes, sport-specific backgrounds, hero moments |
| Typography | System font + mono for data | Sports-appropriate type scale — distinct heading vs. data vs. body |
| Logo/wordmark | Plain text "PocketBeane" | Refined mark with optional icon |
| Card system | Uniform surface/border pattern | Differentiated cards for draft board, recommendation panel, DNA card |
| Mobile | Responsive but unstyled | Intentionally mobile-first layouts for Season Hub and Draft DNA share card |

**Research component (do this first):**
Before touching code, define the visual direction:
- Reference apps: The Athletic, ESPN Fantasy, Stathead, Underdog Fantasy, Sleeper
- Decide: sports-data minimal (high info density, monochrome) vs. brand-forward (team colors, hero imagery) vs. premium analytics (dark glass, gradient accents)
- Mood board → token decisions → then code

**Acceptance criteria:**
- New color token system defined and applied globally (Tailwind config updated)
- At least one imagery element on the home/draft screen
- Draft DNA card looks polished enough to share publicly
- Typography hierarchy is clear across all major screens
- Passes a11y contrast check on all primary text

**Note:** This should happen before any public-facing launch or sharing push. The Draft DNA share card in particular will represent the app to anyone outside who receives it.

---

## Completed (archived reference)

| Item | Notes |
|---|---|
| React/Next.js scaffold | Week 1 |
| `players.json` — 199 players | Week 1, needs 2026 ADP refresh in August |
| League setup + switcher | Week 2 |
| Player pool — filterable, searchable | Week 2 |
| Draft board + pick flow | Week 3 |
| Keyboard shortcuts (U, O, ↑↓, /, Enter, Z) | Week 3 |
| Roster view + category totals | Week 3 |
| Snake order calculator | Week 3 |
| Client-side AI engine (Steps 1–4) | Week 4 |
| Claude API proxy (`/api/recommend.js`) | Week 4 |
| Beane's Take recommendation panel | Week 4 |
| Recommendation caching | Week 4 |
| Turn indicator, shortcuts modal, DraftComplete screen | Polish sprints |
| B-01 · Pre-Draft Philosophy Engine | Beane Mode preset + custom strategy settings; localStorage per league |
| B-02 · Sleeper Pick Radar | ADP gap + contract year signals; collapsible panel in recommendation UI |
| B-03 · Draft Recap | "Get Recap" on DraftComplete screen; Claude call capped at 700 tokens |
| Y-01 · Yahoo OAuth 2.0 Integration | Done — HTTPS local dev (mkcert + cross-env NODE_OPTIONS), AES-256 encrypted cookie, auto-refresh, Connect/Disconnect UI on home page |
| Yahoo API data layer | Done — `/api/yahoo/league.js` + `/api/yahoo/league-full.js`; fetches settings, standings, rosters, full 156-pick draft board from TriStar Reboot (466.l.22207) |
| Y-02 · League Selection After Auth | Done — setup page dropdown + home page auto-match via `/api/yahoo/my-leagues` |
| Y-06 · Draft History Recap Page | Done — `DraftComplete.jsx`: roster table, category report, Beane's Season Outlook |
| Y-07 · League Context in AI Recommendations | Done — `/api/yahoo/settings.js` endpoint; "Sync from Yahoo" in setup page; statCategories + rosterPositions threaded into Claude prompt; hardcoded 9-cat string replaced with dynamic scoring line |
| PMF-01 · Rate Limiting on /api/recommend | Done — 50 calls/session cap, X-Session-Id header, HTTP 429 on breach |
| PMF-02 · Philosophy First-Visit Onboarding Quiz | Done — PhilosophyQuiz overlay, GM Profile page, per-league overrides, profile injected into all Claude calls. Quiz vocabulary aligned with league setup fields (conservative/moderate/aggressive, beane/balanced/stars-and-scrubs/punt). New league setup seeds philosophy from completed profile. |
| PMF-04 · Draft DNA System | Done — Spotify Wrapped-style archetype identity system. 9 archetypes (Moneyball GM → Contrarian catch-all) classified from ADP deltas, category grades, and GM profile. DraftDNACard modal auto-shows on first draft completion; re-openable via button below Category Report. Bold prediction via Haiku API, cached in league state. Web Share API primary; clipboard fallback with "Copied!" state. DraftRecap.jsx replaces DraftComplete.jsx. |
| PMF-04 UAT polish (2026-06-27) | Setup page: Yahoo Sync reordered before League Name; already-synced Yahoo leagues disabled in dropdown. DraftDNACard: share redesigned to Web Share API only (no hardcoded social buttons). Category Report reverted to original bar-chart. Moneyball GM threshold raised 3→4 value picks. classifyDraftDNA emits console.debug for every archetype evaluated. Archetype distribution silently tracked in localStorage key pocketbeane_archetype_stats. |
| Y-04 · Post-Draft Roster Sync | Done — `/api/yahoo/sync-rosters` fetches all team rosters + standings in parallel, name-matches to players.json IDs, stored as league.leagueRosters. Season Hub rebuilt: standings table with expandable rosters, user's team highlighted and auto-expanded, Refresh button for in-season updates. |
| MLB-01 · MLB League Support | Done — full 5×5 draft + recommendations + Draft DNA + Season Hub sync. `lowerIsBetter` config field, sport-aware scarcity, 300-player `mlb_players.json` (FantasyPros 2026 ADP + BBRef 2025 stats). `build-mlb-players.js` script for future data refreshes. |
| MLB-01 UAT fixes + polish (2026-06-29) | `sync-draft.js` was hardcoded to NBA — fixed with `?sport=` param, `mlb_players.json`, `game_codes=mlb`. IL `SlotCountRow` max raised from 3→6 so value=4 renders correctly. `importDraft` now sets `status: 'season'` (was `'complete'`); Zustand migration v0→v1 converts existing affected leagues on first load. Setup page: sport selector moved above Yahoo Sync and filters the dropdown by sport. `yahooSeason` threaded from my-leagues response → league config for year-based archive grouping. Season Hub: standings table removed; weekly auto-sync on mount (stale after 7 days). Home page: leagues grouped by sport with section headers; archive/restore system (manual archive for `season` leagues; NBA auto-archives after 7 days inactive; restore button on archived leagues; archived grouped by year within sport). Draft DNA: `getFallbackPrediction(archetypeId, sport)` with MLB month-aware overrides; `lowGpPicks` uses `injury_risk` flag for MLB instead of gp count; `gpFloorThreshold` 70→20 for MLB; Moneyball GM threshold raised 4→5. `recommend.js`: `buildAdviceSystem(sport)` and `buildAuctionWatchingSystem(sport)` replace static constants with MLB-specific style examples. |

---

## Open items (pre-September 2026)

- [ ] Week 5 QA: full mock draft session (13 rounds)
- [ ] Week 5 QA: edge case testing (last-round pick, multi-position, full roster)
- [ ] Week 5 QA: latency benchmark — p95 < 4s for Claude recommendation
- [ ] August 2026: build Y-03 infrastructure; validate during September draft window
- [ ] August 2026: refresh `players.json` with real FantasyPros 2026 ADP export (see PMF-08)

---

## PMF Gap Tickets — Active (makes the product better)
*Added June 2026 — derived from cross-referencing PMF simulation tickets against the shipped codebase.*
*Source: "PMF Simulation Reference" section below (folded in from the former POCKETBEANE_PMF_BACKLOG.md on 2026-07-06 — see that section for the full simulation findings, pricing model, and distribution plan).*
*See DECISION note at top of file for why commercial tickets are deferred.*

Priority: 🔴 CRITICAL (pre-September) · 🟡 HIGH · 🟢 SEASON

---

### PMF-08 · August 2026 ADP/Stats Data Refresh 🔴
**PMF source:** Open question #3 in PMF backlog; open item in BACKLOG.md

`players.json` contains pre-2026-27 season data (2025-26 prior season stats, 2025-26 ADP). The September draft requires 2026-27 projections and fresh ADP rankings. Without this, all recommendation logic is calibrated to stale data.

**What to build:**
- Run `scripts/build-players.js` with fresh source files:
  - Export 2026 ADP data from FantasyPros (download as CSV in late August)
  - Export 2025-26 per-game stats from Basketball Reference (CSV export)
- Resolve name mismatches in `review.json` (output of build script)
- Update `auction_value` field for all players (auction leagues)
- Verify top 50 manually against expert consensus
- Refresh injury notes and `injury_status` fields

**Acceptance criteria:**
- `players.json` sorted by 2026-27 ADP
- Prior season stats reflect 2025-26 actuals
- `review.json` is empty (all players matched)
- Top 50 ADP spot-checked against FantasyPros consensus

**Timing:** Complete by August 28, 2026 (two weeks before typical Yahoo draft windows open).

---

## PMF Gap Tickets — Deferred (commercial product only)
*These tickets only make sense with a real user base and billing infrastructure.*
*Do not build until PocketBeane has users beyond the owner. The PMF simulation*
*and existing architecture already tell the portfolio story without these.*
*Revisit if the project goes commercial.*

---

### PMF-03 · Freemium Tier Architecture
**PMF source:** C3 (paywall moment redesign — CRITICAL for commercial launch)
**Deferred reason:** Fake paywall adds codebase complexity with no personal-use benefit.

No tier system exists. P-01 only gates the 5-refresh budget with a disabled button. The simulation validated a specific paywall architecture: feature-gating at the category gap analysis step, not an arbitrary round cutoff. The tier comparison screen must be shown before the draft starts.

**What to build:**

Free tier (Scout):
- Full draft board, player pool, ADP sorting
- Basic recommendation: Steps 1–2 only (board assessment + value identification)
- Draft board marking (available / user pick / opponent pick)
- Watermarked draft recap ("Upgrade to see your full draft grade")
- No category gap analysis, no positional scarcity engine, no synthesis (Steps 3–5)

Paid tier (GM — $19/season):
- Full 5-step recommendation engine
- Category gap analysis (Step 3)
- Positional scarcity engine (Step 4)
- Full recommendation synthesis with rationale (Step 5)
- Season management suite
- Draft recap with full category grade
- Multi-league support (up to 3 leagues)

Paywall trigger: when a free user's recommendation would include Steps 3–5, show inline locked state — "Category gap analysis is a GM-tier feature. [Upgrade to GM — $19/season]"

**Files affected:**
- New: `src/components/PaywallPrompt.jsx` — inline locked state component
- New: `src/components/TierComparison.jsx` — pre-draft tier explainer
- Modified: `src/store/leagueStore.js` — add `userTier: 'scout' | 'gm'` to state
- Modified: `pages/api/recommend.js` — accept and enforce `userTier` in request body; return partial steps for Scout
- Modified: `pages/draft.jsx` — show tier comparison in onboarding; gate recommendation steps by tier
- Modified: `src/components/draft/DraftComplete.jsx` — watermark recap for Scout tier

**Prerequisite:** Billing/subscription layer (Stripe) needed before `userTier` is production-enforced.

---

### PMF-05 · Email Capture + Resend Integration
**PMF source:** C5 (missing email capture = no re-engagement channel between drafts)
**Deferred reason:** No users to email. Revisit if the project goes commercial.

---

### PMF-06 · Post-Draft Season Onboarding Bridge 🟢
**PMF source:** S1 (post-draft dropout is a major churn driver)
**Deferred reason:** Season management suite (Y-05) must exist first for this bridge to lead anywhere meaningful.

---

### PMF-07 · Basic Analytics Foundation
**PMF source:** Finding 5 (distribution is the unsolved problem)
**Deferred reason:** You are the only user — you already know how you're using it. Revisit if the project goes commercial.

---

### PMF-09 · $4.99 Trial Tier Implementation
**PMF source:** Finding 7 ($4.99 trial tier validated — 38% of trial users upgraded to annual)
**Deferred reason:** Requires PMF-03 + Stripe + real users. Revisit if the project goes commercial.

**Prerequisite:** PMF-03 (Freemium Tier Architecture) + Stripe account setup

---

## PMF Simulation Reference
*Folded in from `POCKETBEANE_PMF_BACKLOG.md` on 2026-07-06 when the three backlog files (`BACKLOG.md`, `POCKETBEANE_PMF_BACKLOG.md`, `bugreport.md`) were merged into this single file. Original document generated June 2026 from a 5-round PMF simulation. The individual C1–C5/S1–S5 ticket write-ups from that document are not reproduced here — they're superseded by the more detailed, more current PMF-01..09 tickets above and the Y-05 sub-features table (mapping: C1→PMF-01, C2→PMF-02, C3→PMF-03, C4→PMF-04, C5→PMF-05, S1→PMF-06, S2→Y-05 waiver wire advisor + T3 email, S3→Y-05 start/sit advisor, S4→Y-05 trade analyzer, S5→Y-05 roster health score). What's kept below is the strategic context that isn't duplicated anywhere else: the findings, pricing model, distribution plan, and open questions.*

### Product & positioning
PocketBeane — a Moneyball-philosophy driven fantasy basketball GM assistant. Helps competitive multi-league players make smarter draft picks in real time, then manages the season through waiver wire, trade analysis, and start/sit decisions.

**Target customer:** Competitive multi-league fantasy basketball players with prize pools on the line. Not casual players, not novices — people who feel the cost of a wrong draft pick.

**Positioning (locked after Round 4):** "Most fantasy tools give you a list. PocketBeane gives you a call." The Moneyball identity is the moat — one opinionated recommendation with rationale, calibrated to the user's stated draft philosophy, vs. generic competitors' ranked lists.

### Round-by-round simulation results

| Round | Reached | Converted | Retained | Revenue | Key Move |
|-------|---------|-----------|----------|---------|----------|
| 1 | 220 | 1% | 55% | $15 | Baseline — unfocused |
| 2 | 280 | 6% | 62% | $57 | Narrowed ICP, pain-first messaging |
| 3 | 300 | 8% | 71% | $114 | Product paywall redesign, referral hook |
| 4 | 320 | 10% | 73% | $209 | Moneyball positioning, philosophy onboarding |
| 5 | 330 | 14% | 76% | $217 | $4.99 trial tier added |

### Key findings

1. **The draft is the acquisition event, not the product.** Season management is the product. Users who churned did so because they experienced the draft tool but never discovered the season features. → informed the T1/T2/T3 current-season-data priority and Y-05 season suite.
2. **Philosophy onboarding is the highest-converting feature.** 2x conversion rate vs. users who skipped it. → PMF-02 (done).
3. **The paywall moment was wrong.** An arbitrary round-6 cutoff felt like bait-and-switch; the correct moment is when the user actively needs category gap analysis mid-draft. → informs PMF-03 if ever built (deferred).
4. **Positioning beat pricing.** Doubling down on the Moneyball identity outperformed price-matching a cheaper competitor (8%→10% conversion on messaging alone).
5. **Distribution is the unsolved problem.** Every product/pricing metric trended correctly across 5 rounds, but retained volume plateaued at ~330/1,000 on Reddit alone. The product works; the channel is the ceiling.
6. **Email capture is missing infrastructure.** No way to own the relationship with free users between draft season and next touchpoint. → PMF-05 (deferred, commercial-only) vs. T3 (built, personal-use email digest — architecturally distinct, see T3 section note above).
7. **The $4.99 trial tier works.** 38% of trial users upgraded to annual. Framing matters: "$14 more for the full season" (net of trial paid) outperformed a cold $19 ask. → PMF-09 (deferred).

### Pricing model (validated by simulation, not yet built — see PMF-03/09, both deferred)
- **Free — Scout tier:** Draft board, Steps 1–2 recommendations, watermarked recap
- **$4.99 — Draft trial:** Full GM tier through draft + 2 weeks of season
- **$19/season — Single league GM:** Full engine, season management, one league
- **$29/season — Multi-league GM:** Full engine, season management, up to 3 leagues
- **Upgrade framing for trial users:** "$14 more for the full season" (net of $4.99 already paid)

### Distribution channels (priority order, not yet actioned)
1. Reddit — r/fantasybball, r/fantasysports (credibility-first: post analysis content, mention PocketBeane as context, not spam)
2. Fantasy basketball podcasts — pitch as guest: "I built a Moneyball draft tool and used it in my own leagues"
3. Fantasy sports YouTube — mid-tier channels (10–50k subs) are more accessible and highly engaged
4. Leaguemate referral — shareable draft recap card (PMF-04, done) is the mechanic
5. Twitter/X — fantasy basketball community is active during draft season

**Distribution reality check:** One podcast appearance or one viral Reddit post during draft season is worth more than months of incremental funnel optimization.

### Open questions from the original simulation doc
1. Yahoo OAuth priority relative to season management — resolved: OAuth (Y-01/Y-02/Y-04) shipped alongside season management, both live.
2. NHL expansion timing — tracked as NHL-01 above (blocked on August 2026 data).
3. `players.json` update cadence — tracked as PMF-08 above (August 2026 refresh).
4. Trade analyzer opponent roster data — Yahoo OAuth is live (Y-04 roster sync), so the trade analyzer (Y-05, 4th sub-feature) can use real opponent rosters instead of manual input when it's built.

---

## Data Pipeline Incident Log
*Folded in from `bugreport.md` on 2026-07-06 (filed 2026-07-06, same day). Originally scoped as 2 schema-validation fixes to unblock the MLB current-season merge script; expanded once the real scraped data was run through the pipeline and the actual failures didn't match the assumed ones. All items below are fixed except the one open action item at the top.*

**Open action item — resolved 2026-07-24:** Hermes's cron job (`~/.hermes/cron/jobs.json`, "PocketBeane Weekly Pipeline") calls `scripts/run_weekly.py` directly against this repo, not a separate copy — so fixes #3/#4 below can't drift out of sync. No action needed.

**New open action items (2026-07-24) — both deferred until after the first real Hermes cron run, 2026-07-27:**

- [ ] **P-02 · MLB current-season stats never actually refresh.** `scrape_mlb.py` reads static local `bbref-batting.html`/`bbref-pitching.html` snapshots (last downloaded 2026-07-06) — nothing anywhere re-downloads them. The Hermes cron job created 2026-07-24 has never run yet (`last_run_at: null`, next run 2026-07-27 5am); once it does, it'll stamp a fresh `as_of_date` on `current_season` while the underlying batting/pitching numbers are still frozen from July 6 — worse than today's visible staleness, since the "STALE" UI tag would disappear even though the data hasn't moved. Real fix: replace the Baseball-Reference HTML source with the MLB Stats API (`statsapi.mlb.com/api/v1/stats?stats=season&group=hitting|pitching&sportId=1&season=...`), same approach as the `fetch_mlb_schedule.py` fix shipped today — a comparable-sized task, not a quick patch. Requires remapping API field names to the `build_hitter()`/`build_pitcher()` shape `mergeCurrentSeasonData.js` and `calculateTrend.js` already expect.
- [ ] **P-03 · `run_weekly.py` has no Yahoo token refresh.** `load_yahoo_tokens()` reads whatever access token is cached in Hermes's `auth.json` and uses it as-is — no refresh call, unlike the app's own `getValidToken()` in `src/utils/yahooAuth.js` which auto-refreshes within 5 minutes of expiry. Access tokens are short-lived (~1hr); confirmed expired when checked 2026-07-24 mid-afternoon against a token last touched that morning. The playoff-status check (`should_skip_playoffs`) fails gracefully when this happens (treated as "can't verify, proceed anyway"), so it won't surface as an error in the weekly summary email — it'll just silently never run most weeks. Fix: port the refresh-token flow from `yahooAuth.js` into `run_weekly.py` (same OAuth2 refresh-token grant against `api.login.yahoo.com/oauth2/get_token`).

Check both against Monday's (2026-07-27) actual run output before deciding how to fix — see what really breaks in practice rather than guessing further.

**Result after all fixes:** 293 players updated / 0 skipped / 0 invalid (`data-updates/mlb-current-season-2026-07-06.json` → `src/data/mlb_players.json`). Test suite: 36/36 passing (`calculateTrend.test.js` 17/17, `mergeCurrentSeasonData.test.js` 19/19).

1. **`VALID_INJURY_STATUSES` didn't accept `null`** [PocketBeane, `scripts/mergeCurrentSeasonData.js`] — `null` (injury page unavailable during scraping) was rejected by `validatePlayerEntry`. Added `null` alongside `'healthy'`/`'day-to-day'`/`'out'`. Note: `'il'` was never actually in the array despite being assumed present in the original task description — not added since it wasn't part of the requested change.

2. **`scrape_mlb.py` "runs" field — not actually an issue** — task description asked to rename an output field from `"runs"` to `"r"`; the scraper already output `"r"`. No `"runs"` key existed anywhere. The real bug was adjacent (#3).

3. **[Hermes] `b_runs` vs `b_r` — wrong Baseball Reference data-stat key** [`scripts/scrape_mlb.py`, `build_hitter()`] — `e.get('b_runs')` always returned `None` since that data-stat key doesn't exist in the scraped HTML (the real key is `b_r`). Produced `r: null` for all 178 hitters in the batch, correctly rejected by the required-field validator. Fixed the lookup key.

4. **[Hermes] Pitchers with few appearances misclassified as hitters** [`scripts/scrape_mlb.py`, position-detection loop] — classification required `gs > 5 or sv > 0` in the current scrape window; real pitchers returning from injury or with few appearances (Blake Snell: 1 start, Shane Bieber: 3 starts, Carlos Estévez: 1 relief appearance) fell below that and defaulted to `hitter`, producing fabricated hitter records with null rate stats. Fixed by anchoring on the authoritative `player_type` field already in `mlb_players.json`, falling back to the threshold only when `player_type` isn't already known. Recovered 10 real pitchers; each verified against real pitching lines before trusting the fix.

5. **[PocketBeane] `injury_status` read from the wrong path** [`scripts/mergeCurrentSeasonData.js`] — merge step read `entry.injury_status` (top-level, doesn't exist) instead of `entry.current_season.injury_status` (where the real value lives). Every player's injury status silently fell back to `'healthy'` even after fix #1 made `null` a valid value — the validator was checking the right path; the write step wasn't. Fix distinguishes "explicitly `null`" from "key genuinely absent" via a `!== undefined` presence check (a naive `??` fix would still coalesce an explicit `null` away, since `??` treats `null`/`undefined` identically).

6. **[PocketBeane] `calculateTrend` was NBA-only, silently wrong for MLB** [`scripts/calculateTrend.js`] — `TREND_SIGNAL_STATS` was hardcoded to `pts`/`reb`/`ast`, fields that don't exist in MLB's schema, so every MLB player's trend silently computed as `"stable"` regardless of real performance. Fixed in three parts: (a) added `TREND_PROFILES` for `nba`/`mlb_hitter`/`mlb_pitcher`; (b) normalized `hr`/`rbi`/`k` (season-to-date totals) to per-game rates before comparison, since comparing partial-season totals to a full prior season read as "declining" almost universally regardless of real form; (c) fixed a sign-flip bug where summing sign-flipped `era`/`whip` (lower-is-better) alongside "higher is better" `k` could push the total negative and invert the result for small samples (caught via Carlos Estévez: a disastrous 1-game outing initially read as `"improving"`) — fixed by averaging independent per-stat percentage deviations instead of one combined-total deviation, for any profile with `lowerIsBetter` stats.
   - **Follow-up, same session:** extended from 3 buckets to 5 — added `TREND_MINOR_THRESHOLD = 0.05` alongside `TREND_THRESHOLD = 0.15`, so real-but-modest movement (5–15% deviation) reads as `"slightly-improving"`/`"slightly-declining"` instead of being folded into `"stable"`. See T1-3 follow-up entry above for full detail (UI, prompt, test changes). Real MLB distribution: 52 improving, 26 slightly-improving, 58 stable, 47 slightly-declining, 110 declining.

7. **[PocketBeane] `mergeCurrentSeasonData.test.js` fixtures were stale** — fixtures built incoming entries with stat fields flat on the entry object; the real validator/merge logic (and real scraper output) expect stats nested under `entry.current_season.{field}`. Fixtures predated whatever change moved stats under `current_season`. Was 11/18 passing at baseline (confirmed before touching anything); fixed to 19/19.

8. **[PocketBeane] `getRequiredFields()` broken for the `nba` sport** [`scripts/mergeCurrentSeasonData.js`] — found while fixing #7, unrelated to MLB/Hermes. `SPORT_SCHEMAS.nba` is a flat array, but the branch meant to catch that checked `typeof schema === 'string'` (never true for an array). Every NBA call fell through to the object-schema branch built for `mlb`/`nhl`/`nfl`, where `Object.keys(arrayValue)` returns numeric indices and `schema[keys[0]]` returned the bare string `'pts'` — iterating a string walks its characters, so every real NBA entry would fail validation on fields named `"p"`/`"t"`/`"s"`. **This was a currently-live break in the NBA merge path**, the sport PocketBeane originally shipped with. Fixed with `Array.isArray()`. Regression test added.
