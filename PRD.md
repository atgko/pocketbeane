# PocketBeane — Product Requirements Document
# Version 1.0 | May 2026 | Owner: Allan Ko

---

## 1. Product Summary

PocketBeane is a personal AI-powered fantasy basketball assistant and draft-day co-pilot for two Yahoo Fantasy Basketball leagues. It helps Allan Ko make smarter, faster decisions during live snake drafts, then continues as a season-long advisor for waiver wire moves, trade analysis, and weekly performance review.

The tool has personality — a confident GM sidekick, not a generic dashboard. It speaks with authority, flags risk without hiding it, and gives one recommendation at a time rather than a list of options.

**Working name:** PocketBeane (final name TBD in a separate session)

---

## 2. Problem Statement

Live fantasy drafts move fast. Tracking 200 players across ADP value, positional scarcity, category balance, and injury risk simultaneously — while opponents are picking — is cognitively overloaded. No existing tool synthesizes all four signals into a single, actionable recommendation in real time.

Post-draft, the same problem recurs weekly: waiver wire and trade decisions require multi-variable analysis that most players do intuitively and inconsistently.

---

## 3. Goals

### MVP (Phase 1 — ready before September 2026 draft)
- Provide a real-time draft co-pilot that synthesizes ADP value, positional scarcity, and category gap analysis into one recommendation per pick
- Track two leagues simultaneously with independent rosters, draft boards, and AI recommendations
- Mark picks (user / opponent) in seconds during a live draft — speed is a hard requirement
- Surface injury flags without hiding them

### Phase 2 (October 2026 onwards)
- Waiver wire advisor
- Trade analyzer
- Weekly performance summary and start/sit advisor
- Optional Yahoo Fantasy API integration

### Non-goals (explicitly excluded from MVP)
- Yahoo OAuth / live API integration
- Auction draft mode
- Mobile layout
- Multi-sport support
- Automatic injury news scraping
- Public sharing or multi-user access
- Historical tracking beyond the current season

---

## 4. User

**Primary user:** Allan Ko — experienced fantasy basketball player, two Yahoo leagues, snake draft format. Drafting strategy is ADP-value-first, positional scarcity aware, superstar-first in early rounds, category balance in middle/late rounds. Accepts injury risk for elite upside but wants it flagged explicitly.

---

## 5. League Configuration

Both leagues share these defaults, configurable per-league at setup:

| Setting | Default |
|---|---|
| Platform | Yahoo Fantasy Basketball |
| Teams | 10 |
| Draft style | Snake |
| Format | Head-to-head weekly |
| Scoring | 9-cat: PTS, REB, AST, STL, BLK, TO, FG%, FT%, 3PM |
| Roster size | 13 players |
| IL slots | 1 (minimum) |
| Positions | PG, SG, SF, PF, C, G, F, UTIL, BN |

Each league stores its own: draft position (1–10), drafted player history, current roster, and category totals.

---

## 6. Open Questions — Resolved

### 6.1 Best free ADP data source
**Decision: FantasyPros + HashtagBasketball, manually exported CSV before draft.**

FantasyPros offers a free exportable CSV for Yahoo 10-team leagues (consensus ADP from multiple experts). HashtagBasketball provides position-specific rankings as a cross-reference. Both are available in August before the September draft. ESPN and Yahoo's own rankings serve as tertiary validation. No live scraping for MVP.

### 6.2 Draft board view: scrollable list vs. round-by-round
**Decision: Single scrollable ADP-sorted list, with an optional round-view toggle.**

During a live draft, the user needs to find and mark players quickly. A round-by-round view is post-draft analysis, not draft-day UX. Default to the ADP list; add a round-view mode as a secondary tab for post-round review.

### 6.3 Positional flexibility (multi-position eligibility)
**Decision: Store all Yahoo-eligible positions per player. Track roster slots separately. Allow user to assign a player to any eligible slot manually.**

Multi-position eligibility (e.g., Luka at PG/SF, Bam at PF/C) is a strategic asset. The AI recommendation engine factors in all eligible positions when assessing positional scarcity. The roster UI shows which slot a pick fills and flags if the user has flexibility to move players to unlock a slot.

### 6.4 Keyboard shortcut UX for marking picks
**Decision:** 
- `U` — mark selected player as user pick
- `O` — mark selected player as opponent pick
- `↑ / ↓` — move selection up/down the player list
- `/` — jump to search
- `Enter` — confirm pick (after U or O)
- `Z` — undo last pick

Selection state is visually clear (highlighted row). These shortcuts work without a mouse during a live draft.

### 6.5 Both leagues visible simultaneously or tab-switched
**Decision: Tab switcher with a persistent status bar.**

A split-screen layout is too cluttered during a live draft where focus is critical. A tab switcher (League 1 / League 2) keeps each league's full interface. A persistent status bar at the top shows both leagues' current pick number and round at a glance so the user never loses track of where each draft stands.

---

## 7. Feature Specifications

### 7.1 League Setup

**Trigger:** First launch or "New League" action

**Inputs:**
- League name (free text)
- Number of teams (default: 10)
- User's draft position (1–10)
- Scoring category overrides (checkboxes, pre-filled with 9-cat defaults)
- IL slot count (default: 1)

**Output:** League config stored to localStorage, draft board initialized with full player pool.

**Behavior:** Two leagues configured independently. Both accessible via tab switcher. League state persists across sessions.

---

### 7.2 Player Pool

**Source:** `players.json` — top 200 players by projected ADP, manually curated from FantasyPros + HashtagBasketball before the September draft.

**Per-player record (refined schema):**

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
    "pts": 26.4,
    "reb": 12.4,
    "ast": 9.0,
    "stl": 1.4,
    "blk": 0.9,
    "to": 3.5,
    "fg_pct": 0.583,
    "ft_pct": 0.814,
    "three_pm": 0.9,
    "gp": 79
  },
  "age": 30,
  "injury_risk": false,
  "injury_notes": null,
  "injury_status": "healthy",
  "contract_year": false,
  "notes": null
}
```

**Fields explained:**
- `positions` — actual NBA positions
- `yahoo_positions` — all Yahoo Fantasy eligibility slots (may differ, e.g., a PF/C on Yahoo)
- `adp` — consensus pre-draft ADP for Yahoo 10-team 2026 season
- `injury_risk` — chronic/recurring injury history flag (true = flag this player)
- `injury_notes` — brief note, e.g., "recurring knee issues, missed 20+ games in 2024-25"
- `injury_status` — current status at draft time: `healthy | day-to-day | out | IL`
- `contract_year` — true if the player is in the final year of their contract

---

### 7.3 Draft Day Interface

**Layout:**

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
│  AI RECOMMENDATION PANEL                             │
│  "Take Luka Doncic (PG/SF). He's the best available │
│   value at pick 14 — ADP 3.0, flagging an elite PG  │
│   before the position runs dry. Weak in assists;     │
│   Luka fixes that. Alt: Bam Adebayo if you want C   │
│   locked early — only 3 elite centers remain."       │
└─────────────────────────────────────────────────────┘
```

**Player pool states:**
- Available — default, white text
- Drafted by user — green highlight, checkmark
- Drafted by opponent — dimmed/grey, strikethrough

**Pick flow:**
1. User selects a player row (keyboard or click)
2. Press `U` (user pick) or `O` (opponent pick)
3. Press `Enter` to confirm
4. Player status updates immediately, AI panel refreshes for next pick

**Filters available:**
- Position (PG / SG / SF / PF / C / G / F / UTIL)
- Status (available only / all)
- Injury status (hide day-to-day and out)
- Round value flag (show only players available 10+ picks below ADP)

---

### 7.4 AI Recommendation Engine

The recommendation engine runs in five sequential steps. Steps 1–4 execute client-side in JavaScript (fast, no API call). Step 5 sends a structured context prompt to Claude and returns the recommendation.

#### Step 1 — Board State Assessment
```
Input: full player pool, draft status per player, user roster, pick number
Output: {
  availablePlayers: sorted by ADP ascending,
  userRoster: [player records],
  currentPick: number,
  currentRound: number,
  emptySlots: [position strings],
  picksUntilNextTurn: number (calculated from snake order)
}
```

Snake order math: For a 10-team league, picks go 1–10 in odd rounds, 10–1 in even rounds. `picksUntilNextTurn` = picks between current pick and user's next pick.

#### Step 2 — Value Identification
```
For each available player:
  valueGap = player.adp - currentPickNumber
  if valueGap > 10: flag as VALUE_PICK (available well below expected)
  if valueGap < -5: flag as REACH (would be drafting early relative to ADP)

Output: topValuePicks = availablePlayers sorted by valueGap descending, top 5
```

#### Step 3 — Positional Scarcity Check
```
For each position P:
  eliteAvailable[P] = count of available players at P with ADP <= (currentPick + 30)
  scarcityScore[P] = eliteAvailable[P] / picksUntilNextTurn

Flag positions where:
  - user has 0 players at P AND P is a required slot
  - scarcityScore[P] < 1.5 (running out of quality options before next turn)

Output: urgentPositions = positions flagged, sorted by scarcityScore ascending
```

#### Step 4 — Category Gap Analysis
```
benchmarkPerGame = {
  pts: 20.0, reb: 7.5, ast: 5.0, stl: 1.2, blk: 0.8,
  to: 2.8, fg_pct: 0.470, ft_pct: 0.780, three_pm: 1.8
}

For each category:
  rosterAvg[cat] = average of user's drafted players at that category
  gap[cat] = benchmarkPerGame[cat] - rosterAvg[cat]

weakCategories = categories where gap[cat] > threshold (15% below benchmark)

For each available player, calculate categoryContribution:
  score = sum of (gap[cat] > 0 ? player.prior_season[cat] : 0) for all categories

Output: categoryRecommendations = top 3 players by categoryContribution
```

#### Step 5 — Claude Synthesis
```
Prompt structure sent to claude-sonnet-4-20250514:

System: You are PocketBeane, a confident fantasy basketball GM sidekick. 
        Give one primary recommendation, not a ranked list. Be direct and opinionated.
        
User: [structured board state from steps 1–4]
  - Current pick: {currentPick} (Round {round})
  - Picks until my next turn: {picksUntilNextTurn}
  - Top value picks: {topValuePicks[0..4]}
  - Urgent positions: {urgentPositions}
  - Weak categories: {weakCategories}
  - My current roster: {userRoster}
  - Strategy phase: {round <= 3 ? "superstar-first" : "balance"}
  
  Give me: primary pick + rationale (2–3 sentences), injury flag if applicable,
  one alternative if primary is a risk, and one board watch for the next round.

max_tokens: 512
temperature: 0.3 (consistent, not creative)
```

**Performance requirement:** Claude response must return within 4 seconds. Steps 1–4 run instantly client-side. Only Step 5 hits the API.

**Caching:** Cache the last recommendation. If the board state hasn't changed (no new picks since last recommendation), serve the cached result without a new API call.

---

### 7.5 Season-Long Features (Phase 2)

#### Waiver Wire Advisor
- User manually inputs available free agents (name + recent stats)
- Tool recommends pickups based on: roster gaps, upcoming schedule density, recent trend, injury news
- Flags hot-streak targets

#### Trade Analyzer
- User inputs: give [player A], receive [player B]
- Tool evaluates: net category impact, positional balance impact, buy-low/sell-high signal, injury risk of incoming player
- Returns: Accept / Decline / Counter with rationale

#### Weekly Performance Summary
- User logs weekly result: W/L, categories won/lost
- Tool tracks: season record, category win rates, roster performance vs. projections
- Flags overperformers (sell-high) and underperformers (buy-low or drop)

#### Start/Sit Advisor
- User inputs eligible starters and bench for the week
- Tool recommends optimal lineup: games played that week, matchup difficulty, recent form, injury status

---

## 8. Technical Architecture

### Stack

| Layer | Technology |
|---|---|
| Frontend | React (JSX), Tailwind CSS |
| Language | JavaScript ES6+ (no TypeScript for MVP) |
| AI Engine | Anthropic Claude API (`claude-sonnet-4-20250514`), max_tokens: 512 |
| Data | `players.json` — top 200 players, manually curated |
| Storage | localStorage (two league states stored independently) |
| Hosting | Vercel (free tier) |
| Environment | `REACT_APP_ANTHROPIC_API_KEY` |

### File and Folder Structure

```
hoopsgm/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── draft/
│   │   │   ├── DraftBoard.jsx          # Main draft board, player list
│   │   │   ├── PlayerRow.jsx           # Single player row with pick controls
│   │   │   ├── FilterBar.jsx           # Position/status filters
│   │   │   └── RecommendationPanel.jsx # AI recommendation display
│   │   ├── roster/
│   │   │   ├── RosterView.jsx          # User's current roster grid
│   │   │   ├── CategoryTotals.jsx      # Running 9-cat stat totals
│   │   │   └── PositionSlot.jsx        # Individual roster slot
│   │   ├── league/
│   │   │   ├── LeagueSetup.jsx         # League config form
│   │   │   └── LeagueSwitcher.jsx      # Tab switcher + status bar
│   │   └── shared/
│   │       ├── SearchBar.jsx
│   │       └── StatusBadge.jsx         # Injury/value/scarcity badges
│   ├── engine/
│   │   ├── boardState.js               # Step 1: board state assessment
│   │   ├── valueCalculator.js          # Step 2: ADP value gap scoring
│   │   ├── scarcity.js                 # Step 3: positional scarcity model
│   │   ├── categoryAnalysis.js         # Step 4: category gap analysis
│   │   └── promptBuilder.js            # Step 5: build Claude prompt
│   ├── hooks/
│   │   ├── useDraftState.js            # Draft board state and pick actions
│   │   ├── useLeague.js                # League config and switcher
│   │   └── useRecommendation.js        # Claude API call + caching
│   ├── services/
│   │   └── claude.js                   # Anthropic API client wrapper
│   ├── data/
│   │   └── players.json                # Top 200 players, pre-curated
│   ├── constants/
│   │   ├── categories.js               # 9-cat definitions + benchmarks
│   │   ├── positions.js                # Yahoo position slots
│   │   └── snakeDraft.js               # Snake order calculator
│   ├── utils/
│   │   └── draft.js                    # Pick helpers, roster validators
│   ├── App.jsx
│   └── index.js
├── .env                                # REACT_APP_ANTHROPIC_API_KEY
├── .env.example                        # Committed template, no secrets
├── package.json
├── tailwind.config.js
└── vercel.json
```

### Storage Schema (localStorage)

```json
{
  "hoopsgm_league_1": {
    "config": {
      "name": "Main League",
      "numTeams": 10,
      "draftPosition": 3,
      "categories": ["pts", "reb", "ast", "stl", "blk", "to", "fg_pct", "ft_pct", "three_pm"],
      "ilSlots": 1
    },
    "draft": {
      "picks": [
        { "playerId": "nikola-jokic", "pickNumber": 1, "by": "opponent" },
        { "playerId": "shai-gilgeous-alexander", "pickNumber": 2, "by": "opponent" },
        { "playerId": "luka-doncic", "pickNumber": 3, "by": "user" }
      ]
    },
    "rosterSlots": {
      "PG": "luka-doncic",
      "SG": null,
      "SF": null,
      "PF": null,
      "C": null,
      "G": null,
      "F": null,
      "UTIL": null,
      "BN1": null,
      "BN2": null,
      "BN3": null,
      "BN4": null,
      "BN5": null
    }
  },
  "hoopsgm_league_2": { ... }
}
```

The full `players.json` is never duplicated in localStorage — only pick history and slot assignments are stored. Player data is always loaded from the bundled file.

### Design System

- **Theme:** Dark mode, sports-analytics aesthetic — ESPN dark theme meets GM war room
- **Colors:** Near-black background (`#0f1117`), dark surface (`#1a1f2e`), accent green for user picks, muted grey for opponent picks, amber for value flags, red for injury flags
- **Typography:** Monospace or tight sans-serif numbers for stats; clear hierarchy between player name, position badge, and ADP
- **Density:** High — the draft board needs to show 15–20 players without scrolling

---

## 9. Build Order

### Phase 0 — Pre-build (May–August 2026)
1. Export top 200 player ADP from FantasyPros (Yahoo 10-team, 2026 projections)
2. Cross-reference with HashtagBasketball positional rankings
3. Build `players.json` with full schema — all 200 players, all fields populated
4. Decide tool name (separate session)
5. Set up GitHub repo and Vercel project

### Phase 1 — MVP (August 2026, ready for September draft)

**Week 1: Foundation**
- [ ] React app scaffold with Tailwind CSS
- [ ] Vercel deployment configured
- [ ] `players.json` integrated and rendering
- [ ] `.env` setup with Claude API key

**Week 2: League Setup + Player Pool**
- [ ] League setup form — two leagues, independent configs stored to localStorage
- [ ] League switcher tab component + persistent status bar
- [ ] Player pool display — ADP-sorted, searchable, position-filterable

**Week 3: Draft Board**
- [ ] Draft board with pick state (available / user / opponent)
- [ ] Keyboard shortcut system (U, O, ↑↓, /, Enter, Z)
- [ ] Roster view with position slots and running category totals
- [ ] Snake order calculator and pick number tracking

**Week 4: AI Engine**
- [ ] Client-side engine: boardState, valueCalculator, scarcity, categoryAnalysis
- [ ] Claude API integration (claude.js + useRecommendation hook)
- [ ] Prompt builder and recommendation panel
- [ ] Recommendation caching

**Week 5: Polish + Testing**
- [ ] Mock draft session — full 13-round draft with a friend or alone
- [ ] Edge case testing: last pick in round, multi-position players, all positions filled
- [ ] Performance check: recommendation latency under 4 seconds
- [ ] Visual polish — badge system, colour coding, injury flags

### Phase 2 — Season-long (October 2026+)
- Waiver wire advisor
- Trade analyzer
- Weekly performance summary + start/sit advisor
- Yahoo API integration (if manual input proves limiting)

---

## 10. Technical Risks

### Risk 1 — API Key Exposure (HIGH)
**Problem:** `REACT_APP_ANTHROPIC_API_KEY` is a client-side React env variable, visible in the browser bundle. Anyone who inspects the built app can extract the key.

**Mitigation for MVP (personal use):** Acceptable for a personal-use tool with no public access. Document clearly: never deploy publicly without moving the Claude call to a serverless function proxy. Vercel Functions can act as the proxy in Phase 2 with one route.

**Mitigation for Phase 2:** Add `/api/recommend` Vercel Function to proxy the Claude call — API key lives server-side only.

### Risk 2 — ADP Data Staleness (MEDIUM)
**Problem:** `players.json` is curated once before the draft. Injuries, trades, or suspensions between curation and draft day will make the data stale.

**Mitigation:** Build an in-app "edit player" function so ADP and injury status can be updated manually on draft day. Document the update checklist: run it 48 hours before draft and morning-of.

### Risk 3 — Claude Latency During Live Draft (MEDIUM)
**Problem:** A live draft may give only 60–90 seconds per pick. Claude synthesis must return in time to be useful.

**Mitigation:** Steps 1–4 are client-side and instant. Only Step 5 hits Claude. Cap tokens at 512. Test and measure p95 latency. If latency is consistently above 3 seconds, pre-trigger the recommendation as soon as the opponent's pick is confirmed (don't wait for the user to ask).

### Risk 4 — Snake Order Edge Cases (LOW)
**Problem:** Multi-round snake order math must correctly compute the user's pick number in every round, especially if the user is pick 1 or 10 (first/last in each direction).

**Mitigation:** Unit test the snake calculator with all 10 draft positions across 13 rounds before the draft.

### Risk 5 — localStorage Size Limits (LOW)
**Problem:** localStorage has a ~5MB limit per origin. Two leagues with full draft histories could approach this.

**Mitigation:** Already mitigated by design — only pick history (player IDs + pick numbers) is stored in localStorage, not the full player pool. 13 picks × 2 leagues × ~50 bytes per record = well under limits.

### Risk 6 — Category Benchmark Calibration (LOW)
**Problem:** The category gap analysis benchmarks are static estimates. If they're miscalibrated, the category recommendations will be misleading.

**Mitigation:** Derive benchmarks from actual prior-season data in `players.json` — calculate what the top 130 players average across each category (130 players across 10 teams × 13 roster spots). This makes the benchmark empirically grounded, not guessed.

---

## 11. Success Metrics

### Draft Day
- AI recommendation latency: p95 < 4 seconds
- Recommendation followed vs. overridden: tracked per session (qualitative)
- Category balance at end of draft: competitive in 7 of 9 categories

### Season-long (tracked manually)
- W/L record per league
- Category win rates by week
- Waiver wire add success (did the pickup improve standing?)
- Trade recommendation outcome (accept → improved / declined → stayed same)

### Ultimate validation
- End-of-season league standings. The tool either helped or it didn't.

---

## 12. Portfolio Context

PocketBeane is a personal side project demonstrating the same AI decision-support pattern as Wayfound, applied to a different domain. The narrative: "I build AI-powered tools for decisions I care about. Wayfound plans adventures. PocketBeane wins fantasy leagues."

Real personal use creates real feedback. League standings are the product metric.

---

## 13. Open Items Before Build Starts

- [ ] Finalize tool name (separate session — don't block build)
- [ ] Export 2026 ADP CSV from FantasyPros and build `players.json`
- [ ] Confirm GitHub repo name and Vercel project name
- [ ] Confirm Phase 1 target date (first draft date in September 2026)
- [ ] Decide: proxy Claude calls through Vercel Function from day one, or accept client-side key risk for MVP?

---

*This document is the source of truth for PocketBeane MVP scope and architecture. Update it as decisions are made.*
