# PocketBeane — Active Backlog

Last updated: 2026-06-24

Items are grouped by dependency tier. Within each tier, order reflects rough priority / logical sequencing.

---

## Tier 1 — Yahoo-connected features



### Y-06 · Draft History Recap Page
**Goal:** Render the full draft board from Yahoo data in a dedicated UI — round-by-round, user's picks highlighted, player names resolved, trade flags for players who moved teams mid-season.

**Scope:**
- Pull from `/api/yahoo/league-full` (settings + standings + rosters + draft already working)
- Round-by-round grid layout (12 teams × 13 rounds)
- Highlight user's team column
- Flag picks where `player.teamKey ≠ pick.teamKey` (traded players)
- Unresolved player keys (cuts) shown as "—"

**Prerequisite:** Y-01 ✓

---


### Y-02 · League Selection After Auth
**Goal:** After connecting Yahoo, let the user select which Yahoo leagues to link to each PocketBeane league slot.

**Flow:** Post-auth → fetch user's active Yahoo leagues via API → display list → user maps each to League 1 / League 2 in PocketBeane → store `league_key` per PocketBeane league slot.

**Prerequisite:** Y-01

---

### Y-03 · Live Draft Sync via Polling
**Goal:** During a live Yahoo draft, PocketBeane auto-detects new picks and updates the board without manual input.

**Approach:** Poll Yahoo's draft picks endpoint every 8–10 seconds during an active draft session. Diff against local pick state. Apply new picks automatically. Manual input remains as fallback.

**Prerequisite:** Y-01, Y-02

**Note:** Yahoo does not offer WebSocket or webhook events for draft picks. Polling is the correct approach.

---

### Y-04 · Post-Draft Roster Sync
**Goal:** After the draft, pull all team rosters from Yahoo so PocketBeane has full league visibility for season-long features.

**Scope:** Sync all 10 team rosters (not just the user's). Enables opponent roster awareness in trade and waiver analysis.

**Prerequisite:** Y-01, Y-02

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

**Prerequisite:** Y-01, Y-02, Y-04

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
| Y-07 · League Context in AI Recommendations | Done — `/api/yahoo/settings.js` endpoint; "Sync from Yahoo" in setup page; statCategories + rosterPositions threaded into Claude prompt; hardcoded 9-cat string replaced with dynamic scoring line |

---

## Open items (pre-September 2026)

- [ ] Week 5 QA: full mock draft session (13 rounds)
- [ ] Week 5 QA: edge case testing (last-round pick, multi-position, full roster)
- [ ] Week 5 QA: latency benchmark — p95 < 4s for Claude recommendation
- [ ] August 2026: refresh `players.json` with real FantasyPros 2026 ADP export (see PMF-08)

---

## PMF Gap Tickets
*Added June 2026 — derived from cross-referencing PMF simulation tickets against the shipped codebase.*
*Source document: POCKETBEANE_PMF_BACKLOG.md*

Priority: 🔴 CRITICAL (pre-September) · 🟡 HIGH · 🟢 SEASON

---

### PMF-01 · Rate Limiting on /api/recommend 🔴
**PMF source:** C1 (API Key Security — partial gap)

The server-side Claude proxy at `pages/api/recommend.js` has no rate limiting. The PMF ticket requires max 50 API calls per session to prevent cost abuse. The proxy itself is complete; this is the missing enforcement layer.

**What to build:**
- Track call count per session using a server-side counter (Vercel KV, Upstash Redis, or in-memory with edge-safe pattern)
- Return `HTTP 429` with `{ error: 'Rate limit exceeded. Max 50 recommendations per draft session.' }` after the 50th call
- Pass a session identifier from the client (can be a UUID stored in localStorage, sent as a header)
- Log limit hits for monitoring

**Files affected:**
- `pages/api/recommend.js` — add rate limit check at handler entry

**Acceptance criteria:**
- 51st call in a session returns 429 with clear message
- Calls 1–50 behave normally
- Rate limit state does not persist across page refreshes (session-scoped is fine for MVP)

---

### PMF-02 · Philosophy First-Visit Onboarding Quiz 🔴
**PMF source:** C2 (highest-converting feature — 2× conversion rate)

Philosophy IS injected into Claude prompts via the league setup form (`strategy`, `puntCategories`, `injuryTolerance`). What's missing is the **dedicated first-visit quiz UX**: a personality-quiz-style screen shown before the user's first draft, separate from the setup form, with the specific three questions from the simulation.

The setup form is for league configuration. The onboarding quiz is for philosophy capture — the two should be distinct UX moments.

**What to build:**
- `src/components/PhilosophyOnboarding.jsx` — 3-question quiz screen, personality quiz feel (not a settings form)
  - Q1: "How do you handle injury risk?" → Play it safe / Accept risk for upside / Depends on round
  - Q2: "What's your category strategy?" → Compete in all 9 / Punt 1-2 weak categories / Balanced
  - Q3: "What's your roster philosophy?" → Stars and scrubs / Balanced depth / Streaming-friendly
- Store answers as `draftProfile` in localStorage (key distinct from league config):
  ```json
  { "injuryTolerance": "risk_for_upside", "categoryStrategy": "punt_categories",
    "rosterPhilosophy": "stars_and_scrubs", "completedAt": "2026-09-01T10:00:00Z" }
  ```
- Show in `pages/draft.jsx` (or `pages/index.jsx`) before the draft if `draftProfile` is absent
- Skippable with one click — skipping sets `completedAt` so it doesn't reappear
- Map `draftProfile` fields to the existing philosophy keys (`strategy`, `puntCategories`, `injuryTolerance`) so Claude prompts are automatically enriched

**Files affected:**
- New: `src/components/PhilosophyOnboarding.jsx`
- Modified: `src/store/leagueStore.js` — add `draftProfile` field to store (or manage independently in localStorage)
- Modified: `pages/draft.jsx` — show quiz gate before draft if no `draftProfile`

**Acceptance criteria:**
- Quiz appears on first visit to the draft page with no prior `draftProfile`
- Skippable in one click, does not reappear after skip or completion
- Completed profile persists across sessions
- Claude recommendation rationale visibly reflects stated philosophy
- Returning users skip quiz unless they clear their profile

---

### PMF-03 · Freemium Tier Architecture 🔴
**PMF source:** C3 (paywall moment redesign — CRITICAL)

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

**Acceptance criteria:**
- Scout users receive Steps 1–2 recommendations only
- Paywall appears inline when Steps 3–5 would render
- Tier is shown persistently in the UI
- Tier comparison screen appears in onboarding before draft starts
- No arbitrary round cutoff — all gating is feature-based

**Prerequisite:** Billing/subscription layer (Stripe) needed before `userTier` is production-enforced. For MVP, hardcode `userTier = 'scout'` in store and build the UI shells + API enforcement layer so wiring Stripe later requires no structural changes.

---

### PMF-04 · Shareable Draft Recap Card 🟡
**PMF source:** C4 (referral mechanic — word-of-mouth acquisition lives here)

`DraftComplete.jsx` generates a Claude recap with `outlook`, `strengths`, `vulnerabilities`, and `riskNote`. What's missing is the shareable artifact: a clean visual card exportable as PNG that leaguemates see when shared.

**What to build:**
- `src/components/draft/ShareableCard.jsx` — visual card component
  - Overall letter grade (A–F derived from category grades)
  - Top 3 category strengths
  - Top 2 category weaknesses
  - Team name + PocketBeane branding + URL
- PNG export via `html-to-image` or `dom-to-image` (npm packages, no backend needed)
- For free tier: show grade card but blur category breakdown rows ("Upgrade to see full analysis")
- Percentile ranking: "Your draft scored in the Xth percentile of PocketBeane drafts" — seed with mocked distribution until real draft data accumulates

**Files affected:**
- New: `src/components/draft/ShareableCard.jsx`
- Modified: `src/components/draft/DraftComplete.jsx` — render ShareableCard below recap; add "Copy Link" and "Save as Image" buttons

**Acceptance criteria:**
- Card renders cleanly with correct grades
- PNG export works without backend (client-side only)
- Free tier sees grade card, paid tier sees full category breakdown
- PocketBeane branding and URL visible on exported image

---

### PMF-05 · Email Capture + Resend Integration 🟡
**PMF source:** C5 (missing email capture = no re-engagement channel between drafts)

No email infrastructure exists. Free users who draft and close the app cannot be re-engaged. Competitors can poach them in the silence between draft and waiver wire season.

**What to build:**
- `src/components/EmailCapture.jsx` — prompt shown after draft recap grade, before any other CTA
  - Framing: "Get your Monday morning waiver wire digest free. Stay sharp all season."
  - Show grade first, then ask — never gate the recap on email
  - Skippable in one click
  - Single opt-in, no double confirmation for MVP
- `pages/api/capture-email.js` — server-side handler
  - Validate email format
  - Add contact to Resend audience via Resend API
  - Store email + timestamp in response for confirmation
- Resend account setup: free tier supports 3,000 emails/month (sufficient for MVP)
- Email frequency: one digest per week during NBA season (waiver wire focus)

**Files affected:**
- New: `src/components/EmailCapture.jsx`
- New: `pages/api/capture-email.js`
- Modified: `src/components/draft/DraftComplete.jsx` — render EmailCapture after grade display
- Modified: `.env.example` — add `RESEND_API_KEY`

**Acceptance criteria:**
- Email prompt appears below draft grade, never before it
- Skippable with one click
- Submission confirmed with success message
- Email stored in Resend audience and retrievable
- Does not block access to any product feature

---

### PMF-06 · Post-Draft Season Onboarding Bridge 🟢
**PMF source:** S1 (post-draft dropout is a major churn driver)

`season.jsx` is a placeholder. Users who complete a draft and close the app never discover the season management suite. This one-screen bridge is the handoff from acquisition to retention.

**What to build:**
- `src/components/SeasonOnboarding.jsx` — single screen, shown after draft recap
  - Projected best lineup for Week 1 based on drafted roster positions
  - One waiver wire target to monitor (high-stats available player from `players.json`)
  - One category to watch (derived from roster grade weaknesses in DraftComplete data)
  - "Check back Monday for your waiver wire recommendations" calendar prompt
  - Dismissible in one click
- Paid tier only for waiver wire target; free tier sees lineup and category flag only

**Files affected:**
- New: `src/components/SeasonOnboarding.jsx`
- Modified: `src/components/draft/DraftComplete.jsx` — show SeasonOnboarding after recap + EmailCapture

**Acceptance criteria:**
- Appears after draft recap and email capture, before returning to main dashboard
- Week 1 lineup uses actual drafted player data
- Waiver wire target pulled from available players in `players.json`
- Dismissible in one click

---

### PMF-07 · Basic Analytics Foundation 🟡
**PMF source:** Finding 5 (distribution is the unsolved problem — product works, channel is the ceiling)

No analytics exist. Without data on the conversion funnel (visit → draft start → draft complete → season feature viewed → upgrade), it's impossible to measure the impact of any PMF-driven feature change.

**What to build:**
- Vercel Analytics (zero-config, no cookie banner, built into Next.js)
  - Install `@vercel/analytics` and add `<Analytics />` to `pages/_app.jsx`
  - Auto-captures page views, Web Vitals
- Custom event tracking for key funnel moments:
  - `philosophy_onboarding_started`
  - `philosophy_onboarding_completed`
  - `philosophy_onboarding_skipped`
  - `draft_started`
  - `draft_completed`
  - `draft_recap_viewed`
  - `email_captured`
  - `paywall_hit` (with which feature triggered it)
  - `season_page_viewed`
  - `upgrade_cta_clicked`
- Use `track()` from `@vercel/analytics/react` at each event site

**Files affected:**
- Modified: `pages/_app.jsx` — add `<Analytics />`
- Modified: `pages/draft.jsx`, `src/components/draft/DraftComplete.jsx`, `src/components/PhilosophyOnboarding.jsx`, `src/components/PaywallPrompt.jsx` — add `track()` calls at each funnel event

**Acceptance criteria:**
- Page views visible in Vercel Analytics dashboard
- All funnel events trackable in Vercel Analytics custom events view
- No PII in event payloads
- No cookie banner required (Vercel Analytics is cookieless)

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

### PMF-09 · $4.99 Trial Tier Implementation 🟢
**PMF source:** Finding 7 ($4.99 trial tier validated — 38% of trial users upgraded to annual)

The pricing model is validated: $4.99 for draft + 2 weeks of season, then "$14 more for the full season" upgrade prompt (net of trial already paid). This is a monetization tier, not a feature — it requires PMF-03 (tier architecture) and Stripe as prerequisites.

**What to build:**
- Add `'trial'` as a valid `userTier` value alongside `'scout'` and `'gm'`
- Trial tier: full GM features for 14 days post-purchase, then auto-downgrade to Scout
- Trial expiry stored in leagueStore with ISO timestamp
- Upgrade prompt framing: "$14 more for the full season" (not the cold $19 ask)
- Stripe Checkout integration for $4.99 payment
- Webhook handler to set `userTier = 'trial'` + expiry on successful payment

**Files affected:**
- `src/store/leagueStore.js` — add `trialExpiresAt` field
- New: `pages/api/stripe-webhook.js`
- New: `pages/api/checkout.js` (Stripe Checkout session creation)
- Modified: `src/components/PaywallPrompt.jsx` — surface $4.99 trial CTA as primary action, $19 annual as secondary

**Acceptance criteria:**
- Trial users get full GM features for 14 days
- Upgrade prompt shows "$14 more" framing when trial expires
- Stripe webhook correctly sets tier on payment success
- Trial downgrade to Scout is silent (no disruptive modal)

**Prerequisite:** PMF-03 (Freemium Tier Architecture) + Stripe account setup
