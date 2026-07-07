# PocketBeane — Active Backlog

Last updated: 2026-07-06 (T1/T2 current-season data + AI/UI integration done; T3-1/T3-2/T3-3 email digest built — send verified up to Resend, pending a real API key; MLB current-season pipeline debugged end-to-end + T1-3 trend calc extended to MLB with 5-tier granularity — see bugreport.md)

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
| Head-to-head matchup advisor | ✅ UAT complete | `/api/season/matchup-advice` — fetches scoreboard, finds opponent, Claude category-by-category breakdown |
| Start/sit advisor | Next (after UAT) | Optimal weekly lineup given schedule, matchup, recent form, injury status |
| Trade analyzer | 4th (own sprint) | Input give/receive — Claude evaluates net category impact, positional balance, buy-low/sell-high signal |
| Trade value index | Later | Running power ranking of roster trade value — who to sell high, buy low, or hold |
| League pulse | Later | Weekly league-wide summary — who's dominating, who's weak, who might be open to trading |

**Architecture:**
- Waiver advice: pure POST (no Yahoo token needed) — uses `leagueRosters` state + players.json. Sport-agnostic (nba/mlb).
- Matchup advice: POST with Yahoo token — fetches `/league/{key}/scoreboard` for current week opponent, then enriches both rosters with players.json stats.
- Both return structured JSON rendered in Season Hub panels: headline/moves for waiver, outlook/win-lose-tossup/keyNote for matchup.

**Prerequisite:** Y-01 ✓, Y-02 ✓, Y-04 ✓

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
- [ ] Start/sit advisor weighs current-season form alongside prior-season baseline when recommending a weekly lineup — **deferred**, start/sit advisor doesn't exist yet (Y-05, next sub-feature after UAT). Apply the same `src/ai/seasonStats.js` pattern when it's built.
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
*Source document: POCKETBEANE_PMF_BACKLOG.md*
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
