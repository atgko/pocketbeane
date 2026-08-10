# PocketBeane — Product Requirements Document
# Version 2.0 | June 2026 | Owner: Athavan Elangko

> **Changelog from v1.0:** Yahoo OAuth shipped; architecture migrated to Next.js; in-season management suite added as Phase 2; multi-sport expansion (NHL, NFL, MLB) added as Phase 3; monetization layer added as Phase 4.

---

## 1. Product Summary

PocketBeane is an AI-powered fantasy sports assistant and draft-day co-pilot. It started as a tool for two Yahoo Fantasy Basketball leagues, and has evolved into a platform for serious fantasy players who want an opinionated GM sidekick — one that synthesizes ADP value, positional scarcity, category balance, and injury risk into a single, direct recommendation, then stays relevant throughout the season with waiver wire advice, trade analysis, and weekly lineup optimization.

The tool has personality: a confident GM sidekick, not a generic dashboard. It speaks with authority, flags risk without hiding it, and gives one recommendation at a time rather than a list of options.

**Current name:** PocketBeane

---

## 2. Problem Statement

Live fantasy drafts move fast. Tracking 200 players across ADP value, positional scarcity, category balance, and injury risk simultaneously — while opponents are picking — is cognitively overloaded. No existing tool synthesizes all four signals into a single, actionable recommendation in real time.

Post-draft, the same problem recurs weekly: waiver wire and trade decisions require multi-variable analysis that most players do intuitively and inconsistently.

The problem is not basketball-specific. The same pattern applies to any category-based head-to-head fantasy league. PocketBeane's architecture is sport-agnostic by design.

---

## 3. Goals

### Shipped — Phase 1 (May–June 2026)
- [x] Real-time draft co-pilot: ADP value, positional scarcity, category gap → one recommendation per pick
- [x] Two Yahoo Basketball leagues, independent rosters and draft boards
- [x] Fast pick marking during live draft (keyboard shortcuts U, O, ↑↓, /, Enter, Z)
- [x] Injury flag surface in recommendation
- [x] Claude API proxied server-side (API key never exposed to browser)
- [x] Yahoo OAuth 2.0 integration (AES-256 encrypted session cookie, auto-refresh)
- [x] Yahoo data sync: league settings, stat categories, roster positions, standings, full draft board
- [x] Dynamic scoring categories (AI prompt uses live Yahoo league config, not hardcoded 9-cat)
- [x] Pre-Draft Philosophy Engine (Beane Mode preset + custom strategy per league)
- [x] Sleeper Pick Radar (ADP gap + contract year signal)
- [x] Draft Recap (post-draft Claude analysis, 700 tokens)

### Active — Phase 2 (June–September 2026)
- [ ] Y-02: League selection UI after Yahoo auth (map Yahoo leagues to PocketBeane slots)
- [ ] Y-03: Live draft sync via polling (auto-detect opponent picks every 8–10s, no manual input)
- [ ] Y-04: Post-draft roster sync (all 10 team rosters for full league visibility)
- [ ] Y-05: Season management suite (matchup advisor, waiver wire, trade analyzer, start/sit, league pulse)
- [ ] Y-06: Draft history recap page (round-by-round board, user picks highlighted, trade flags)
- [ ] Week 5 QA: full 13-round mock draft session, edge cases, p95 latency benchmark
- [ ] August 2026: refresh `players.json` with real FantasyPros 2026 ADP export

### Planned — Phase 3 (October 2026+)
- [ ] NHL expansion (positions, categories, and roster slots already stubbed in `sports.js`)
- [ ] NFL expansion (stubbed)
- [ ] MLB expansion (stubbed)
- [ ] Auction draft mode (originally a non-goal — re-evaluate post-September draft)

### Planned — Phase 4 (2027, needs payment infra first)
- [ ] Premium tier: unlimited recommendation refreshes (currently capped at 5 per draft)
- [ ] S-01: AI Autopick during live Yahoo draft (blocked — verify Yahoo write API first)

### Non-goals (still excluded from current scope)
- Mobile layout
- Automatic injury news scraping
- Public sharing or multi-user access
- Historical tracking beyond the current season
- Multi-user / team collaboration

---

## 4. User

**Primary user:** Athavan Elangko — experienced fantasy basketball player, two Yahoo leagues, snake draft format. Drafting strategy is ADP-value-first, positional scarcity aware, superstar-first in early rounds, category balance in middle/late rounds. Accepts injury risk for elite upside but wants it flagged explicitly.

**Future user (Phase 3+):** Other serious multi-sport fantasy players who want the same opinionated GM sidekick for NHL, NFL, or MLB leagues.

---

## 5. League Configuration

### Basketball defaults (configurable per league)

| Setting | Default |
|---|---|
| Platform | Yahoo Fantasy Basketball |
| Teams | 10 |
| Draft style | Snake |
| Format | Head-to-head weekly |
| Scoring | 9-cat: PTS, REB, AST, STL, BLK, TO, FG%, FT%, 3PM |
| Roster | PG, SG, G, SF, PF, F, C, UTIL×2, BN×4, IL×1 |

Stat categories and roster positions are pulled dynamically from Yahoo via `/api/yahoo/settings.js` and override any defaults.

Each league stores: draft position (1–10), drafted player history, current roster, category totals, philosophy preset, and Yahoo league key.

---

## 6. Decisions — Resolved

### 6.1 ADP data source
**Decision: FantasyPros + HashtagBasketball, manually exported CSV before draft.**
FantasyPros free CSV for Yahoo 10-team leagues; HashtagBasketball as cross-reference. No live scraping for MVP.

### 6.2 Draft board view
**Decision: Single scrollable ADP-sorted list, with optional round-view toggle.**
ADP list is the default; round-view is a secondary tab for post-round review.

### 6.3 Positional flexibility
**Decision: Store all Yahoo-eligible positions per player. Track roster slots separately. Allow manual slot assignment.**
Multi-position eligibility factors into scarcity scoring.

### 6.4 Keyboard shortcuts
- `U` — mark selected player as user pick
- `O` — mark selected player as opponent pick
- `↑ / ↓` — move selection up/down the player list
- `/` — jump to search
- `Enter` — confirm pick
- `Z` — undo last pick

### 6.5 League switcher
**Decision: Tab switcher with persistent status bar.**
A persistent bar shows both leagues' current pick number and round at a glance.

### 6.6 API key security
**Decision: Claude calls always proxied through `/api/recommend.js` on the server.** The Anthropic API key is never in the browser bundle. This was identified as Risk 1 in v1.0 and resolved in the Phase 1 build.

### 6.7 State management
**Decision: Zustand for client state.** localStorage used for persistence of league config and draft history. `players.json` is never duplicated in storage — only pick history and slot assignments are persisted.

### 6.8 Yahoo integration
**Decision: Full OAuth 2.0 with server-side token storage.** Tokens are AES-256 encrypted and stored in a server-side cookie. Auto-refresh handles token expiry transparently. Local dev requires HTTPS (mkcert + `cross-env NODE_OPTIONS=--use-system-ca`).

### 6.9 Multi-sport architecture
**Decision: Sport config registry as the single source of truth.** All sport-specific logic (positions, categories, roster slots, benchmarks) lives in `src/config/sports.js`. Adding a new sport requires one config entry and a data file — no other code changes.

---

## 7. Feature Specifications

### 7.1 League Setup

**Trigger:** First launch or "New League" action

**Inputs:**
- League name (free text)
- Sport (NBA initially; NHL / NFL / MLB when Phase 3 ships)
- Number of teams (default: 10)
- User's draft position (1–10)
- Scoring category overrides (checkboxes, pre-filled from Yahoo sync or sport defaults)
- Roster slot counts (driven by sport config)
- IL slot count

**Yahoo sync:** "Sync from Yahoo" in the setup page pulls live stat categories and roster positions from `/api/yahoo/settings.js` and overwrites the form defaults.

**Output:** League config stored to Zustand + localStorage.

---

### 7.2 Player Pool

**Source:** `src/data/players.json` — top 199 players by projected ADP, manually curated from FantasyPros + HashtagBasketball. Refreshed each August before the September draft.

**Per-player record:**

```json
{
  "id": "nikola-jokic",
  "name": "Nikola Jokic",
  "team": "DEN",
  "positions": ["C"],
  "yahoo_positions": ["C"],
  "adp": 1.2,
  "adp_source": "FantasyPros Yahoo 10-team 2026",
  "prior_season": {
    "pts": 26.4, "reb": 12.4, "ast": 9.0,
    "stl": 1.4, "blk": 0.9, "to": 3.5,
    "fg_pct": 0.583, "ft_pct": 0.814, "three_pm": 0.9, "gp": 79
  },
  "age": 30,
  "injury_risk": false,
  "injury_notes": null,
  "injury_status": "healthy",
  "contract_year": false,
  "notes": null
}
```

A `scripts/build-players.js` utility exists for building and validating the player file.

---

### 7.3 Draft Day Interface

```
┌─────────────────────────────────────────────────────┐
│  [League 1]  [League 2]    Pick: 14  Round: 2  🟢   │ ← Status bar
├──────────────────────────┬──────────────────────────┤
│  PLAYER POOL             │  YOUR ROSTER             │
│  [Search...]  [Filters]  │  PG: ___  SG: ___        │
│                          │  SF: ___  PF: ___        │
│  #  Player    Pos  ADP   │  C:  ___  G:  ___        │
│  1  Jokic     C    1.2 ✓ │  F:  ___  UTIL:___       │
│  2  SGA       PG   2.1 ✓ │  BN: ___ ___ ___ ___     │
│  3  Luka      PG   3.0   │                          │
│  4  Giannis   PF   3.8   │  CATEGORY TOTALS         │
│  5  Embiid    C    5.2   │  PTS  REB  AST  STL      │
│  ...                     │  26.4 12.4 9.0  1.4      │
│                          │  BLK  TO   FG%  FT% 3PM  │
│                          │  0.9  3.5  .583 .814 0.9 │
├──────────────────────────┴──────────────────────────┤
│  BEANE'S TAKE                              [Refresh] │
│  "Take Luka Doncic (PG/SF). He's the best available │
│   value at pick 14 — ADP 3.0, flagging an elite PG  │
│   before the position runs dry. Weak in assists;     │
│   Luka fixes that. Alt: Bam Adebayo if you want C   │
│   locked early — only 3 elite centers remain."       │
│                          [Sleeper Radar ▾]           │
└─────────────────────────────────────────────────────┘
```

**Player pool states:**
- Available — default, white text
- Drafted by user — green highlight, checkmark
- Drafted by opponent — dimmed/grey, strikethrough

**Pick flow:**
1. Select a player row (keyboard or click)
2. Press `U` (user pick) or `O` (opponent pick)
3. Press `Enter` to confirm
4. Status updates immediately; AI panel refreshes for next pick

**Filters:** Position, status (available/all), injury status, round-value flag

**Recommendation budget:** 5 manual refreshes per draft session (free tier). Counter visible in UI.

---

### 7.4 Pre-Draft Philosophy Engine (B-01)

Configurable per league before the draft starts. Sets the strategic weighting Claude uses throughout the session.

**Beane Mode (preset):** ADP-value-first, positional scarcity aware, superstar-first in early rounds, category balance in middle/late rounds, injury risk flagged but accepted for elite upside.

**Custom strategy settings:** user can override each axis independently (value vs. upside, safe vs. risky, balanced categories vs. punting).

Stored in localStorage per league. Injected into the Claude system prompt at Step 5.

---

### 7.5 AI Recommendation Engine

Five sequential steps. Steps 1–4 run client-side (instant). Step 5 hits Claude through the server-side proxy.

#### Step 1 — Board State Assessment
Board state including available players sorted by ADP, user roster, current pick, round, empty slots, picks until next turn.

#### Step 2 — Value Identification
ADP gap scoring. `valueGap = player.adp - currentPickNumber`. Flags VALUE_PICK (available 10+ below ADP) and REACH (drafting 5+ above ADP).

#### Step 3 — Positional Scarcity Check
Counts elite players remaining at each position relative to picks until next turn. Flags urgent positions where scarcity is tightening.

#### Step 4 — Category Gap Analysis
Compares current roster averages against empirical benchmarks derived from the top 130 players in `players.json`. Identifies weak categories and scores available players by their contribution to gaps.

#### Step 5 — Claude Synthesis
```
Model: claude-sonnet-4-6 (server-side, /api/recommend.js)
max_tokens: 512
temperature: 0.3

System: You are PocketBeane, a confident fantasy basketball GM sidekick.
        Give one primary recommendation, not a ranked list. Be direct and opinionated.
        [Philosophy preset injected here]

User: [Structured output from Steps 1–4 + dynamic Yahoo scoring categories]
      Give: primary pick + rationale (2–3 sentences), injury flag if applicable,
      one alternative if primary is a risk, one board watch for next round.
```

**Performance requirement:** Response within 4 seconds. Cache the last recommendation; serve cached result if board state unchanged.

---

### 7.6 Sleeper Pick Radar (B-02)

Collapsible panel within the recommendation UI. Surfaces players whose ADP gap and contract-year status suggest outperformance potential. Secondary signal layer on top of Beane's Take.

---

### 7.7 Draft Recap (B-03)

Triggered from the DraftComplete screen. Single Claude call (700 tokens) that analyzes the full draft pick history and returns a summary: team strengths, weak categories, standout value picks, and one risk flag.

---

### 7.8 Yahoo Integration

**Auth flow:** Yahoo OAuth 2.0 → server issues AES-256 encrypted cookie → auto-refresh on expiry. Connect/Disconnect UI on the home page. Local dev requires HTTPS (mkcert).

**API endpoints:**
- `/api/auth/yahoo/login` — initiates OAuth
- `/api/auth/yahoo/callback` — exchanges code for token
- `/api/auth/yahoo/me` — returns current auth state
- `/api/auth/yahoo/disconnect` — clears session
- `/api/yahoo/league.js` — basic league info
- `/api/yahoo/league-full.js` — settings + standings + rosters + full draft board
- `/api/yahoo/settings.js` — stat categories + roster positions for a given league
- `/api/yahoo/my-leagues.js` — list of user's active Yahoo leagues
- `/api/yahoo/sync-draft.js` — draft picks sync

---

### 7.9 Season Management Suite (Phase 2 — Y-05)

Full in-season advisor powered by live Yahoo data. Ships incrementally after the September draft.

| Sub-feature | Description |
|---|---|
| Head-to-head matchup advisor | Weekly outlook vs. current opponent — category projections and lineup suggestions |
| Waiver wire advisor | Recommend adds/drops based on roster gaps, schedule density, recent trend |
| Trade analyzer | Input give/receive — net category impact, positional balance, buy-low/sell-high signal |
| Trade value index | Running power ranking of roster trade value — who to sell high, buy low, or hold |
| Start/sit advisor | Optimal weekly lineup given schedule, matchup, recent form, injury status |
| League pulse | Weekly league-wide summary — who's dominating, who's weak, who might trade |

**Prerequisite:** Y-02 (league selection) + Y-04 (post-draft roster sync).

---

### 7.10 Multi-Sport Expansion (Phase 3)

Sport configs for NHL, NFL, and MLB are already stubbed in `src/config/sports.js` with correct positions, slot eligibility, and category scaffolding. Adding a sport means:
1. Populate the stub config entry (categories, benchmarks, roster slots)
2. Create a `players-{sport}.json` data file
3. Add sport selector to League Setup (already accounts for it in the config model)

No other code changes required by design.

---

## 8. Technical Architecture

### Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (Pages Router), React 19 |
| Language | JavaScript ES6+, JSX (no TypeScript for MVP) |
| Styling | Tailwind CSS |
| State | Zustand (client state) + localStorage (persistence) |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) via server-side proxy |
| Yahoo | Yahoo Fantasy Sports API v2, OAuth 2.0 |
| Data | `src/data/players.json` — 199 players, manually curated |
| Auth | AES-256 encrypted server-side cookie (no third-party auth service) |
| Hosting | Vercel (free tier) |
| Secrets | `ANTHROPIC_API_KEY`, `YAHOO_CLIENT_ID`, `YAHOO_CLIENT_SECRET`, `COOKIE_SECRET` — server-side only |

### File Structure

```
pocketbeane/
├── pages/
│   ├── _app.jsx
│   ├── index.jsx                       # Home — connect Yahoo, league overview
│   ├── draft.jsx                       # Draft day interface
│   ├── setup.jsx                       # League setup form
│   ├── season.jsx                      # Season management hub
│   └── api/
│       ├── recommend.js                # Claude API proxy (server-side only)
│       ├── auth/yahoo/
│       │   ├── login.js
│       │   ├── callback.js
│       │   ├── me.js
│       │   └── disconnect.js
│       └── yahoo/
│           ├── league.js
│           ├── league-full.js
│           ├── settings.js
│           ├── my-leagues.js
│           └── sync-draft.js
├── src/
│   ├── ai/
│   │   ├── boardState.js               # Step 1: board state assessment
│   │   ├── valueCalculator.js          # Step 2: ADP value gap scoring
│   │   ├── scarcity.js                 # Step 3: positional scarcity model
│   │   └── categoryAnalysis.js         # Step 4: category gap analysis
│   ├── components/
│   │   ├── draft/
│   │   │   ├── PlayerPool.jsx
│   │   │   ├── RosterView.jsx
│   │   │   ├── FilterBar.jsx
│   │   │   ├── RecommendationPanel.jsx # Beane's Take + Sleeper Radar
│   │   │   ├── DraftComplete.jsx       # Post-draft recap trigger
│   │   │   └── UndoModal.jsx
│   │   └── league/
│   │       ├── LeagueSetup.jsx
│   │       └── LeagueSwitcher.jsx
│   ├── config/
│   │   └── sports.js                   # Sport config registry (NBA live; NHL/NFL/MLB stubbed)
│   ├── data/
│   │   └── players.json                # 199 players, refreshed each August
│   ├── hooks/
│   │   └── useYahooAuth.js
│   ├── store/
│   │   └── leagueStore.js              # Zustand store
│   └── utils/
│       ├── yahooAuth.js                # Token encryption + refresh
│       ├── roster.js
│       └── snake.js                    # Snake draft order calculator
├── scripts/
│   └── build-players.js               # Player data builder + validator
├── .env.local                         # Local secrets (never committed)
├── .env.example                       # Committed template, no secrets
├── next.config.js
├── tailwind.config.js
└── vercel.json
```

### Storage Schema (localStorage)

```json
{
  "hoopsgm_league_1": {
    "config": {
      "name": "Main League",
      "sport": "nba",
      "numTeams": 10,
      "draftPosition": 3,
      "yahooLeagueKey": "466.l.22207",
      "categories": ["pts", "reb", "ast", "stl", "blk", "to", "fg_pct", "ft_pct", "three_pm"],
      "rosterSlots": { "pgSlots": 1, "sgSlots": 1, ... },
      "ilSlots": 1,
      "philosophy": "beane-mode"
    },
    "draft": {
      "picks": [
        { "playerId": "nikola-jokic", "pickNumber": 1, "by": "opponent" },
        { "playerId": "luka-doncic", "pickNumber": 3, "by": "user" }
      ]
    },
    "assignedSlots": {
      "PG": "luka-doncic",
      "SG": null, "SF": null, "PF": null, "C": null,
      "G": null, "F": null, "UTIL1": null, "UTIL2": null,
      "BN1": null, "BN2": null, "BN3": null, "BN4": null
    }
  }
}
```

### Design System

- **Theme:** Dark mode, sports-analytics aesthetic — ESPN dark meets GM war room
- **Background:** `#0f1117` (near-black), surface `#1a1f2e`
- **Accents:** Green for user picks, muted grey for opponent picks, amber for value flags, red for injury flags
- **Typography:** Tight sans-serif with monospace numbers for stats
- **Density:** High — 15–20 players visible without scrolling on draft board

---

## 9. Build Order

### Phase 1 — MVP (Complete)
- [x] Next.js scaffold + Tailwind + Vercel deployment
- [x] `players.json` (199 players) integrated and rendering
- [x] Claude API proxied through `/api/recommend.js`
- [x] League setup + switcher (two leagues, independent configs)
- [x] Player pool — ADP-sorted, searchable, position-filterable
- [x] Draft board with pick states + keyboard shortcuts
- [x] Roster view + category totals
- [x] Snake order calculator
- [x] Client-side AI engine (Steps 1–4)
- [x] Beane's Take recommendation panel + caching
- [x] Pre-Draft Philosophy Engine (B-01)
- [x] Sleeper Pick Radar (B-02)
- [x] Draft Recap on DraftComplete (B-03)
- [x] Yahoo OAuth 2.0 (Y-01)
- [x] Yahoo data layer (settings, standings, rosters, draft board)
- [x] Dynamic scoring categories in AI prompt (Y-07)

### Phase 2 — Yahoo-Connected Season Hub (June–September 2026)
- [ ] Y-02: League selection UI after auth
- [ ] Y-03: Live draft sync via polling (8–10s interval)
- [ ] Y-04: Post-draft full roster sync
- [ ] Y-05: Season management suite (ships incrementally)
- [ ] Y-06: Draft history recap page
- [ ] Week 5 QA: mock draft, edge cases, latency benchmark
- [ ] August 2026: `players.json` refresh with 2026 ADP

### Phase 3 — Multi-Sport (October 2026+)
- [ ] NHL: populate sport config + `players-nhl.json`
- [ ] NFL: populate sport config + `players-nfl.json`
- [ ] MLB: populate sport config + `players-mlb.json`
- [ ] Sport selector in League Setup
- [ ] Evaluate auction draft mode (post-September decision)

### Phase 4 — Monetization (2027, needs payment infra)
- [ ] Stripe (or similar) billing integration
- [ ] Premium tier: unlimited recommendation refreshes
- [ ] S-01: AI Autopick (blocked — verify Yahoo write API capability first)

---

## 10. Technical Risks

### Risk 1 — API Key Exposure ~~(HIGH)~~ → RESOLVED
Claude calls are proxied through `/api/recommend.js`. The Anthropic API key is a server-side environment variable and never touches the browser bundle.

### Risk 2 — ADP Data Staleness (MEDIUM)
`players.json` is curated once before the draft. Injuries, trades, or suspensions between curation and draft day will make it stale.

**Mitigation:** In-app player edit function for ADP and injury status. Manual update checklist: run 48 hours before draft and morning-of.

### Risk 3 — Claude Latency During Live Draft (MEDIUM)
A live draft gives 60–90 seconds per pick. Claude must return within 4 seconds.

**Mitigation:** Steps 1–4 are client-side and instant. Step 5 is capped at 512 tokens. Pre-trigger the recommendation as soon as an opponent's pick is confirmed (don't wait for user to ask). Measure p95 latency in Week 5 QA.

### Risk 4 — Snake Order Edge Cases (LOW)
Multi-round snake math must handle pick 1 and pick 10 (first/last each direction) correctly.

**Mitigation:** Unit test `src/utils/snake.js` across all 10 positions × 13 rounds.

### Risk 5 — localStorage Size Limits (LOW)
~5MB limit per origin. Two leagues, two sports max at MVP.

**Mitigation:** Only pick history (player IDs + pick numbers) is stored. Full player data is always loaded from the bundled file. Well within limits.

### Risk 6 — Category Benchmark Calibration (LOW)
Static benchmarks could be miscalibrated, skewing category recommendations.

**Mitigation:** Benchmarks in `sports.js` are derived from actual prior-season player pool averages, not guessed.

### Risk 7 — Yahoo API Availability During Live Draft (MEDIUM)
If Yahoo's Fantasy API is slow or down during a live draft, polling sync (Y-03) fails.

**Mitigation:** Manual pick input always works as fallback. Polling failures are surfaced as a banner, not a crash. Retry with exponential backoff.

### Risk 8 — Yahoo Write API for Autopick (HIGH — currently blocked)
S-01 (AI Autopick) requires programmatic draft picks via Yahoo's API. Yahoo's API is largely read-only; write capability for draft picks is unconfirmed.

**Mitigation:** Do not build toward this until verified. If the API doesn't support it, S-01 is permanently removed from the roadmap.

---

## 11. Success Metrics

### Draft Day
- AI recommendation latency: p95 < 4 seconds
- Recommendation followed vs. overridden: tracked per session (qualitative review)
- Category balance at end of draft: competitive in 7 of 9 categories

### Season-Long
- W/L record per league
- Category win rates by week
- Waiver wire add success rate (did the pickup improve standing?)
- Trade recommendation outcome (accept → improved / decline → held or improved)

### Phase 3 Validation
- At least one non-NBA league active and tracked through a full season

### Ultimate validation
End-of-season league standings. The tool either helped or it didn't.

---

## 12. Portfolio Context

PocketBeane is a personal side project demonstrating the same AI decision-support pattern as Wayfound, applied to a different domain. The narrative: "I build AI-powered tools for decisions I care about. Wayfound plans adventures. PocketBeane wins fantasy leagues."

Real personal use creates real feedback. League standings are the product metric. The multi-sport expansion, if it ships, demonstrates that the architecture generalizes — not a one-sport hack.

---

## 13. Open Items

- [ ] Finalize Phase 3 sport priority order (NHL first? NFL?)
- [ ] Decide: build season management UI before or after September draft?
- [ ] Verify Yahoo write API capability (unblocks S-01)
- [ ] Confirm first 2026 draft date (determines August ADP refresh deadline)
- [ ] Evaluate monetization timing — Stripe integration isn't worth the overhead until Phase 3 is live

---

*This document is the source of truth for PocketBeane scope and architecture. Update it as decisions are made.*
