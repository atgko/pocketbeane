# PocketBeane — Active Backlog

Last updated: 2026-07-29 — D-01 (Full App UI Revamp) kicked off with a research brief + static mockup already written (`ui-redesign/D01_UI_REVAMP_DESIGN_BRIEF.md`, `ui-redesign/D01_MOCKUPS.html` — direction: "The Front Office," dark editorial analytics, Fraunces/Inter/JetBrains Mono, Moneyball green + brass palette). Execution is split into 9 checkpointed steps (see updated D-01 entry below for the full phase list and resume instructions); **Checkpoint 1 (Steps 1-3) is done**: token foundation (`tailwind.config.js`/`styles/globals.css` rebuilt around CSS-custom-property color tokens + `next/font`-loaded type system in `pages/_app.jsx`), a global color/font sweep across all 19 files still on the old raw-Tailwind/legacy tokens (including the 1548-line `season.jsx`, done last), and a new shared component library at `src/components/ui/` (`Card`, `Button`, `Badge`, `AdvisorCard`, `TabBar`) migrated into call sites wherever a clean fit existed. All 5 routes verified compiling; full-codebase grep confirms zero leftover raw color classes; contrast spot-checked against the brief's Part 3.1 pairs (all clear AA, `signal-down` tightest at ~4.8:1). Nothing pushed yet. Steps 4-9 (Draft DNA rebuild, Season Hub tab extraction, homepage command center, draft board refinement, a11y/mobile passes) remain, each planned separately before execution.

Previously: 2026-07-28 — Two items closed out: the two pending Y-05 re-tests (Trade Value Index trade-opportunity flags, Team Pulse's reworked `myTeamTake`) both confirmed passing in the browser — see Y-05 status table and the Trade Value Index / Team Pulse UAT sections, both now flip to a single "✅ UAT complete" line. Also fixed **P-03 · `run_weekly.py` had no Yahoo token refresh** — added `get_valid_yahoo_token()`, mirroring the refresh dance already proven in `src/utils/yahooAuth.js`/`send-waiver-digest.mjs` (refresh within 5 min of `expires_at`, persist back to `auth.json`, fall back to the stale token on any refresh failure rather than crashing the pipeline). See the Data Pipeline Incident Log section for full detail. Verified via a standalone scratch script exercising all four code paths (fresh/expiring/refresh-failure/no-refresh-token) — no pytest infra exists for this script to add a permanent test to.

Previously: 2026-07-27 (end of day) — Two separate threads of work this session, both closed out. **Full detail archived in git history / prior conversation if needed; this entry is the consolidated summary.**

**1. Y-08 · Season-Over / Off-Season Handling (see Y-08 ticket in Tier 1 for the full UAT log) — core flow done, verified against real leagues.** Discovered live via browser UAT that the Head-to-Head Matchup Advisor 403'd on a concluded NBA league, and every other season advisor (waiver wire, trade analyzer, trade value index, team pulse) kept running fine against a stale cached roster snapshot — silently burning real Claude spend on advice for a season nobody can act on. Built a full detection + gating + payoff flow:
- `sync-rosters.js`, `sync-draft.js`, and `my-leagues.js` all catch Yahoo's permanent 403 on a concluded league/season (distinct from the transient Y-05d throttle, which cleared on its own) and turn it into a clean `{ isSeasonOver: true }` signal instead of a raw error.
- Canonical flag `league.config.isSeasonOver`, settable from either the home page or Season Hub, so whichever surface finds out first informs the other.
- Season Hub replaces the whole Season Advisors block with a plain "Season complete" message (no mention of tokens/API cost — rewritten after initial copy read like an internal engineering note) — this is what actually stops every advisor's Claude call.
- A pre-existing, unrelated local "archived" concept (`league.status === 'complete'`) was found short-circuiting *before* any of this new logic could run — fixed so the archived branch checks `seasonOver` too instead of only ever showing its own older static message.
- New one-time **Season Recap** (`pages/api/season/season-recap.js`): final rank/record, category strengths/weaknesses (reusing `teamStanding.js`'s deterministic win-rate math), a Beane-voice Claude postmortem, and a 🥇/🥈/🥉 trophy for a top-3 finish — fires once per league, cached permanently, never regenerated.
- `setup.jsx`'s manual league-key entry is now greyed out and non-functional (not just a discouraging note) when the dropdown is empty because the whole sport's most recent season has concluded — a manual key can't help either, since Yahoo blocks any league from that same concluded season.
- **Confirmed working end-to-end against two real leagues**: one showed a full, well-written recap (🥈 #2 of 12, real roster-referencing postmortem); the other correctly showed no recap because its cached snapshot had already been lost earlier in the same debugging session (unrecoverable — Yahoo blocks it permanently now — but fails safely, not with an error). A third, never-before-synced concluded league confirmed genuinely un-addable via Yahoo at all (no settings data to fall back on).
- Remaining open items are all deferred to September, when the active MLB league concludes and becomes the only real way to keep testing this (see Y-08 ticket).

**2. P-02 · MLB current-season stats never actually refresh — fixed for real.** Investigating "what's next" surfaced that Hermes's weekly cron never actually fires (desktop app has to be open at 5am; `jobs.json` confirmed `last_run_at: null`) — already known and patched with a Task Scheduler backstop + double-run guard earlier the same day. But diffing that morning's manually-run output against the July 6 baseline showed every stat field byte-identical — `scrape_mlb.py` was still reading static `bbref-batting.html`/`bbref-pitching.html` snapshots that nothing had re-downloaded since July 6, so the "fix" was just re-stamping 3-week-old data as fresh (the "STALE" UI badge had already silently gone dark for every MLB player). Rewrote the scraper to pull live season stats directly from the MLB Stats API (same pattern `fetch_mlb_schedule.py` already used), keeping every output field name identical so the merge/trend code downstream needed zero changes. Verified against a throwaway copy of `mlb_players.json` first, then ran it for real: `src/data/mlb_players.json` now has genuinely fresh data (confirmed via real games-played/W-L changes and real ESPN injury notes that weren't there before). Deleted the now-unused static HTML snapshots. P-03 (no Yahoo token refresh in `run_weekly.py`) confirmed still open — next logical follow-up, not addressed this session.

Previously: 2026-07-27 (midday) — Trade Analyzer UAT passed against the real synced MLB league, closing out Y-05's last un-UAT'd sub-feature (status table now all ✅). Same session, replaced its accept/lean-accept/lean-decline/decline verdict badge with a favorScore (-100..100) rendered as a scale: "You" on the left, the opponent's team name on the right, a fixed 50/50 tick mark, a red-yellow-green-yellow-red gradient reflecting how lopsided the trade is (not which side benefits), a single marker, and a plain-language headline ("This trade favors X" / "This is a roughly even trade") — the old verdict language assumed the user was evaluating an incoming offer, which read oddly for trades the user proposes themselves. Iterated on the visual twice more from user feedback (which side "You" sits on, filled bar vs. a neutral track + marker) — each version verified live against the running dev server with real roster data and a real Claude call before committing.

Previously: 2026-07-26, second pass same day — browser UAT pass on everything shipped earlier that day. Start/Sit Advisor sport-aware split, Pitching Starts panel, and Trade Value Index (sell-high/buy-low) all confirmed working; three fixes landed from the pass: (1) Pitching Starts panel dropped a confusing internal-implementation caveat from user-facing copy and renamed `startsThisWeek` → `teamGamesThisWeek` (relabeled "Team plays N times this week") since a pitcher never starts every one of their team's games; (2) Trade Value Index's trade-opportunity flags were hitting `max_tokens` truncation ("Malformed JSON") on real league-sized output — bumped 1100 → 2000, same root cause League Pulse already hit in T3-5; (3) Team Pulse's Claude insight was too thin (one generic sentence) — `league-pulse.js` now always runs a 4th "my team take" job grounded in real win-rate data plus an approximate weeks-remaining figure, covering season narrative, strengths/weaknesses, and a playoff hold-vs-move call.

Previously: 2026-07-26, first pass (Two features shipped, neither has a browser UAT pass yet — see new UAT sections below.

(1) Start/Sit Advisor made sport-aware via a new `startSitMode` field per sport in `sports.js` (`full` / `condensed` / `pitching-starts`), with a matching `getStartSitMode()` helper: NBA/NHL condensed to 3-line-max per-player reasoning (games-this-week > injury status > recent form, no matchup prose — the model is now instructed to keep `reason` to a short recent-form-only clause, with `injuryStatus` attached deterministically server-side rather than asked of the model); MLB's positional lineup advisor removed entirely and replaced by a new **Pitching Starts** panel (`/api/season/pitching-starts`, `src/utils/pitchingStarts.js`) — deterministic (no LLM call) start/stream/hold recommendation per rostered SP from the same team-schedule-as-proxy signal `startsit-advice.js` already used for MLB; NFL kept the original full detailed treatment. NFL and NHL also got real `SPORT_CONFIGS` entries (slots/positions/categories/`startSitMode`) plus placeholder empty `{sport}_players.json`/`{sport}_schedule.json` files, so `hasScheduleSupport()` is true and the sport-aware rendering path is live, exercised code — but **`setup.jsx`'s sport picker still only offers NBA/MLB**, so no league can actually be created as NFL/NHL yet (deliberately left out of scope — see NHL-01/NFL-01, still blocked on real player data either way).

(2) Roster Health Score (never built past a "Coming Soon" placeholder) and League Pulse combined into a single **Team Pulse** panel per Season Hub league: a deterministic Contender/Playoff Bubble/Rebuilding tier + trend arrow + per-category win-rate badges for the user's team (new `src/utils/teamStanding.js`, unit-tested, no LLM call), a full league-landscape list (every team, one line each, color-coded by tier), and trade-opportunity flags (added as a 3rd job to the existing `trade-value-index.js` prompt, cross-referencing its sell-high/buy-low signal against deterministic opponent category weaknesses). `league-pulse.js`'s own calculation/prompt is untouched — Team Pulse just calls it instead of mounting its own panel, with a deterministic fallback insight (strongest/thinnest category) when the user's team isn't specifically named in its dominating/rebuilding output. `leagueStore.js` now stashes a `previousStandings` snapshot on every roster sync so the trend arrow has a real prior rank to diff against — it stays blank until a league's *second* sync (no fabricated arrow on the first).

Previously: 2026-07-24 (MLB schedule UAT fix + waiver wire ADP/asset-value awareness; Y-05 Start/Sit Advisor originally built 2026-07-07))

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

Multi-sport: MLB-01 ✅ → NHL-01 (config scaffolded 2026-07-26, still blocked on real data + setup.jsx sport picker) → NFL-01 (same, plus an unresolved roto-vs-PPR scoring mismatch to sort out first — see NFL-01).

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
| Head-to-head matchup advisor | ✅ UAT complete (NBA + MLB, 2026-07-26) | `/api/season/matchup-advice` — fetches scoreboard, finds opponent, Claude category-by-category breakdown. MLB was blocked 2026-07-24 by the Yahoo API throttle (see Y-05d, resolved 2026-07-26) — retested clean after cooldown. |
| Start/sit advisor | ✅ UAT complete (2026-07-24); sport-aware split ✅ UAT complete 2026-07-26 | `/api/season/startsit-advice` — schedule-aware (games-this-week, back-to-back), form, and injury-aware weekly lineup recommendation. Now sport-aware via `startSitMode` (`sports.js`): NFL gets the original full detailed treatment; NBA/NHL get a condensed 3-line-max version (games > injury > form, no matchup prose); MLB no longer uses this endpoint at all — see "Pitching starts panel" row below. NHL/NFL have real `SPORT_CONFIGS` entries + placeholder empty data files now (`hasScheduleSupport()` true, degrades to a clean "no games scheduled" empty state), but still can't actually be created as a league — `setup.jsx`'s sport picker is NBA/MLB only. |
| Pitching starts panel (MLB) | ✅ UAT complete 2026-07-26 (one UX fix — see below) | `/api/season/pitching-starts` (`src/utils/pitchingStarts.js`) — replaces the Start/Sit Advisor for MLB entirely (everyday hitters don't need a positional start/sit call). Deterministic, no LLM call: per rostered SP, `teamGamesThisWeek` (renamed from `startsThisWeek` 2026-07-26 — same team-schedule proxy as before, see Y-05c) + injury status → start/stream/hold. Panel now shows "Team plays N times this week" and no longer surfaces the internal proxy caveat as user-facing copy. |
| Trade analyzer | ✅ UAT complete (2026-07-27) | `/api/season/trade-advice` — `getTradeAdvice()`, pure POST like the waiver advisor (no live Yahoo call, unaffected by the scoreboard/settings throttle). Endpoint validates give against the user's roster and receive against a single opposing team's roster, then Claude evaluates net category impact, positional fit, and buy-low/sell-high signal. UI rebuilt 2026-07-26 with real roster pickers (see below); confirmed 2026-07-27 against the real synced MLB league. Same day, replaced the `accept/lean-accept/lean-decline/decline` verdict with a `favorScore` (-100..100) rendered as a scale ("You" left, opponent's team name right, fixed 50/50 tick, red-yellow-green-yellow-red lopsidedness gradient, single marker) plus a plain-language headline ("This trade favors X" / "This is a roughly even trade") — the old verdict language assumed the user was evaluating an incoming offer, which read oddly for trades the user proposes themselves. |
| Trade value index | ✅ UAT complete (sell-high/buy-low ✅ 2026-07-26; trade-opportunity flags re-test ✅ 2026-07-28, after the `max_tokens` fix) | `/api/season/trade-value-index` — `getTradeValueIndex()`, pure POST (no live Yahoo call). Scans the user's own roster for sell-high candidates (current-season overperformance vs. baseline/ADP) and every other team's roster for buy-low targets (real pedigree, depressed current trend). Caught and fixed a real model-output bug in testing: Claude occasionally suggested "buying low" on the user's own player — added a server-side filter dropping any `buyLowTargets` entry matching the user's own roster, on top of tightening the prompt. Also returns `tradeOpportunityFlags` (1-2 items) — a 3rd prompt job cross-referencing the sell-high/buy-low signal against deterministic per-opponent category weaknesses (`src/utils/teamStanding.js`), feeding Team Pulse's trade-opportunity section (see below). Hit `max_tokens: 1100` truncation on real league-sized output ("Malformed JSON") on first browser pass — bumped to 2000 (same fix `league-pulse.js` already needed in T3-5) — re-tested 2026-07-28, trade-opportunity flags now render clean. |
| Team Pulse (Roster Health Score + League Pulse, combined 2026-07-26) | ✅ UAT complete (initial pass 2026-07-26; myTeamTake rework re-test ✅ 2026-07-28) | New combined Season Hub panel, replaces the standalone League Pulse panel and the "Roster Health Score" coming-soon placeholder (which had zero prior implementation beyond that placeholder). Section 1: user's team — deterministic Contender/Playoff Bubble/Rebuilding tier + trend arrow (rank vs. top-half-of-league cutoff; no per-league playoff-spot count exists yet, defaults to top half) + current record + per-category win-rate badges (`src/utils/teamStanding.js`, unit-tested, 23 cases) + a Claude insight. First browser pass found the insight too thin (one generic "strongest/thinnest category" sentence); reworked same day so `/api/season/league-pulse` always runs a 4th prompt job producing a `myTeamTake` (summary/strengths/weaknesses/recommendation) grounded in real deterministic win-rate data and an approximate weeks-remaining figure (`SPORT_CONFIGS.seasonEndDate`) — re-tested 2026-07-28, richer take renders correctly. Section 2: full league landscape, one line per team, color-coded by tier, no fetch needed (pure client-side math). Section 3: trade-opportunity flags from the extended `trade-value-index` endpoint above. Trend arrow requires a league's *second* roster sync to have a prior snapshot to diff against (`leagueStore.js` now stashes `previousStandings` on every sync) — blank, not fabricated, on the first sync. |

**Architecture:**
- Waiver advice: pure POST (no Yahoo token needed) — uses `leagueRosters` state + players.json. Sport-agnostic (nba/mlb).
- Matchup advice: POST with Yahoo token — fetches `/league/{key}/scoreboard` for current week opponent, then enriches both rosters with players.json stats.
- Start/sit advice: pure POST — sport-aware via `startSitMode` (`sports.js`); rejects `mlb` outright (400) since that sport uses the pitching-starts endpoint instead.
- Pitching starts (MLB only): pure POST, no LLM call — deterministic games-this-week + injury status → start/stream/hold per rostered SP (`src/utils/pitchingStarts.js`).
- Trade advice: pure POST like waiver advice (no live Yahoo call) — validates give/receive against cached `leagueRosters`, enriches with players.json stats.
- Trade value index: pure POST — scans own roster (sell-high) + every other team's roster (buy-low) using ADP/trend data already in players.json, plus a 3rd job flagging trade opportunities against deterministic per-opponent category weaknesses (`src/utils/teamStanding.js`).
- League pulse: pure POST — uses cached standings (rank/wins/losses) + every roster to summarize the league and surface trade partners. Calculation/prompt unchanged since 2026-07-24; now called from within Team Pulse instead of its own standalone panel.
- Team Pulse: no dedicated endpoint — combines client-side deterministic math (`src/utils/teamStanding.js`, tier/trend/category win rates) with the existing league-pulse and trade-value-index endpoints above.
- All season-advisor endpoints return structured JSON rendered in Season Hub panels: headline/moves for waiver, outlook/win-lose-tossup/keyNote for matchup, headline/startingLineup/benchNotes for start/sit, week/starts/note for pitching starts, verdict/category-impact/positional/buy-sell for trade, headline/sellHigh/buyLowTargets/tradeOpportunityFlags for trade value index, headline/dominating/rebuilding/tradeOpportunities for league pulse.

**Yahoo API throttle (found 2026-07-24, resolved 2026-07-26):** the MLB league (`469.l.209547`) started 403ing on `/league/{key}/settings` and `/league/{key}/scoreboard` with "This application is not authorized to perform this action" after a burst of OAuth reconnects + `/me` polling during same-session debugging. Basic account-level calls (`/users/games`) still work, and roster/standings calls were unconfirmed either way (`sync-rosters` also failed the same way once tested). Confirmed transient — cleared on its own after a cooldown period, no code or permissions issue. Separately (real bug, fixed): `pages/api/auth/yahoo/me.js` was collapsing "cookie valid but a live Yahoo call failed" into the same `connected: false` as "no cookie," causing the connection banner to flicker between connected/disconnected on transient network errors — fixed to trust the cookie and treat the profile-name lookup as best-effort. All six Yahoo API routes (`sync-rosters`, `settings`, `my-leagues`, `league`, `league-full`, `sync-draft`) also had no top-level error handling, so any Yahoo failure crashed into Next's HTML error page instead of clean JSON — fixed across all six.

**Prerequisite:** Y-01 ✓, Y-02 ✓, Y-04 ✓

---

### Start/Sit Advisor · UAT — ✅ passed 2026-07-24

Endpoint logic was verified end-to-end against real `players.json`/`mlb_players.json` data and live Claude calls (not just curl against synthetic fixtures) — including catching and fixing three real model-output bugs (duplicate player across two slots, position-ineligible placements, an eligibility violation that survived the first fix and needed a server-side validation pass). `npm run test:schedule` covers the pure date-math. The remaining browser/UI pass (NBA + MLB panels, empty states, repeat-refresh stability) was confirmed by the user 2026-07-24 — Y-05 status table updated accordingly.

---

### Trade Analyzer · UAT — ✅ passed 2026-07-27

`getTradeAdvice()` was smoke-tested end-to-end pre-rebuild via a synthetic roster payload (curl) — real Claude call, correct JSON shape, sensible category/positional/buy-sell reasoning. UI rebuilt 2026-07-26: "You give"/"You receive" free-text inputs replaced with roster pickers — "You give" toggles players directly off the synced Yahoo roster (`rosters.teams.find(t => t.isUser)`), "You receive" adds an opponent-team dropdown that then lists that team's roster as toggles, clearing the selection on team change. This makes two of the endpoint's error cases (off-roster "give," receive split across two teams) effectively unreachable from the UI now — they're still real server-side guards (reachable via direct API calls), just no longer things the picker UI can produce by accident.

Confirmed 2026-07-27 against the real synced MLB league (`469.l.209547`) — real give/receive picks, real opponent, real Claude-graded response:
- [x] Season Hub — picked a real give/receive combo off the user's own roster + a real opponent, confirmed loading state and a real response renders (category badges, positional/buy-sell notes)
- [x] Injured/inactive players show their status tag in the picker the same way other panels do (confirmed live: "Will Smith C injured", "Brent Rooker OF injured")

Same-day rework, also verified live each time: the `accept/lean-accept/lean-decline/decline` verdict implicitly framed every trade as "should I accept this" advice, which read oddly for a trade the user proposes themselves rather than one they're offered. Replaced with a `favorScore` (-100..100) rendered as a scale — iterated twice on user feedback to land on: "You" on the left, the opponent's team name on the right, a fixed 50/50 tick mark, a red-yellow-green-yellow-red gradient reflecting how lopsided the trade is (not which side benefits), a single marker landing at the corresponding point, and a plain-language headline above it ("This trade favors X" / "This is a roughly even trade").

Not yet exercised, same caveat as the rest of Y-05 at this stage — doesn't block marking this UAT complete:
- [ ] An NBA league (only tested against MLB so far; endpoint is sport-agnostic via `getPlayerFile`/`getSportConfig`)
- [ ] Switching the opponent-team dropdown *after* already picking "receive" players — reset logic (`handleReceiveTeamChange`) is unchanged from before the roster-picker rebuild, not re-verified this pass

---

### Y-05d · Yahoo API League-Scope Throttle (found 2026-07-24, resolved 2026-07-26)

**Symptom:** the MLB league (`469.l.209547`) started returning 403 "This application is not authorized to perform this action" on `/league/{key}/settings` and `/league/{key}/scoreboard` (via Matchup Advisor) and on the roster/standings calls behind Season Hub's "Refresh" button (`sync-rosters` — surfaced client-side as a confusing `Unexpected token '<'` JSON-parse error before the error-handling fix below). Basic account-level calls (`/users/games`, used by the connection-status check) kept working throughout.

**Confirmed cause:** a burst of OAuth reconnects (5+ code exchanges) plus `/me` polling in quick succession during same-session debugging of an unrelated connection-status bug (see fix below) — a transient app/account-level Yahoo rate-limit, not a permissions or code bug. Confirmed by retest: 403s cleared on their own after a cooldown period, with no code changes to the affected routes.

**Fixed in the same session (real bugs, unrelated to the throttle itself):**
- `pages/api/auth/yahoo/me.js` was collapsing "cookie valid but a live Yahoo verification call failed" into the same `connected: false` as "no cookie at all" — this caused the home page's connection banner to flicker between connected/disconnected on ordinary transient network errors. Fixed to trust a valid cookie as connected regardless of whether the best-effort screen-name lookup succeeds.
- All six Yahoo API routes (`sync-rosters`, `settings`, `my-leagues`, `league`, `league-full`, `sync-draft`) had no top-level error handling — any Yahoo failure crashed into Next's HTML error page instead of returning clean JSON, which is what produced the `Unexpected token '<'` symptom. Fixed across all six to return `502 { error }`.

**Resolved 2026-07-26:**
- [x] Retested `/league/469.l.209547/settings`, `/scoreboard`, and Season Hub's roster "Refresh" after a cooldown period — all clear, no more 403s
- [x] Re-ran the Head-to-Head Matchup Advisor against this MLB league — status table's "MLB blocked" caveat cleared

---

### Trade Value Index · UAT — ✅ passed 2026-07-26 (sell-high/buy-low); trade-opportunity flags re-test ✅ passed 2026-07-28

Sell-high/buy-low sections confirmed working well against a real synced league in the browser 2026-07-26. Separately, the **Trade Opportunities** flags (Team Pulse's "Scan for fits", same `/api/season/trade-value-index` endpoint but the 3rd prompt job) was throwing `Malformed JSON in model response` in the browser. **Root cause found:** `max_tokens: 1100` — too tight once the model has to produce all three jobs (up to 3 sell-high + 5 buy-low + 2 trade flags, each with a reason) against a real ~9-10 team league, truncating mid-JSON. This is the exact same bug League Pulse hit and fixed in T3-5 (bumped to 2000 there). Fixed 2026-07-26: bumped `trade-value-index.js` to `max_tokens: 2000` too.

**Re-tested 2026-07-28:**
- [x] Season Hub / Team Pulse — "Scan for fits" on a real league, trade-opportunity flags render without the malformed-JSON error

Not individually re-confirmed this pass — same caveat as elsewhere in Y-05, doesn't block marking this UAT complete:
- [ ] The empty state ("No standout trade fits right now") when the model returns nothing notable
- [ ] No buy-low target ever lists the user's own team — server-side filter already in place, not spot-checked this pass
- [ ] An NBA league (only tested against MLB so far)

Y-05 status table's Trade value index row flipped to a single "✅ UAT complete".

---

### League Pulse · UAT (pending — needs a browser pass)

`getLeaguePulse()` was smoke-tested via the same synthetic 3-team payload — real Claude call, correct JSON shape, sensible standings-aware reasoning. **As of 2026-07-26 this endpoint no longer has its own Season Hub panel** — it's called from within Team Pulse's section 1 (see the Team Pulse UAT section below, which supersedes the checklist that used to be here). What's *not* yet verified:

- [ ] Confirm behavior with a 2-team-only edge case isn't broken (the endpoint requires 2+ teams — verify the error message is legible if a league somehow syncs with fewer)
- [ ] Confirm an NBA league works the same way once synced

---

### Start/Sit Advisor Sport-Aware Split · UAT — ✅ passed 2026-07-26

Confirmed working as planned in the browser. NHL/NFL still can't be exercised with a real roster (no data yet, `setup.jsx`'s sport picker doesn't offer them — see NHL-01/NFL-01), but that's out of scope for this ticket. Y-05 status table's Start/sit advisor row can collapse to a single "✅ UAT complete".

---

### Pitching Starts Panel (MLB) · UAT — ✅ passed 2026-07-26, with one UX fix

Confirmed working in the browser against a real MLB league. Two things flagged as confusing in that pass, both fixed same day:
- The `note` caveat ("Pitcher probable starts aren't tracked yet — `startsThisWeek` is an approximate team-schedule proxy...") was internal implementation detail leaking into user-facing copy — meant nothing to the user. Removed entirely from the API response and the panel (no more italic footer line).
- The per-pitcher line read "N starts this week," which reads as a confirmed start count — but the number is actually the team's games-in-range (a pitcher never starts every one of their team's games). Renamed the field `startsThisWeek` → `teamGamesThisWeek` end-to-end (`pitchingStarts.js`, `pitching-starts.js`, `season.jsx`, test file) and reworded the label to "Team plays N times this week," which states literally what's being measured without needing a caveat to explain it.

`npm run test:pitching-starts` re-run clean (8/8) after the rename.

---

### Team Pulse · UAT — ✅ passed 2026-07-28 (myTeamTake rework re-test, after a 2026-07-26 pass found the insight too thin)

Tier badge, trend arrow, category win-rate badges, and league landscape rendered fine against a real league on the initial 2026-07-26 pass. The Claude insight (job 1) was the weak point: it only ever surfaced a single generic sentence — "strongest in X, thinnest in Y" — either from League Pulse's dominating/rebuilding note (if the user's team happened to be named) or the deterministic fallback (`buildFallbackInsight`) otherwise. No season narrative, no explicit playoff read, no move-or-hold call.

**Reworked 2026-07-26:** `league-pulse.js` now runs a 4th prompt job, "MY TEAM TAKE," that always produces a grounded take on the user's own team specifically (not contingent on being flagged dominating/rebuilding) — a `myTeamTake` object with `summary` (how the season's gone), `strengths`/`weaknesses` (grounded in real deterministic win-rate data computed server-side via `aggregateCategoryTotals`/`getCategoryWinRates`, the same `teamStanding.js` helpers trade-value-index.js already uses for opponents — not left to the model to guess), and `recommendation` (playoff-position read + hold-vs-make-moves call). Also added `seasonEndDate` to `SPORT_CONFIGS` (nba/mlb) so the prompt can give the model a real "~N weeks remaining" figure instead of inventing one — omitted from the prompt entirely for sports without a configured end date. `season.jsx`'s `TeamPulsePanel` renders the four `myTeamTake` fields when present, falling back to the old single-sentence behavior only if a response omits it. `max_tokens` bumped 2000 → 2500 for the extra job's output.

**Re-tested 2026-07-28:**
- [x] Season Hub — "Get Beane's Take," `summary`/`strengths`/`weaknesses`/`recommendation` all render and add real substance vs. the old one-liner

Not individually re-confirmed this pass — same caveat as elsewhere in Y-05, doesn't block marking this UAT complete:
- [ ] Trend arrow genuinely blank (not broken) on a league's first-ever sync, then correct on the second sync
- [ ] An NBA league (only tested against MLB so far)
- [ ] Switching leagues shows that league's own Team Pulse state, not stale data from the previously-viewed league

Y-05 status table's Team Pulse row flipped to "✅ UAT complete".

---

### Y-05c · MLB Pitcher Probable-Start Tracking
**Goal:** Sharpen the Start/Sit Advisor's MLB pitcher signal. Deferred out of the initial Start/Sit Advisor build (2026-07-07) because it's a fundamentally different data problem from the NBA/MLB team-schedule work that ticket shipped.

**Why this is separate:** MLB hitters play ~6 games/week almost every week (162g/~26wk), so team-schedule density isn't a differentiating signal for hitters — the schedule-file approach already covers them fine. The real MLB lineup lever is pitcher probable starts (a 1-start vs. 2-start week is the single biggest swing in a category league), but starting rotations are only announced ~5 days out — not known for a full season the way team schedules are. That makes this a weekly dynamic-data problem much closer to `mergeCurrentSeasonData.js`/Hermes than the ship-once `mlb_schedule.json` file.

**Current state:** the Start/Sit Advisor already runs for MLB using team-schedule games-this-week as an approximate proxy for pitcher starts, with an explicit lower-confidence caveat in the Claude prompt. This ticket is about replacing that proxy with real data, not unblocking MLB (it's already unblocked).

**Prerequisite:** a probable-starts data source (Hermes or similar) + a weekly ingestion script analogous to T1-2/`mergeCurrentSeasonData.js`.

---

### Y-08 · Season-Over / Off-Season Handling · UAT — core flow passed 2026-07-27, remainder closed/deferred to September

**Closed 2026-07-27:** core detection + gating + recap flow confirmed working end-to-end against real leagues (see below). Remaining open items (repeat-visit Claude-call check, setup picker message on a fresh add, the archived-vs-non-archived code-path consolidation, and confirming behavior once a new NBA season opens) are deferred — the only active league left to test any of this against is MLB, which doesn't conclude until September. Revisit this ticket once that league's season actually ends.

**Goal:** Once a league's season has actually concluded on Yahoo's side, PocketBeane should recognize that everywhere (not spend Claude/Yahoo calls on advisors that can't do anything useful anymore), never silently re-activate an archived league just from viewing it, and give the user a real end-of-season payoff (final placement + recap) instead of a bare "nothing here" screen.

**What's been built so far, found/fixed live against real concluded NBA leagues (`466.l.22207`, `466.l.196999`) — none of it browser-UAT'd yet:**
- `sync-rosters.js` / `sync-draft.js` / `my-leagues.js` each catch Yahoo's 403 ("This application is not authorized to perform this action") on their league- or game-scoped calls and treat it as a season-over signal, distinct from the transient Y-05d throttle (which cleared on its own; a concluded league 403s forever since it never gets a new game/season).
- Canonical flag `league.config.isSeasonOver`, settable from either the home page (draft Re-sync) or Season Hub (roster sync) via the shared `updateLeagueConfig` action — whichever surface finds out first informs the other.
- Season Hub (`season.jsx`) hides the entire Season Advisors block (waiver wire, matchup, start/sit, trade analyzer, trade value index, team pulse) behind this flag with a plain "Season complete" message, and shows a one-time **Season Recap** panel instead (final rank/record, 🥇/🥈/🥉 trophy for a top-3 finish, a one-time Beane-voice postmortem) built from whichever roster/standings snapshot was last cached before Yahoo locked the league out.
- Home page's "Re-sync" button on a season-over league is replaced with an inert "Season complete" label — no button left to click.
- `handleEnterSeason` (home page) no longer force-sets an archived (`status: 'complete'`) league back to `'season'` just from clicking into its Season Hub.
- `setup.jsx`'s Yahoo league picker shows an explanatory note ("your most recent season has concluded...") when `my-leagues.js` comes back empty because the account's most recent season for that sport is locked out. **Refined same day:** initially still left the manual league-key box usable ("you can still enter a key manually") — but a manual key can't actually help here either, since Yahoo blocks *any* league from that same concluded season/game (confirmed via the `466.l.177191` dead-end below). Changed to grey out and disable the input/button entirely rather than offer a path that only leads to another 403, with copy updated to say to come back once the new season starts.
- **Found live testing this UAT list itself:** a *third*, previously-unseen concluded NBA league (`466.l.177191`) — never synced into PocketBeane before, being added fresh via the manual league-key box — 403'd on `/league/{key}/settings`, the endpoint `setup.jsx` calls just to add a league in the first place (`pages/api/yahoo/settings.js`). Unlike the other three endpoints, there's no cached snapshot to fall back on here since this league was never synced before — so this one genuinely **cannot be added via Yahoo sync at all** once its season has ended, not just degraded gracefully. Fixed `settings.js` to catch the 403 the same way and return `{ seasonOver: true, error }`; `setup.jsx`'s `handleLeagueSelect` now surfaces a clear message ("...you can still set this league up without Yahoo sync — fill in sport/team count/scoring/roster slots manually below") instead of the raw Yahoo error text. **Consequence:** this league can never be used to UAT the Season Recap feature — there's no snapshot for it and never can be. Recap UAT has to happen against `466.l.22207`/`466.l.196999` instead, whichever of those still has a surviving cached snapshot (see below).
- **Bigger find, same session:** trying to UAT the recap against the other two leagues surfaced a real control-flow bug — `season.jsx` has a *second*, older "done" concept (`league.status === 'complete'`, PocketBeane's own local archive flag — set by the existing manual-archive button or the pre-existing NBA 7-day-inactivity auto-archive, both unrelated to whether Yahoo's real season ended) that early-returns with its own static "This league is archived..." message *before* any of this session's `seasonOver`/`SeasonRecapPanel` code ever runs. Both `466.l.22207` and `466.l.196999` are archived under this local flag (unsurprising — they've been inactive/concluded for a while), so the entire Y-08 build was unreachable for them — the user only ever saw the old generic archived message, never the recap. Fixed: the archived early-return now also checks `seasonOver` — when both are true it renders `SeasonRecapPanel` plus a message reflecting the real Yahoo-side conclusion ("Yahoo no longer serves any live data for it, archived or not"), and falls back to the original "unarchive to keep managing" copy only when the league is archived but Yahoo's season isn't actually confirmed over (the case that copy was actually written for).

**Confirmed working in the browser, 2026-07-27 (both real leagues, both archived under PocketBeane's local flag):**
- [x] Season Advisors block fully gone on both leagues, replaced by the new "Season complete" copy ("Yahoo no longer serves any live data for it, archived or not.") — no raw errors, no advisor panels, survives reload
- [x] Season Recap panel renders correctly for "Throne of All Kings v2" (`466.l.196999`) — 🥈 #2 of 12, real record (95-72-4), and a sharp Beane-voice recap referencing real rostered players (Gobert, Duren, Vučević, Cooper Flagg, Pritchard) with a specific, grounded weakness (no real point guards, thin steals) — confirms the whole pipeline (deterministic category math + Claude call + trophy render) works end-to-end against real data
- [x] Recap gracefully renders nothing (no error, no stuck loading state) for "TriStar Reboot" (`466.l.22207`) — confirmed this is the league whose cached `leagueRosters.teams` snapshot was already lost earlier in this session's debugging, before the merge-preserving fix landed. Unrecoverable (Yahoo permanently blocks this league now), but behaves safely rather than erroring — acceptable terminal state, not a bug.
- [x] Archived-branch fix works — both leagues still show "Archived" status on the home page (not silently reactivated), confirming the `handleEnterSeason` fix didn't regress archived-league behavior
- [x] Home page Re-sync button shows inert "Season complete" label (no button) for a league once `isSeasonOver` is set — confirmed on at least one league

**Confirmed dead-end (expected, not a bug):**
- [x] A never-before-synced concluded league (`466.l.177191`) genuinely cannot be added via Yahoo sync at all — `/league/{key}/settings` 403s with nothing to fall back on. `setup.jsx` now shows the friendly message instead of a raw error, but there is no way to get this league's data into PocketBeane. Confirmed via a synthetic payload directly against `/api/season/season-recap` instead (5-team fake league) that the recap pipeline itself produces good output independent of this specific league's unavailability.

**Not yet verified in the browser:**
- [ ] Season Recap panel does NOT re-fire a second Claude call on a repeat visit (check Network tab / server logs on second load of Throne of All Kings v2)
- [ ] `setup.jsx`'s Yahoo picker shows the new "season concluded" message (not a silent empty dropdown) when adding a new NBA league right now
- [ ] A genuinely non-archived (`status: 'season'`) league correctly hits the *other* seasonOver branch (main render, not the archived early-return) with its own slightly different copy — both branches now say roughly the same thing but are two separate code paths (`season.jsx`'s `isArchived` block vs. its main return) that could drift out of sync in a future edit; worth eventually consolidating into one shared component
- [ ] Confirm behavior once a genuinely *new* NBA season opens on Yahoo (not testable until the 2026-27 season appears) — the picker should show fresh leagues again, and `isSeasonOver` should never re-trigger for a newly-created league

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
- [x] Trade analyzer visibly references current vs. prior season gaps when `current_season` exists for involved players — done once the trade analyzer itself was built (Y-05): `trade-advice.js` already imports and uses `formatRosterLine`/`CURRENT_SEASON_REASONING_INSTRUCTION` from `src/ai/seasonStats.js`, same pattern as the other three advisors. This line in the backlog was just stale.
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

### T3-3 · Monday Morning Waiver Wire Digest Email — superseded by T3-5, manual button removed 2026-07-26

**Original goal:** Deliver waiver wire recommendations to the user's inbox via a manual "Email me this week's picks" button in Season Hub (`pages/api/season/email-waiver-digest.js`, reusing `getWaiverAdvice()`).

**Why removed:** T3-5 made the manual button redundant — the digest now fires automatically every Monday via the Hermes cron (`scripts/send-waiver-digest.mjs`), with no click required. Keeping a manual trigger around alongside a working automated one was just a second, now-untested path to the same inbox. Removed 2026-07-26: `WaiverPanel`'s button/email state in `pages/season.jsx`, and the now-unused `pages/api/season/email-waiver-digest.js` route entirely. `/gm-profile`'s saved-email setting (`getUserEmail`/`saveUserEmail`) is untouched and still there, just no longer wired to anything in Season Hub — the cron sends to a hardcoded recipient (see T3-5), not the GM Profile email.

---

### T3-5 · Automated Weekly Waiver Digest via Hermes Cron — ✅ done 2026-07-26

**Goal:** The Monday waiver wire digest (T3-3) currently requires a manual click in Season Hub every week — not useful as a season-long retention feature if the user has to remember to open the app. Make it fire automatically as part of the existing Hermes weekly pipeline (`run_weekly.py`, cron: Monday 5am, next run 2026-07-27).

**Why this wasn't already wired up (found 2026-07-24):** `run_weekly.py` and `/api/season/email-waiver-digest` were two independent systems. The cron job only refreshed `players.json`/`mlb_players.json` stats and emailed *the developer* a pipeline status report via Gmail — it never touched the digest endpoint. Two real gaps blocked wiring them together: (1) the digest endpoint requires the caller to hand it `leagueRosters` — it never fetched anything itself; only the browser built that payload; (2) recipient email and which-leagues-to-notify lived only in browser `localStorage` — no server-side persistence.

**How it was actually resolved (2026-07-26) — different from the 2026-07-24 decision above:** rather than adding a server-side notification-config file the app writes to, the new `scripts/send-waiver-digest.mjs` discovers everything live from Yahoo on each run — no config file to keep in sync. It:
- Reads/refreshes the Yahoo token from `~/.hermes/auth.json` (the same file `run_weekly.py` already reads for its playoff-status check — turns out something upstream already persists this app's OAuth token there under `source: "pocketbeane_oauth_via_callback"`, so the bridge from browser-cookie auth to a headless, file-based token already existed; this script just keeps it refreshed and reuses it).
- Enumerates every league the user has for a sport via Yahoo directly, filtering to only currently-active leagues (`is_game_over` false) — so old, completed leagues from past seasons don't get emailed.
- Sends one digest per active league to a single hardcoded recipient (matching the existing `NOTIFY_TO` pattern already used for the developer status email — this is a single-user app, so a persisted multi-user config wasn't worth building).

This resolved both open implementation questions from 2026-07-24: it's a standalone Node script (`.mjs`, run via `subprocess` from Python exactly like `mergeCurrentSeasonData.js` already is) so it never depends on a web server being up when the 5am cron fires — no Python port needed, since the prompt/formatting logic could stay in JS. Multi-league handling is just "loop over every active league returned by Yahoo," no stored list required.

**Known duplication (accepted tradeoff):** `buildWaiverAdvice()` in the new script is a near-duplicate of `getWaiverAdvice()` in `pages/api/season/waiver-advice.js` — the latter imports via the Next.js-only `@/` alias, which plain Node can't resolve outside webpack, so true reuse wasn't possible without adding a module-alias dependency. The two must be kept in sync if the prompt or guardrails change (both are commented accordingly).

**Verified 2026-07-26:** ran `node scripts/send-waiver-digest.mjs mlb` directly — real Yahoo token refresh, real roster fetch, real Claude call, real email delivered via Resend for the active MLB league (`469.l.209547`). Wired into `run_weekly.py` as `send_user_digests()`, called after the per-sport stats-refresh loop, guarded so a digest failure can never fail the pipeline.

**Follow-up fixes found via this rollout (2026-07-26):**
- `src/utils/playerName.js`'s `normalizeName()` was silently matching real, rostered players as "available free agents": Yahoo splits two-way players like Shohei Ohtani into two roster entries ("Shohei Ohtani (Pitcher)" / "Shohei Ohtani (Batter)"), and separately returns accented names (Jeremy Peña, Cristopher Sánchez, Yandy Díaz, ...) while `players.json` stores plain ASCII — neither matched. Fixed to strip trailing parentheticals and Unicode diacritics before comparison. This affects every advisor and the cron script alike, not just the waiver digest.
- `STALENESS_DAYS` (`src/ai/seasonStats.js`) dropped from 14 to 7 to match the weekly cron cadence — a missed Monday refresh now gets flagged in that same week's digest instead of silently waiting a second missed cycle.
- League Pulse's `max_tokens: 900` was too tight for this ~9-10 team league, truncating the model's JSON mid-response ("Malformed JSON in model response"). Bumped to 2000 in both `pages/api/season/league-pulse.js` and the cron script's copy — fixes League Pulse in the browser UI too, since they share the limit.
- Added a Trade Opportunities section (sourced from League Pulse) to the cron digest email, below the waiver picks — wrapped so a pulse failure never blocks the waiver picks from sending.
- Removed the manual "Email me this week's picks" button entirely (see T3-3) now that the cron covers it.

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

All sport expansions require a `{sport}_players.json` file with ADP rankings and prior season stats before recommendation logic can be calibrated. **Update 2026-07-26:** the `sports.js` NHL/NFL entries are no longer stubs — they're real, fleshed-out config (slots, positions, categories, `startSitMode`) landed as part of the Start/Sit sport-aware work, see below for what actually shipped vs. what's still a placeholder. The architecture is sport-config driven and ready. The Yahoo OAuth layer supports all three sports via `game_codes={sport}`.

---

### ~~MLB-01 · MLB League Support~~ ✅ DONE
Full MLB 5×5 draft experience shipped 2026-06-27. Multi-sport architecture generalized across the entire codebase — `lowerIsBetter` config field drives ERA/WHIP grading correctly; `filterPositions` drives scarcity engine; `game_codes=mlb` wired into roster sync. `mlb_players.json` built from FantasyPros 2026 ADP + Baseball Reference 2025 stats via `scripts/build-mlb-players.js` — 300 players (181 hitters, 119 pitchers), 28 rookies/injured included with `prior_season: null` so they appear on board by ADP.

---

### NHL-01 · NHL League Support
**Status: Blocked on data — nhl_players.json needed (August 2026)**

**Goal:** Full NHL draft experience using the existing sports.js config as the foundation.

**Complexity note:** Goalies and skaters have completely separate stat profiles. The category grading engine will need to handle `sv_pct` as a percentage category and `gaa` as a lower-is-better category. The `G` position (goalie) has no overlap with skater positions — slot logic must treat them as distinct pools.

**Update 2026-07-26:** `sports.js` NHL entry is now real (landed as part of the Start/Sit sport-aware split, not a dedicated NHL sprint) — `filterPositions`, `slotOrder`, `slotEligibility`, `categories` (`g`/`a`/`plusMinus`/`ppp`/`sog`/`w`/`sv_pct`/`gaa` — ids, not the `+/-`/`SV%` display labels below), `percentageCategories: ['sv_pct']`, `lowerIsBetter: ['gaa']`, `startSitMode: 'condensed'`. `nhl_players.json`/`nhl_schedule.json` exist but are **empty placeholder files** (`[]` / `{games: []}`) — `hasScheduleSupport('nhl')` is true and the Start/Sit Advisor degrades gracefully to an empty state, but there's no real player pool, so the draft board and every other feature are still non-functional for NHL. `setup.jsx`'s sport picker also still only offers NBA/MLB, so an NHL league can't be created at all yet regardless of data. Skater vs. goalie category split (`SHP` shots-on-goal-adjacent category from the original plan) wasn't carried over 1:1 — worth reconciling against real ADP data once it lands rather than trusting the placeholder category list as final.

**What's still needed:**
- `nhl_players.json` — skaters + goalies, 2026-27 projected ADP + 2025-26 prior season stats (replacing the empty placeholder)
  - Source: FantasyPros NHL ADP (August), Hockey Reference (per-game stats)
- `nhl_schedule.json` — real season schedule (replacing the empty placeholder), same `{games: [{date, home, away}]}` shape as `nba_schedule.json`
- Reconcile the placeholder `sports.js` category list above against real ADP/stat data
- Claude prompt tuning for NHL context (goalie streaming, early-season regression, etc.)
- `sync-rosters.js` game_codes=nhl variant
- Add `nhl` to `setup.jsx`'s sport picker (currently hardcoded to `['nba', 'mlb']`)

**Testing constraint:** No completed NHL league available. End-to-end validation requires a test draft or an active league. October 2026 season start = first real test window.

**Timing:** Data available August 2026. Build alongside PMF-08 data refresh sprint.

---

### NFL-01 · NFL League Support
**Status: Blocked on data — nfl_players.json needed (August 2026)**

**Goal:** Full NFL draft experience — same structure as NHL, same timeline.

**Complexity note:** NFL has the most position heterogeneity of any sport. QB is a completely separate stat pool (passing yards, TDs, INTs, rushing). K and DST are streaming positions that change weekly. Bye weeks add lineup complexity that doesn't exist in NBA/NHL. Standard scoring vs. PPR vs. half-PPR creates divergent ADP curves — need to decide which format to target first (PPR is the most common).

**Update 2026-07-26:** `sports.js` NFL entry is now real (same Start/Sit sport-aware split as NHL above, not a dedicated NFL sprint) — `filterPositions`, `slotOrder` (QB/RB/WR/TE/FLEX/K/DEF/BN), `slotEligibility: { FLEX: ['RB','WR','TE'] }`, `startSitMode: 'full'` (NFL is the one sport that kept the detailed per-position matchup treatment, since it's a weekly not daily sport). **Categories were scaffolded as roto-style counting stats** (`pass_yd`/`pass_td`/`rush_yd`/`rush_td`/`rec`/`rec_yd`/`rec_td`/`int`) to fit this codebase's existing category-league shape (`categories`/`benchmarks`/`percentageCategories` — the same shape every other sport uses for the scarcity engine) — **not** the points-based PPR scoring this ticket originally called for. Reconcile that mismatch before building the real draft experience: either add points-based scoring as a genuinely new mode, or confirm roto-style categories are actually fine for the target NFL leagues. `nfl_players.json`/`nfl_schedule.json` exist but are **empty placeholder files** — same caveats as NHL above (Start/Sit degrades gracefully, everything else is non-functional, `setup.jsx` sport picker doesn't offer `nfl` yet either).

**What's still needed:**
- `nfl_players.json` — ~200 relevant skill-position players, PPR ADP + 2025 season stats (replacing the empty placeholder)
  - Source: FantasyPros NFL ADP (August), Pro Football Reference
- `nfl_schedule.json` — real season schedule (replacing the empty placeholder)
- Resolve the roto-categories-vs-PPR-points scoring mismatch noted above
- Claude prompt tuning for NFL draft strategy (Zero RB, Hero RB, Robust RB, TE-premium)
- `sync-rosters.js` game_codes=nfl variant
- Add `nfl` to `setup.jsx`'s sport picker (currently hardcoded to `['nba', 'mlb']`)

**Testing constraint:** No completed NFL league available. September 2026 draft window is the first test opportunity.

**Timing:** Data available August 2026. Build alongside PMF-08 and NHL-01 data sprint.

---

## Platform & Design

---

### D-01 · Full App UI Revamp
**Status: ✅ COMPLETE as of 2026-07-29 — all 9 steps done (Checkpoint 1, Draft DNA rebuild, Season Hub restructure, homepage command center, draft board refinement, a11y pass, mobile pass). See the "Note" below for what's still worth doing before a public-facing push.**

**Goal:** Overhaul the visual identity of PocketBeane from the current monochrome Tailwind default into a polished, premium sports analytics product.

**Research component — done.** Direction is decided and documented, not still open:
- `ui-redesign/D01_UI_REVAMP_DESIGN_BRIEF.md` — full competitive landscape, direction rationale ("The Front Office" — premium analytics + editorial voice, Moneyball green/brass palette), complete design token spec (Part 3), page-by-page layout guidance (Part 4), anti-vibe-code checklist (Part 5), and the 9-step build order (Part 6) referenced below.
- `ui-redesign/D01_MOCKUPS.html` — working CSS reference implementation of every token, matched exactly by the real `tailwind.config.js`/`styles/globals.css` tokens.

**Execution approach — checkpointed, not one shot.** Each step below lands as its own reviewed pass rather than one giant redesign PR, per the brief's own build order (Part 6) plus explicit product decisions made when Checkpoint 1 was planned:
- Season Hub (`pages/season.jsx`) gets *extracted* into per-tab files under `src/components/season/` when its turn comes (Step 5) — not just reskinned in place.
- Shared UI primitives are hand-rolled (`src/components/ui/`), not Radix/shadcn — with a standing exception to selectively pull in one scoped headless primitive (e.g. `@radix-ui/react-tabs`) later *only if* a specific interactive component becomes error-prone to hand-roll accessibly (flag it if that happens, don't preempt it).
- Mobile is built alongside desktop per page, not as a final retrofit pass — priority order highest-first: Draft DNA share card (acquisition surface, viewed on phones in group chats) → Season Hub (weekly phone usage) → homepage → draft board (desktop-first is fine here; live drafts are usually run on a second screen).
- No light mode this pass (personal-use dark-first product), but the color tokens are stored as CSS custom properties (`rgb(var(--color-x) / <alpha-value>)` in `tailwind.config.js`) specifically so a future light theme is a `:root` swap, not a component rewrite.

**Progress — 9 steps from the brief's Part 6 build order:**

| # | Step | Status |
|---|---|---|
| 1 | Token foundation — Tailwind theme, CSS var color tokens, `next/font` (Fraunces/Inter/JetBrains Mono) | ✅ Done 2026-07-29 |
| 2 | Global color/font sweep — all 19 files off old raw-Tailwind/legacy tokens (`bg-bg`, `text-pick`, `text-injury`, raw `green-500` etc.) onto the new semantic tokens; emoji-as-UI-chrome → inline SVGs | ✅ Done 2026-07-29 |
| 3 | Shared component system — `src/components/ui/`: `Card` (data/advisor/identity variants), `Button`, `Badge` (with a `size="sm"` variant added for dense rows, discovered needed mid-sweep), `AdvisorCard`, `TabBar`; migrated into existing files alongside the color sweep | ✅ Done 2026-07-29 |
| 4 | Draft DNA card rebuild — `src/components/DraftDNACard.jsx` full recomposition onto the `identity` Card variant + 9 monoline archetype SVGs, mobile-first (highest mobile priority) | ✅ Done 2026-07-29 |
| 5 | Season Hub restructure — extract `pages/season.jsx`'s 8 inline panels into `src/components/season/` per-tab files, wire up `TabBar` (This Week / Waivers / Trades / League / My Team), mobile-first sticky tab strip | ✅ Done 2026-07-29 |
| 6 | Homepage command center — `pages/index.jsx` calendar-aware hero + `AdvisorCard` "Beane's Note" + league grid, replacing the current vertical stack | ✅ Done 2026-07-29 |
| 7 | Draft board refinement — promote `RecommendationPanel` to `AdvisorCard` (explicitly deferred out of Checkpoint 1 on purpose), tabular mono numerals + semantic value-deltas on `PlayerPool`'s table, on-the-clock pulse | ✅ Done 2026-07-29 |
| 8 | A11y pass — full contrast audit, focus-state audit, keyboard nav verification on the draft board | ✅ Done 2026-07-29 |
| 9 | Mobile pass — cross-cutting check now that mobile was built alongside each page rather than deferred; catch anything missed | ✅ Done 2026-07-29 |

**Step 4 detail (done 2026-07-29):** New `src/components/ui/ArchetypeGlyph.jsx` — 9 abstract monoline SVGs (diamond/scope/blueprint-triangle/ascending-steps/dice/rising-arrow/sparkle-anchor/pillars/diverging-zigzag), brass stroke, single weight, no fills except a couple of small discovery-marker dots. `DraftDNACard.jsx` fully recomposed onto `Card variant="identity"` + `Badge tone="brass"` + `Button`: eyebrow row, glyph, Fraunces `text-display` archetype name, italic tagline, brass category pills, hairline-ruled Bold Prediction block, `pocketbeane.app` footer, barely-there radial brass glow top-center. Verified in-browser against all 9 archetypes (Chrome headless screenshots) — no clipping, correct wrapping on long names ("The Underdog Whisperer", "The Riverboat Gambler"). Card width made responsive (`w-[340px] max-w-[calc(100vw-2rem)]`, verified via isolated CSS test) and the action-button row given `flex-wrap` so both survive phones narrower than ~372px. Dropped an initial `aspect-[4/5]` constraint — it hard-clipped long-tagline archetypes (Zero-to-Hero) since a definite aspect-ratio height doesn't grow for overflow content; replaced with `min-h-[425px]` so the card grows naturally instead.

**Step 5 detail (done 2026-07-29):** `pages/season.jsx` (1552 lines, 8 inline panels) split into `src/components/season/`: `shared.jsx` (constants/helpers used across tabs — `TrendBadge`, `TradeFavorBar`, `TradePlayerToggle`, style maps — plus a new `useTeamStanding(league, rosters, players)` hook factored out of the old Team Pulse panel's standing `useMemo` so both League and My Team tabs share one computation), `ThisWeekTab.jsx` (Matchup + Start/Sit), `WaiversTab.jsx`, `TradesTab.jsx` (Analyzer + Value Index), `LeagueTab.jsx` (the merged League Standing Intelligence panel — tier/trend/win-rates + league landscape + trade-opportunity flags, unchanged logic from the old Team Pulse panel), and a brand-new `MyTeamTab.jsx` (synced roster with injury badges + `TrendBadge` trend arrows, plus category-profile win-rate bars reusing `DraftRecap`'s bar-chart pattern) — this tab didn't exist before, called for explicitly in brief 4.2 but never built. `SeasonRecapPanel` extracted unchanged (stays outside the tab system, always shown when a season is over). `pages/season.jsx` itself is now a thin shell: header, sync status, `TabBar`, active-tab render, with the season-over/archived guards untouched. Also upgraded the six Claude-driven panels (Matchup, Start/Sit, Waiver, Trade Analyzer, Trade Value Index, League) from the plain `Card` to `AdvisorCard` per the brief's explicit "every tab leads with Beane's prioritized answer in an Advisor card" — `PitchingStartsPanel` stays on `Card` since it's deterministic (no LLM call). `TabBar.jsx` got `overflow-x-auto` + `shrink-0` on tabs for the mobile horizontal-scroll strip; the page wires it up with `sticky top-0 z-10 bg-surface-base`. Added lightweight `?tab=` deep-linking (reads once on mount, doesn't push URL on click) — a real UX win and also what made headless verification of all 5 tabs possible without simulating clicks. Verified all 5 tabs end-to-end against a seeded 8-team mock league with real player data (Chrome headless, `--dump-dom` proved more reliable than `--screenshot` in this environment for confirming render/no-crash; screenshots then confirmed the visuals) — This Week, Waivers, Trades (including the give/receive roster picker with real names), League, and My Team all render correctly with no runtime errors and no leftover raw color classes.

**Step 6 detail (done 2026-07-29):** Two product decisions made with the user before building (see prior conversation): (1) added a real `draftDate` field (`DEFAULT_CONFIG.draftDate` in `leagueStore.js` + a date input in `setup.jsx`) rather than skip the brief's countdown — a genuine small data-model change, not just presentation; (2) "Beane's Note" is deterministic, not a live weekly Claude call — an automatic LLM call on every homepage visit would fight PMF-01's rate-limit-behind-user-action design, so it's built entirely from data already on the page (GM profile quiz answers + standing math), same principle applied to the Hero card's in-season state (deterministic tier/record/trend/top-category, not a live matchup pull).

New `src/components/home/`: `HeroCard.jsx` (calendar-aware — pre-draft countdown + readiness checklist [pool refreshed/philosophy set/Yahoo linked], draft-in-progress round/pick, in-season standing via `computeTeamStanding`, archived recap headline), `BeaneNote.jsx` (deterministic Advisor card, prompts the GM Profile quiz when none is set), `LeagueSwitcher.jsx` (top-bar pill row selecting which league's Hero/Beane's Note shows — doesn't affect the league list below). Refactored `season/shared.jsx`'s `useTeamStanding` hook to wrap a new plain `computeTeamStanding()` function, since the homepage needs to call it per-league inside the league-grid map (hooks can't be called in a loop) as well as once for the hero league.

`pages/index.jsx` rebuilt: top bar (wordmark, `LeagueSwitcher` when >1 non-archived league, a compact clickable Yahoo-connected pill that doubles as the disconnect control, GM Profile link, + New League), Hero+Beane's Note in a `lg:grid-cols-12` 8/4 split, then the existing league list — kept single-column (not forced into a 2-col grid) since `LeagueCard` is feature-dense (Yahoo linking, draft sync, archive/delete); each card now shows a standing-tier badge, trend arrow, and record when rosters exist, computed the same way as the Season Hub tabs. `YahooConnect`'s full CTA card only renders while disconnected now — the connected state lives in the top-bar pill instead, which is why disconnect had to move there too (it was almost dropped entirely in the first pass — caught before verification).

Verified all 4 hero states (pre-draft with a real countdown, draft-in-progress, in-season with real standing math, archived) plus the League Switcher and enhanced league cards against seeded mock leagues — no runtime errors, no leftover raw color classes.

**Step 7 detail (done 2026-07-29):** Two bullets of the brief's 4.3 refinements turned out already satisfied by existing code, no change needed: the round/pick ticker was already mono and pinned to the top (`FilterBar.jsx`'s `turnLabel`), and its on-the-clock dot already used Tailwind's default `animate-pulse` (2s cubic-bezier, opacity-only, no spin) — matches "subtle, 2s ease, no spinning" as-is.

Three real changes: (1) `PlayerPool.jsx` gets a new **Value** column — `player.adp - referencePickNumber` (the pick they were actually taken at if drafted, else the current live pick), `signal-up` when positive ("still available below where ADP said they'd go"), `ink-muted` otherwise, no red per the brief's explicit two-color spec; rank/ADP/Value columns all `tabular-nums`. Drafted-row opacity unified to a flat 40% (previously 50%/30% split by user-vs-opponent) — kept the pre-existing strikethrough-only-on-opponent-picks distinction since the brief doesn't address it either way and it's a real, intentional UX signal (your own picks aren't "crossed off"). (2) `RecommendationPanel.jsx`'s three-zone layout (pinned header / scrollable results / pinned categories) — the header shell and every Claude-output result block (Bid Ceiling, picks list, Market Read briefing) switched from plain `Card` to `AdvisorCard`, so "the call" is now visually distinct from the board for the first time, per the brief's explicit goal. Sleeper Radar (deterministic, not Claude) and the Categories bar chart (Zone 3) stay on their existing non-Advisor styling — that distinction (Advisor card = Claude spoke; data card = deterministic) is the same rule Step 5 established for the Season Hub tabs. (3) Small consistency touch-up on `RosterView.jsx`: `tabular-nums` on the auction price and pick-number spans, following Part 3.2's global typography rule.

Verified live against a real in-progress draft (seeded 2 opponent picks, user on the clock at pick 3) — a genuine Claude call fired and rendered inside the new AdvisorCard treatment with real reasoning, the Value column showed correctly-signed green deltas, no runtime errors, no leftover raw color classes.

**Step 8 detail (done 2026-07-29):** Full WCAG contrast audit done with real math, not eyeballing — computed relative-luminance contrast ratios for every token pairing in Part 3.1 plus every `text-{color}/{opacity}` combination actually used in the codebase (25 occurrences found via grep). Result: the base tokens all check out as documented (ink-primary 15.4:1, ink-secondary 6.3-7.2:1, brass/signal colors 4.8-8.6:1 against both surface-base and surface-raised). The real problem was **compounding opacity on top of already-modest tokens** — `signal-down`, `signal-info`, and `ink-muted` in particular have little contrast headroom, so any `/50`-`/70` opacity reduction pushed them well under the 4.5:1 text minimum (some as low as 1.56:1). Fixed 15 real instances (one more than the initial 14 found — a duplicated `CategoryBar` `labelColor` pattern in `RecommendationPanel.jsx` was missed on the first pass and caught by a final verification grep) by dropping the opacity modifier back to solid color; left icon-only and decorative-separator opacity usage alone since non-text elements only need to clear 3:1. Deliberately did **not** lighten the `ink-muted` token itself (still 3.25-3.68:1 solid, technically AA-large-only) — it's documented in the brief as the intentionally lowest-emphasis tier for disabled/placeholder/tertiary text, this is a personal-use app with no compliance obligation, and retinting a token used in hundreds of places for a marginal gain was judged not worth the regression risk; the actual bug (opacity stacked on top of it) is what got fixed.

Added a single global `:focus-visible` rule to `globals.css` (beane-green outline, 2px, offset) rather than retrofitting the shared `Button` component's ring onto every raw `<button>`/`<a>`/`<input>` in the app — most interactive elements turned out to still be one-off raw buttons predating the design system, not the `Button` component, so a per-component sweep would have been a much larger and riskier diff than one base-layer CSS rule. Verified with real keyboard simulation via the Chrome DevTools Protocol (Node's built-in `WebSocket`, no new dependency installed) rather than guessing: the first pass showed every element getting the green ring **except** search `<input>`s, which already set their own `focus:outline-none` + `focus:border-beane-green` — Tailwind's utility was winning the cascade over the global rule. Fixed with a scoped `!important` (documented inline as to why). Re-verified — every tab stop now shows the ring, including inputs.

Also verified, via the same CDP approach, that none of Steps 4-7's styling-only changes broke the draft board's keyboard shortcuts: simulated ArrowDown (row selection), `U` (stage a pick), and `Enter` (confirm) in sequence against a real seeded draft and confirmed the pick actually landed in the roster panel. Confirmed separately that there are no keyboard-inaccessible click targets anywhere in the app (`<div onClick>` etc.) — the one non-native interactive element (the player pool's `<tr onClick>` row selection) already has a full keyboard equivalent via arrow keys.

**Step 9 detail (done 2026-07-29):** Cross-cutting mobile check using real device-metrics emulation via CDP (`Emulation.setDeviceMetricsOverride` at 390px, iPhone-width) plus a scripted overflow detector (`document.documentElement.scrollWidth > window.innerWidth`, excluding elements that legitimately manage their own `overflow-x-auto`) — a much more reliable signal than eyeballing screenshots. Homepage, Season Hub, setup, and gm-profile all passed clean with zero horizontal overflow — the responsive work already done in Steps 4-6 held up under an objective check, not just a visual spot-check.

Found and fixed two real breaks that had slipped through because neither page was exercised end-to-end at mobile width during its own step:
- **`DraftRecap.jsx`** (and the dead, unused `DraftComplete.jsx` it replaced — confirmed via grep that nothing imports the latter, left alone) had a fixed `grid-cols-[1fr_300px]` for the post-draft roster table + Category Report sidebar. On a 390px screen the fixed 300px column left the roster table almost no room, and its wrapper's `overflow-hidden` clipped the excess **invisibly** rather than allowing scroll — the actual "what did you draft" content was silently unreadable. This page hosts the Draft DNA share card (the brief's #1 mobile priority) and is exactly the kind of page a user opens on their phone after a draft, so this wasn't a low-stakes miss. Fixed: `grid-cols-1 lg:grid-cols-[1fr_300px]` (stacks on mobile), and the roster table's wrapper switched from `overflow-hidden` to `overflow-x-auto` with a `min-w-[520px]` on the table itself — Slot/Player/Pos/PTS are visible immediately, the remaining stat columns are a horizontal swipe away, standard responsive-table pattern.
- **`pages/draft.jsx`**'s live 3-column board (`grid-cols-[288px_1fr_264px]`, ~590px minimum) sits inside a `h-screen ... overflow-hidden` app-shell wrapper. On a 390px screen this **clipped the entire middle column — the player pool, the actual interactive draft table — completely invisible and unreachable**, not just cramped. This is a step past the checkpoint's deliberate "desktop-first is fine, live drafts run on a second screen" call from Step 4/7 planning: that reasoning covers *not optimizing* density for mobile, not making two-thirds of the board disappear if someone checks their phone mid-draft. Fixed with the smallest possible change that preserves the brief's explicit "don't soften the density" instruction: added `overflow-x-auto` to the `<main>` wrapping the grid and a `min-w-[880px]` on the grid itself, so the exact same dense desktop layout becomes horizontally scrollable instead of clipped. No layout redesign, no column changes — RecommendationPanel is visible on load, PlayerPool and RosterView are one swipe away.

Also swept the whole codebase for other fixed-pixel-width red flags (`grid-cols-[...]`, `w-[NNNpx]`) — the only remaining ones are the two just-fixed instances (now safety-netted with scroll) and the Draft DNA card's already-responsive `max-w-[calc(100vw-2rem)]` clamp from Step 4. Spot-checked `setup.jsx` and `gm-profile.jsx` (never explicitly touched by any D-01 step) at 390px — both already read cleanly single-column with no overflow, no changes needed.

**D-01 is now fully done — all 9 steps of the brief's Part 6 build order complete.**

**Acceptance criteria — all met:**
- New color token system defined and applied globally — ✅ done (Steps 1-2)
- At least one imagery element on the home/draft screen — ✅ done (Step 4, the 9-glyph archetype system)
- Draft DNA card looks polished enough to share publicly — ✅ done (Step 4, and confirmed working on real mobile width in Step 9)
- Typography hierarchy is clear across all major screens — ✅ done (Fraunces/AdvisorCard now live on the Draft DNA card, Season Hub, the homepage, and the draft board's Beane's Corner)
- Passes a11y contrast check on all primary text — ✅ done (Step 8 — full computed audit, 15 fixes applied; `ink-muted`'s inherent AA-large-only solid contrast is a documented, deliberate exception, not an oversight)
- Mobile — ✅ done (Step 9 — objective overflow-checked, not just eyeballed; two real invisible-content bugs found and fixed)

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

**New open action items (2026-07-24) — checked against Monday's (2026-07-27) actual run, per the note below:**

- [x] **P-02 · MLB current-season stats never actually refresh — fixed 2026-07-27.** Confirmed happening exactly as predicted: Hermes's own cron job never fired Monday (`jobs.json` showed `last_run_at: null`, scheduler skipped straight to `next_run_at: 2026-08-03` — desktop app wasn't open at 5am). The pipeline was instead run manually the same morning, and diffing that output against July 6 showed every field byte-identical (e.g. Shohei Ohtani's pitching line matched to the decimal) — only `as_of_date` had moved, because `scrape_mlb.py` was still reading the same static `bbref-batting.html`/`bbref-pitching.html` snapshots from July 6 that nothing ever re-downloaded. **Real fix landed same day:** rewrote `scrape_mlb.py` to pull live season stats directly from the MLB Stats API (`statsapi.mlb.com/api/v1/stats?stats=season&group=hitting|pitching&sportId=1&season=2026&playerPool=all`, paginated) instead of parsing local HTML — same pattern `fetch_mlb_schedule.py` already used successfully, including the `truststore` SSL fix for this machine's antivirus cert issue. Output field names kept identical to the old Baseball-Reference version (`avg`/`obp`/`hr`/`era`/`whip`/etc.), so `mergeCurrentSeasonData.js`/`calculateTrend.js` needed zero changes downstream — confirmed via the full existing test suite (`npm run test`, 82/82 passing) plus a live end-to-end run against a throwaway copy of `mlb_players.json` before touching the real file. `playerPool=all` was required — without it the API defaults to a qualified-leaders-only subset (~150 players) instead of the full ~700-player pool. Added `MIN_HITTERS`/`MIN_PITCHERS` safety thresholds (mirroring `fetch_mlb_schedule.py`'s `MIN_GAMES_THRESHOLD`) so a partial/broken API response can't silently feed garbage into the merge step. Deleted the now-unused `scripts/bbref-batting.html`/`bbref-pitching.html` (were git-tracked). **Verified against real data:** re-ran the corrected scraper and merge against the real files — `src/data/mlb_players.json` now reflects genuinely fresh July 27 stats (spot-checked Aaron Judge, George Kirby, others — real games-played/W-L increases, real ESPN injury notes picked up that weren't there before), 293 updated / 0 skipped / 0 invalid, `prior_season` untouched as required. One thing worth knowing: a couple of spot-checked pitchers' (Ohtani) numbers happened to still match July 6 exactly — confirmed via a direct live schedule query and Ohtani's separately-tracked hitting line (which *did* show clear progress) that this is real in-story data (workload-managed starts), not a scraper bug.
- [x] **P-03 · `run_weekly.py` has no Yahoo token refresh — fixed 2026-07-28.** `load_yahoo_tokens()` just read whatever `auth.json` had cached with no refresh call — fine for a manual run soon after a fresh login, but a real risk on an unattended Monday-5am run against an access token that's typically only good for ~1hr. Added `get_valid_yahoo_token()`, mirroring the refresh dance that already exists in two other places (`src/utils/yahooAuth.js`'s `getValidToken()`, `scripts/send-waiver-digest.mjs`'s `getValidHermesToken()`): if `credential_pool.yahoo.expires_at` is within 5 minutes of now (or already past), POST a `grant_type=refresh_token` request to Yahoo (`YAHOO_CLIENT_ID`/`YAHOO_CLIENT_SECRET` from `.env.local`, same as the other two), then write the refreshed `access_token`/`refresh_token`/`expires_at` back into `auth.json` so Hermes and every other consumer of that file see the same token. A refresh failure (network, revoked grant, missing client creds) logs a warning and falls back to the stale token rather than crashing the pipeline — matches how every other soft-failure in this script already behaves (git commit, digest email, schedule refresh). Verified with a synthetic `auth.json` covering all four paths: fresh token left untouched, expiring token refreshed and persisted, refresh failure falls back cleanly, missing `refresh_token` falls back cleanly. No pytest infra exists for this script (`test_yahoo_api.py` is the only precedent, itself a manual smoke script) — verification was a standalone scratch script exercising `get_valid_yahoo_token()` directly, not committed.

**Separately fixed 2026-07-27, not originally scoped as P-02/P-03 but found running the pipeline for real:** a Yahoo response double-unwrap bug in `get_league_keys()`/`check_playoff_status()` that silently broke the playoff check and made every run report "Yahoo token missing"; a Windows antivirus root-cert issue breaking all Python→Yahoo HTTPS calls (fixed via `truststore.SSLContext`, deferring to the OS trust store like Node's `--use-system-ca` already does); `run_weekly.py` wasn't auto-committing the data files it touched; the "next scheduled run" line in the summary email was hardcoded/stale. Also added a run-once-per-day marker (`data-updates/.last_run`, gitignored) plus a Windows Task Scheduler wake-and-run backstop, since Hermes's desktop-app-dependent cron already proved unreliable (see P-02 above) — whichever trigger fires first now wins, the other is a no-op.

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
