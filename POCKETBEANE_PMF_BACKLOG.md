# PocketBeane — PMF Simulation Findings & Build Backlog
# Generated: June 2026 | Owner: Athavan Elangko | GitHub: atgko/pocketbeane

---

## CONTEXT FOR CLAUDE CODE

This document summarizes a 5-round Product-Market Fit simulation run for
PocketBeane. The simulation exposed key product insights that have been
translated into concrete build tickets below. Use this document to inform
backlog prioritization and feature implementation decisions.

Do not start building any ticket without reading the full context section
first. The "why" behind each ticket matters as much as the "what."

---

## BUILD STATUS CROSS-REFERENCE
*Last verified: June 2026 against codebase at commit cc889a8*

| Ticket | Title | Status | Notes |
|--------|-------|--------|-------|
| C1 | API Key Security | ✅ DONE (partial) | `/api/recommend.js` proxy built; **rate limiting missing** |
| C2 | Philosophy Onboarding Flow | ⚠️ PARTIAL | Philosophy injected into Claude prompts via setup form; **first-visit quiz UX not built** |
| C3 | Paywall Moment Redesign | ❌ NOT BUILT | No tier system at all; P-01 stubs only a refresh gate CTA |
| C4 | Draft Recap & Shareable Grade | ⚠️ PARTIAL | `DraftComplete.jsx` + Claude recap exists; **shareable card (PNG) and percentile ranking missing** |
| C5 | Email Capture on Free Tier | ❌ NOT BUILT | No component, no API route, no Resend integration |
| S1 | Season Management Onboarding | ❌ NOT BUILT | `season.jsx` is a stub only |
| S2 | Monday Waiver Wire Digest | ❌ NOT BUILT | Tracked in BACKLOG.md as Y-05 |
| S3 | Start/Sit Weekly Advisor | ❌ NOT BUILT | Tracked in BACKLOG.md as Y-05 |
| S4 | Trade Analyzer | ❌ NOT BUILT | Tracked in BACKLOG.md as Y-05 |
| S5 | Roster Health Score | ❌ NOT BUILT | Tracked in BACKLOG.md as Y-05 |

### GAP TICKETS (not in BACKLOG.md — added June 2026)
New tickets derived from this cross-reference are appended to BACKLOG.md
under the `## PMF Gap Tickets` section:

| New Ticket | Derived From |
|------------|-------------|
| PMF-01 · Rate Limiting on /api/recommend | C1 (partial gap) |
| PMF-02 · Philosophy First-Visit Onboarding Quiz | C2 (UX gap) |
| PMF-03 · Freemium Tier Architecture | C3 (not built) |
| PMF-04 · Shareable Draft Recap Card | C4 (sharing gap) |
| PMF-05 · Email Capture + Resend Integration | C5 (not built) |
| PMF-06 · Post-Draft Season Onboarding Bridge | S1 (not built) |
| PMF-07 · Basic Analytics Foundation | Finding 5 (distribution) |
| PMF-08 · August 2026 ADP/Stats Data Refresh | Open question → formal ticket |
| PMF-09 · $4.99 Trial Tier Implementation | Finding 7 (validated pricing) |

---

## PMF SIMULATION SUMMARY

### Product
PocketBeane — a Moneyball-philosophy driven fantasy basketball GM assistant.
Helps competitive multi-league players make smarter draft picks in real time,
then manages the season through waiver wire, trade analysis, and start/sit
decisions.

### Target Customer
Competitive multi-league fantasy basketball players with prize pools on the
line. Not casual players. Not novices. People who feel the cost of a wrong
draft pick.

### Positioning (locked after Round 4)
"Most fantasy tools give you a list. PocketBeane gives you a call."

The Moneyball identity is the moat. PocketBeane makes one opinionated
recommendation with rationale — calibrated to the user's stated draft
philosophy. Generic competitors give ranked lists. PocketBeane gives a
decision.

---

## ROUND-BY-ROUND RESULTS

| Round | Reached | Converted | Retained | Revenue | Key Move |
|-------|---------|-----------|----------|---------|----------|
| 1 | 220 | 1% | 55% | $15 | Baseline — unfocused |
| 2 | 280 | 6% | 62% | $57 | Narrowed ICP, pain-first messaging |
| 3 | 300 | 8% | 71% | $114 | Product paywall redesign, referral hook |
| 4 | 320 | 10% | 73% | $209 | Moneyball positioning, philosophy onboarding |
| 5 | 330 | 14% | 76% | $217 | $4.99 trial tier added |

---

## KEY SIMULATION FINDINGS

### Finding 1 — The draft is the acquisition event, not the product
Season management is the product. The draft is how users discover
PocketBeane. The most retentive features — waiver wire digest, start/sit
advisor, trade analyzer — live in the season management suite. Users who
churned did so because they experienced the draft tool but never discovered
the season features. Fix: surface season management value within 48 hours
of draft completion.

### Finding 2 — Philosophy onboarding is the highest-converting feature
Users who completed the 3-question philosophy onboarding (injury risk
tolerance, category strategy, roster philosophy) converted at 2x the rate
of users who skipped it. This is the feature that makes PocketBeane feel
personal and defensible against generic competitors. Every recommendation
must be calibrated to the user's stated philosophy.

### Finding 3 — The paywall moment was wrong
Round 6 cutoff felt arbitrary and created a bait-and-switch perception.
The correct paywall moment is when the user tries to access category gap
analysis mid-draft — a genuine decision moment with real urgency. Moving
the paywall to this moment lifted conversion meaningfully.

### Finding 4 — Positioning beat pricing
When a competitor launched at half the price ($9.99 vs $19), the correct
response was not to drop price or ship more features. Doubling down on
the Moneyball philosophy identity made the competitor look generic by
comparison. "FantasyPros tells you who's available. PocketBeane tells you
who to pick and why." Conversion lifted from 8% to 10% on messaging alone.

### Finding 5 — Distribution is the unsolved problem
Every product and pricing metric trended correctly across 5 rounds. PMF
was not declared because retained customer volume never reached 50 per
1,000 prospects. Reach plateaued at ~330 per 1,000 on Reddit alone. The
product works. The channel is the ceiling. Distribution strategy (podcasts,
influencers, partnerships) is the next frontier — documented in pricing
and distribution backlog for when the product is ready.

### Finding 6 — Email capture is missing infrastructure
No email capture means no way to own the relationship with free users
between draft season and the next touchpoint. Competitors can poach them
in that silence. Email capture must be added at the post-draft recap
moment — show the grade first, then ask.

### Finding 7 — The $4.99 trial tier works
Lower entry price removed the last meaningful conversion objection for
prize pool players. Mental math is instant: worst case $5 lost, best case
win the league. 38% of trial users upgraded to annual — higher than
expected. The upgrade prompt framing matters: "$14 more for the full
season" (net of trial already paid) outperformed the cold $19 ask.

---

## BUILD BACKLOG

### PRIORITY LEGEND
- 🔴 CRITICAL — Must ship before September draft
- 🟡 HIGH — Ship before or during draft week
- 🟢 SEASON — Ship week of draft through first month of season

---

## 🔴 CRITICAL TICKETS — PRE-SEPTEMBER

---

### TICKET C1 — API Key Security via Vercel Serverless Function
**Priority:** 🔴 CRITICAL — resolve before any live demo or public share
**Simulation finding:** PRD flags this as HIGH risk. Non-negotiable.

**Problem:**
Claude API key is currently exposed client-side. Any user who inspects
network requests can extract and abuse the key. This must be resolved
before PocketBeane is shared publicly, demoed in an interview, or used
in a live draft.

**What to build:**
- Create a Vercel serverless function at `/api/recommend`
- Function receives board state from the client, calls Claude API
  server-side, returns recommendation to client
- Client never sees the API key — it lives in Vercel environment
  variables only
- Add basic rate limiting: max 50 API calls per session to prevent abuse
- Remove REACT_APP_ANTHROPIC_API_KEY from frontend entirely

**Files likely affected:**
- New: `/api/recommend.js` (Vercel serverless function)
- Modified: `recommend.js` (change fetch target to `/api/recommend`)
- Modified: `.env` (move key to server-side variable)
- Modified: `vercel.json` (ensure api directory is recognized)

**Acceptance criteria:**
- API key not visible in browser network tab under any circumstance
- Recommendations still return correctly through the serverless function
- Rate limiting returns a clear error message when exceeded
- Deployed and verified on Vercel production environment

---

### TICKET C2 — Philosophy Onboarding Flow
**Priority:** 🔴 CRITICAL
**Simulation finding:** 2x conversion rate for users who completed this.
Highest-leverage feature in the entire simulation.

**Problem:**
PocketBeane currently gives identical recommendation logic to every user.
This makes it feel like a generic tool. The Moneyball positioning requires
the product to feel personal and opinionated.

**What to build:**
- 3-question onboarding screen shown before the user's first draft
- Questions:
  1. "How do you handle injury risk?"
     Options: Play it safe / Accept risk for upside / Depends on round
  2. "What's your category strategy?"
     Options: Compete in all 9 / Punt 1-2 weak categories / Balanced
  3. "What's your roster philosophy?"
     Options: Stars and scrubs / Balanced depth / Streaming-friendly
- Store answers in localStorage as `draftProfile` object
- Pass `draftProfile` into every Claude API recommendation prompt
- Make skippable — but visually compelling, not a modal wall
- Design feel: personality quiz, not a settings form

**draftProfile schema:**
```json
{
  "injuryTolerance": "risk_for_upside",
  "categoryStrategy": "punt_categories",
  "rosterPhilosophy": "stars_and_scrubs",
  "completedAt": "2026-09-01T10:00:00Z"
}
```

**Prompt integration:**
The draftProfile must be injected into the Claude system prompt in
recommend.js so every recommendation references the user's philosophy.
Example addition to system prompt:
"This user plays stars-and-scrubs, is willing to accept injury risk for
elite upside, and punts FT%. Weight recommendations accordingly."

**Files likely affected:**
- New: `src/components/PhilosophyOnboarding.jsx`
- Modified: `src/leagueStore.js` (add draftProfile to state)
- Modified: `src/recommend.js` (inject draftProfile into prompt)
- Modified: `src/App.jsx` (show onboarding before draft if no profile)

**Acceptance criteria:**
- Onboarding appears on first visit before draft starts
- Skippable with one click
- Completed profile persists across sessions via localStorage
- Claude recommendations visibly reflect the stated philosophy
- Returning users skip onboarding unless they reset their profile

---

### TICKET C3 — Paywall Moment Redesign
**Priority:** 🔴 CRITICAL
**Simulation finding:** Round 6 cutoff felt arbitrary. Mid-draft category
gap analysis cutoff created genuine urgency and lifted conversion.

**Problem:**
Current paywall triggers at round 6 regardless of what the user is doing.
This feels arbitrary and created a bait-and-switch perception in simulation
("I thought I had full access"). The correct paywall moment is when the
user actively needs the insight — category gap analysis mid-draft.

**Free tier (The Scout):**
- Full draft board with player pool and ADP sorting
- Basic best-available recommendation (Steps 1-2 of engine only):
  - Step 1: Board state assessment
  - Step 2: Value identification (ADP delta)
- Draft board marking (available / user pick / opponent pick)
- No category gap analysis
- No positional scarcity engine
- No recommendation synthesis (Step 5)
- Watermarked draft recap ("Upgrade to see your full draft grade")

**Paid tier (The GM — $19/season):**
- Full 5-step recommendation engine
- Category gap analysis (Step 3)
- Positional scarcity engine (Step 4)
- Full recommendation synthesis with rationale (Step 5)
- Season management suite (waiver wire, trade analyzer, start/sit)
- Draft recap with full roster grade
- Yahoo OAuth sync (when built)
- Multi-league support (up to 3 leagues)

**Paywall trigger:**
When a free user's recommendation would include category gap or scarcity
analysis, instead show a locked state:
"Category gap analysis is a GM-tier feature. You're currently on Scout.
[Upgrade to GM — $19/season]"

**Critical requirement:**
Free tier must be clearly communicated BEFORE the draft starts — not
discovered mid-draft. Add a tier comparison screen to onboarding.

**Files likely affected:**
- New: `src/components/PaywallPrompt.jsx`
- New: `src/components/TierComparison.jsx`
- Modified: `src/recommend.js` (check tier before returning steps 3-5)
- Modified: `src/leagueStore.js` (add userTier to state)
- Modified: `src/App.jsx` (show tier comparison in onboarding flow)

**Acceptance criteria:**
- Free users receive Steps 1-2 recommendations only
- Paywall appears inline when Steps 3-5 content would be shown
- Paywall screen clearly explains what GM tier unlocks
- Tier shown persistently in UI so user always knows their status
- No arbitrary round cutoff — paywall is feature-based not round-based

---

### TICKET C4 — Draft Recap and Shareable Roster Grade
**Priority:** 🟡 HIGH
**Simulation finding:** Shareable draft recap generated organic leaguemate
curiosity — the referral mechanic lives here. Word-of-mouth acquisition
requires this feature.

**Problem:**
After the draft ends, PocketBeane currently has no post-draft moment.
Users close the app and don't come back. The draft recap is the natural
handoff from acquisition experience to season product.

**What to build:**
- Auto-generated post-draft summary screen when all roster spots filled
- Roster grade across all 9 categories:
  - Project category strength based on drafted players' prior season stats
  - Flag top 3 category strengths and top 2 weaknesses
  - Overall letter grade (A through F)
- Percentile ranking: "Your draft scored in the 74th percentile of
  PocketBeane drafts" (seed with mock draft data initially, build from
  real drafts over time)
- Shareable card:
  - Clean visual showing roster grade and top strengths
  - Exportable as PNG or shareable link
  - Include PocketBeane branding and URL
- For free tier: show grade but watermark category breakdown
  ("Upgrade to see your full category analysis")
- Immediately followed by Season Management Onboarding (Ticket S1)

**Files likely affected:**
- New: `src/components/DraftRecap.jsx`
- New: `src/components/ShareableCard.jsx`
- Modified: `src/leagueStore.js` (add draftComplete state flag)
- Modified: `src/App.jsx` (trigger recap when draft complete)

**Acceptance criteria:**
- Recap auto-appears when final roster spot is filled
- Category grade calculated from actual drafted player stats in players.json
- Shareable card renders cleanly as exportable image
- Free tier sees grade, paid tier sees full breakdown
- Clear CTA to season management features below the recap

---

### TICKET C5 — Email Capture on Free Tier
**Priority:** 🟡 HIGH
**Simulation finding:** Missing email capture meant no way to re-engage
free users between draft and season. Competitors can poach them in silence.

**Problem:**
PocketBeane has no relationship with free users after they close the app.
No email = no re-engagement = silent churn.

**What to build:**
- Email capture prompt shown immediately after draft recap grade reveal
- Framing: "Get your Monday morning waiver wire recommendations delivered
  to your inbox. Free for Scout tier. Enter your email to stay sharp
  all season."
- Show the grade first — then ask for email. Never gate the recap.
- Store email in localStorage for MVP
- Integrate with Resend (free tier — 3,000 emails/month) or Mailchimp
  for actual delivery when ready
- Single opt-in, no double confirmation for MVP
- One email per week during season — waiver wire digest only

**Files likely affected:**
- New: `src/components/EmailCapture.jsx`
- Modified: `src/components/DraftRecap.jsx` (add email capture below grade)
- New: `/api/capture-email.js` (Vercel serverless — store to simple DB
  or Resend contact list)

**Acceptance criteria:**
- Email prompt appears below draft grade, not before it
- Skippable with one click — no friction
- Confirmation message shown on submission
- Email stored and retrievable for future digest sends
- Does not block access to any product feature

---

## 🟢 SEASON TICKETS — SHIP WEEK OF DRAFT THROUGH MONTH 1

---

### TICKET S1 — Season Management Onboarding ("Your Season Starts Now")
**Priority:** 🟢 SEASON — ship same week as draft
**Simulation finding:** Post-draft dropout was a major churn driver. Users
who drafted and went quiet never discovered the season management suite.
The season features are invisible without this bridge.

**Problem:**
Users experience the draft, close the app, and don't return. The product's
best retention features — waiver wire, trade analyzer, start/sit — are
never discovered.

**What to build:**
- Single screen shown immediately after draft recap
- Content:
  - Projected best lineup for Week 1 based on drafted roster
  - One waiver wire target worth monitoring (from available players
    in players.json with high stats and available status)
  - One category to watch based on roster grade weakness
  - Calendar prompt: "Check back Monday for your waiver wire
    recommendations"
- This is one screen, not a full feature build
- Paid tier only for the waiver wire target recommendation
- Free tier sees lineup and category flag only

**Files likely affected:**
- New: `src/components/SeasonOnboarding.jsx`
- Modified: `src/components/DraftRecap.jsx` (trigger after recap)

**Acceptance criteria:**
- Screen appears after draft recap, before returning to main dashboard
- Week 1 lineup uses actual drafted player data
- Waiver wire target pulled from players.json available pool
- Calendar prompt visible and clear
- Dismissible with one click

---

### TICKET S2 — Monday Morning Waiver Wire Digest
**Priority:** 🟢 SEASON — ship Week 1 of NBA season
**Simulation finding:** Single stickiest retention feature in simulation.
Users who engaged with this weekly stayed through the season.

**Problem:**
Fantasy basketball players make waiver wire decisions on Tuesday/Wednesday.
Monday is the decision window. PocketBeane needs to be the first thing
they open Monday morning.

**What to build:**
- User inputs available free agents (manual for MVP — type or paste
  player names, matched against players.json)
- PocketBeane generates top 3 waiver wire recommendations based on:
  - Current roster gaps (positions unfilled or weak category areas)
  - Games played that week (prioritize players with 4+ games)
  - Prior season stats relative to roster needs
  - Injury status (healthy only recommended)
- Recommendation card format:
  - Player name, team, position
  - Why: one sentence rationale tied to roster gap
  - Risk flag if applicable
- Available every Monday — manual trigger for MVP (user clicks
  "Get This Week's Recommendations")
- Email delivery when email capture is integrated

**Files likely affected:**
- New: `src/components/WaiverWireAdvisor.jsx`
- New: `src/pages/SeasonManagement.jsx` (hub for all season features)
- Modified: `src/recommend.js` (add waiver wire prompt template)

**Acceptance criteria:**
- User can input up to 10 available free agents
- Returns exactly 3 recommendations with rationale
- Recommendations account for current roster composition
- Games-played-this-week is factored (requires user to input schedule
  data manually for MVP)
- Paid tier feature — free tier sees one recommendation only

---

### TICKET S3 — Start/Sit Weekly Advisor
**Priority:** 🟢 SEASON — ship Week 1 of NBA season
**Simulation finding:** Thursday start/sit decisions are a natural weekly
re-engagement forcing function. Calendar-driven = habit-forming.

**Problem:**
Weekly lineup decisions are time-sensitive and high-stakes. Players need
a fast, confident recommendation — not a data deep-dive. PocketBeane's
one-recommendation philosophy maps perfectly to this use case.

**What to build:**
- User inputs active roster and bench players for the week
- PocketBeane recommends optimal lineup based on:
  - Games played that week (4-game week > 2-game week for equal players)
  - Recent form (user inputs manually for MVP: hot / cold / neutral)
  - Injury status
  - Matchup quality (basic — user flags easy/hard week manually)
- Output: optimal starting lineup with one-line rationale per decision
- Speed is critical — this must take under 60 seconds to use
- Available Thursday morning before lineup lock

**Files likely affected:**
- New: `src/components/StartSitAdvisor.jsx`
- Modified: `src/pages/SeasonManagement.jsx` (add as tab)
- Modified: `src/recommend.js` (add start/sit prompt template)

**Acceptance criteria:**
- User can input full 13-player roster in under 2 minutes
- Returns complete starting lineup recommendation
- Each decision has exactly one line of rationale
- Games-played weighting is visible in the output
- Works for both leagues independently

---

### TICKET S4 — Trade Analyzer
**Priority:** 🟢 SEASON — ship Week 2-3 of NBA season
**Simulation finding:** Highest perceived value post-draft feature.
Separates PocketBeane from a draft-only tool in the user's mind.

**Problem:**
Trade decisions require synthesizing category impact, positional balance,
injury risk, and buy-low/sell-high timing simultaneously. Most players
either gut-feel it or use a basic value calculator. Neither is good enough.

**What to build:**
- User inputs give side (1-3 players) and receive side (1-3 players)
- PocketBeane evaluates:
  - Net category impact: which of the 9 categories improve or decline
  - Positional balance: does the trade fill or create a roster hole
  - Injury risk: flag any chronic injury concern on incoming players
  - Performance signal: is incoming player above or below ADP trend
    (buy low vs. sell high signal)
- Output format:
  - ACCEPT / DECLINE / COUNTER recommendation (one word, prominent)
  - 3-5 sentence rationale covering the key factors
  - Category impact table: green (improves) / red (declines) per category
  - One alternative if COUNTER is recommended
- Paid tier only

**Files likely affected:**
- New: `src/components/TradeAnalyzer.jsx`
- Modified: `src/pages/SeasonManagement.jsx` (add as tab)
- Modified: `src/recommend.js` (add trade analysis prompt template)

**Acceptance criteria:**
- Supports 1-3 players on each side of the trade
- Category impact calculated from players.json prior season stats
- Returns single ACCEPT / DECLINE / COUNTER verdict prominently
- Rationale is 3-5 sentences maximum — not a data dump
- Works across both leagues independently

---

### TICKET S5 — Roster Health Score
**Priority:** 🟢 SEASON — ship Month 2 of NBA season
**Simulation finding:** Users who churned at month 3 lost visibility into
their team's standing. A weekly health score keeps the product relevant
even in quiet weeks with no action required.

**Problem:**
Between waiver wire Mondays and trade discussions, there are quiet weeks
where users have no reason to open PocketBeane. The health score gives
them a reason to check in and maintains the weekly habit.

**What to build:**
- Single score (1-10) shown on dashboard homepage, updated weekly
- Score calculated from:
  - Category win rate so far this season (user inputs W/L per category)
  - Roster injury exposure (% of roster on injury risk list)
  - Upcoming schedule strength (games played next week vs. league avg)
  - Waiver wire opportunity (are high-value adds available)
- Trend arrow: up / down / flat from last week
- One-line insight below the score:
  "Your rebounding core is healthy but you're thin at PG heading into
  a 4-game week. Check the waiver wire."
- Requires user to input weekly matchup results (W/L + categories won)

**Files likely affected:**
- New: `src/components/RosterHealthScore.jsx`
- New: `src/components/WeeklyMatchupLog.jsx` (input for results)
- Modified: `src/pages/SeasonManagement.jsx` (show score prominently)
- Modified: `src/leagueStore.js` (add matchup history to state)

**Acceptance criteria:**
- Score visible on dashboard without navigating anywhere
- Trend arrow updates each time user logs a new week's result
- One-line insight generated by Claude based on current roster state
- Works independently for both leagues
- Score history viewable (last 8 weeks minimum)

---

## PRICING & DISTRIBUTION BACKLOG
*For when PocketBeane gets serious. Do not build now.*

### Pricing Model (validated by simulation)
- **Free — Scout tier:** Draft board, Steps 1-2 recommendations,
  watermarked recap
- **$4.99 — Draft trial:** Full GM tier through draft + 2 weeks of season
- **$19/season — Single league GM:** Full engine, season management,
  one league
- **$29/season — Multi-league GM:** Full engine, season management,
  up to 3 leagues
- **Upgrade framing for trial users:** "$14 more for the full season"
  (net of $4.99 already paid)

### Distribution Channels (priority order)
1. Reddit — r/fantasybball, r/fantasysports (credibility-first approach,
   not spam — post analysis content, mention PocketBeane as context)
2. Fantasy basketball podcasts — pitch as guest, "I built a Moneyball
   draft tool and used it in my own leagues"
3. Fantasy sports YouTube — mid-tier channels (10-50k subs) are more
   accessible than top tier and have highly engaged audiences
4. Leaguemate referral — shareable draft recap card is the mechanic
5. Twitter/X — fantasy basketball community is active during draft season

### The Distribution Reality Check (from simulation)
PMF metrics (conversion, retention) were achieved by Round 5. Volume
was not. The product works. The channel is the ceiling. One podcast
appearance or one viral Reddit post during draft season is worth more
than months of incremental funnel optimization.

---

## OPEN QUESTIONS FOR FUTURE PLANNING

1. When should Yahoo OAuth integration be prioritized relative to
   season management features? OAuth makes everything better but is
   a meaningful build — manual input works for the September MVP.

2. NHL expansion — architecture is sport-agnostic by design. After the
   NBA September draft, scope NHL as a fast follow using the same
   leagueConfig pattern.

3. Players.json update cadence — current data is pre-2026-27 season.
   Plan for a data refresh in late August when projections and ADP
   rankings are published for the new season.

4. Should the trade analyzer pull opponent roster data? Requires either
   manual input of opponent rosters or Yahoo OAuth integration. Manual
   works for MVP.

---

*Document generated from PMF simulation session — June 2026*
*Next review: Post-September draft with real usage data*
