# PocketBeane — Active Backlog

Last updated: 2026-06-27

Items are grouped by dependency tier. Within each tier, order reflects rough priority / logical sequencing.

---

## DECISION — Side project vs. commercial product (June 2026)

After cross-referencing the PMF backlog against the codebase, we split the PMF
gap tickets into two buckets:

**Build — makes the product genuinely better:**
PMF-01 (rate limiting), PMF-02 (philosophy quiz UX), PMF-04 (shareable recap
card), PMF-08 (data refresh). These improve the actual draft/season experience
regardless of whether PocketBeane ever has other users.

**Defer — commercial theater for a side project:**
PMF-03 (freemium tier architecture), PMF-05 (email capture), PMF-07 (analytics),
PMF-09 ($4.99 trial tier). These only make sense with a real user base and
billing infrastructure. Building them now adds complexity that makes the tool
worse to use personally. The PMF simulation + product architecture already tell
the portfolio story without a fake paywall.

Yahoo roadmap: Y-02 ✅ → **Y-04 (next)** → Y-03 (August build / September validate) → Y-05.
Note: Y-04 has no live-draft dependency and can be built now. Y-03 requires a live Yahoo draft for end-to-end validation so infrastructure ships in August.

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

### Y-04 · Post-Draft Roster Sync
**Goal:** After the draft, pull all team rosters from Yahoo so PocketBeane has
full league visibility for season-long features.

**Scope:** Sync all 10 team rosters (not just the user's). Enables opponent
roster awareness in trade and waiver analysis.

**Prerequisite:** Y-01 ✓, Y-02 ✓

---

### Y-05 · Season Management Suite
**Goal:** Full in-season advisor powered by live Yahoo data.

**Sub-features (can ship incrementally):**

| Sub-feature | Description |
|---|---|
| Head-to-head matchup advisor | Weekly outlook vs. current opponent — category projections and lineup suggestions |
| Waiver wire advisor | Recommend adds/drops based on roster gaps, schedule density, recent trend |
| Trade analyzer | Input give/receive — Claude evaluates net category impact, positional balance, buy-low/sell-high signal |
| Trade value index | Running power ranking of roster trade value based on recent performance vs. ADP expectations — who to sell high, buy low, or hold |
| Start/sit advisor | Optimal weekly lineup given schedule, matchup, recent form, injury status |
| League pulse | Weekly league-wide summary — who's dominating, who's weak, who might be open to trading |

**Prerequisite:** Y-01 ✓, Y-02 ✓, Y-04

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
