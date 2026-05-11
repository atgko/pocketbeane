# Fantasy Basketball Assistant — Claude Code Project Brief
# Version 1.0 | May 2026 | Owner: Allan Ko | GitHub: atgko

---

## ENTER PLAN MODE

Before writing a single line of code, read this entire brief, confirm your 
understanding, ask any clarifying questions, then produce:

1. A proposed file and folder structure
2. The data schema for the player pool (players.json or API-sourced)
3. The step-by-step logic for the draft day recommendation engine
4. A proposed build order — what gets built first, second, third
5. Any technical risks or gaps to flag before we start

Do not write any code until the plan is approved.

---

## WHAT THIS TOOL IS

A personal fantasy basketball assistant and draft-day co-pilot for two Yahoo 
Fantasy leagues. The tool helps the user make smarter draft picks in real time, 
then continues to provide value throughout the season with waiver wire advice, 
trade recommendations, and weekly performance insights.

The tool has a name and personality — to be determined, but it should feel like 
a confident, knowledgeable GM sidekick. Not a generic dashboard. Not a spreadsheet. 
Something with character.

The primary user is Allan Ko — an experienced fantasy basketball player who drafts 
using an ADP-based value strategy, prioritizes positional scarcity early, then 
builds balance across categories through the middle and late rounds.

---

## LEAGUE SETTINGS

The tool must support two separate leagues with independent settings, rosters, 
and draft boards. Both leagues are on Yahoo Fantasy Basketball.

### Shared defaults (apply to both leagues unless overridden):
- Platform: Yahoo Fantasy Basketball
- Teams per league: 10 teams
- Draft style: Snake (with openness to auction in future)
- League format: Head-to-head (weekly matchups)
- Scoring categories: Points, Rebounds, Assists, Steals, Blocks, Turnovers, 
  FG%, FT%, 3-Pointers Made (9-category standard)
- Roster size: 13 players (standard + bench spots)
- IL slots: Yes — at least 1 IL slot per league
- Positions: PG, SG, SF, PF, C, G, F, UTIL, BN (standard Yahoo layout)

### Per-league configuration:
Each league is set up independently at the start of the season. The user 
inputs league-specific settings (number of teams, draft position, scoring 
tweaks if any) before the draft begins. The tool manages both leagues 
simultaneously with separate rosters, separate drafted player pools, and 
separate recommendations.

---

## DRAFT STRATEGY (encode this into the recommendation engine)

### Philosophy:
- **ADP-first value:** Primary signal is where a player is expected to go 
  (ADP). If a player is available significantly below their ADP, that is 
  a value pick. Flag it.
- **Positional scarcity awareness:** The engine should model position 
  scarcity in real time. If elite PGs are going fast and the user hasn't 
  drafted one, flag the urgency. Centers tend to be scarce — weight this early.
- **Superstar-first, balance after:** In the first 3 rounds, prioritize 
  the best available player by overall value. From round 4 onwards, shift 
  toward filling positional gaps and category balance.
- **Injury risk awareness:** User is flexible — will accept injury risk 
  for elite upside but wants it flagged explicitly so they can decide. 
  Do not hide injury history. Surface it as a factor in the recommendation.
- **Category balance target:** Across 13 rostered players, aim to be 
  competitive in at least 7 of 9 categories. Flag if the roster is 
  trending toward a category weakness.

### What the draft engine recommends each pick:
1. **Best available by value** — who is the highest ADP player still on 
   the board relative to current pick number
2. **Positional urgency flag** — is any position becoming scarce on the 
   board that the user hasn't addressed yet
3. **Category gap flag** — is the user's current roster weak in any 
   tracked category that an available player could address
4. **One recommended pick** — not a list, one primary recommendation with 
   rationale, plus one alternative if the recommendation is a reach

---

## MVP FEATURES — BUILD THESE FIRST

### 1. League Setup
- Input form for each league: number of teams, draft position (1–10), 
  snake order, scoring categories (pre-filled with defaults, editable)
- IL slot configuration per league
- Support for two simultaneous leagues with independent tracking

### 2. Player Pool
- Pre-loaded with top 150–200 NBA players by projected ADP for the 
  upcoming season
- Each player record includes:
  - Name, team, position eligibility (all Yahoo-eligible positions)
  - Prior season stats across all 9 categories (per game averages)
  - ADP (average draft position — 2025-26 season projections)
  - Injury history flag (chronic injury risk: yes/no + brief note)
  - Injury status at draft time (healthy / day-to-day / out)
  - Games played last season (GP — proxy for availability/durability)
  - Age
  - Contract year flag (players in contract years often perform better)

### 3. Draft Day Interface
- Live draft board showing:
  - Full player pool sorted by ADP
  - Clear visual distinction between: available / drafted by user / 
    drafted by opponent
  - Current pick number and which team is on the clock
  - User's current roster with positions filled/remaining
  - Category stat totals for user's current roster (running tally)
- Mark players as drafted (by user or by opponent) with one click or 
  keyboard shortcut — speed matters during a live draft
- AI recommendation panel: surfaces after each opponent pick, 
  recommends who to take with the user's next pick

### 4. AI Recommendation Engine (draft day — multi-step)

Step 1 — Board state assessment
  Scan remaining available players, user's current roster, 
  pick number, and positions still needed

Step 2 — Value identification  
  Flag players available significantly below their ADP 
  (value threshold: available 10+ picks after projected ADP)

Step 3 — Positional scarcity check
  Model how quickly each position is depleting. Flag if 
  elite options at an unfilled position are running out.

Step 4 — Category gap analysis
  Compare user's current roster stat profile against a 
  competitive 9-category benchmark. Flag weak categories.

Step 5 — Recommendation synthesis
  Claude synthesizes steps 1–4 into one primary recommendation:
  - Who to pick and why (value + position + category rationale)
  - Injury flag if applicable
  - One alternative if primary pick is a calculated risk
  - What to watch on the rest of the board (e.g. "grab a C 
    next round — only 4 starting-caliber centers remain")

### 5. Season-Long Assistant (post-draft features — Phase 2)

**Waiver Wire Advisor:**
  - User inputs available free agents (manual for MVP)
  - Tool recommends who to pick up based on current roster gaps, 
    upcoming schedule, injury news, and recent performance trend
  - Flags players on a hot streak worth targeting

**Trade Analyzer:**
  - User inputs a proposed trade (give X, receive Y)
  - Tool evaluates: net category impact, positional balance, 
    buy-low vs sell-high signal, injury risk of incoming player
  - Returns: accept / decline / counter recommendation with rationale

**Weekly Performance Summary:**
  - After each matchup week, user logs result (W/L and categories won/lost)
  - Tool tracks season record, category win rates, roster strengths/weaknesses
  - Flags if a player is overperforming (sell high candidate) or 
    underperforming relative to ADP (buy low or drop candidate)

**Start/Sit Advisor:**
  - User inputs available starters and bench players for the week
  - Tool recommends optimal lineup based on: schedule (games played 
    that week), matchup difficulty, recent form, injury status

---

## EXPLICITLY NOT IN MVP — DO NOT BUILD THESE

- Live Yahoo Fantasy API integration (manual input for MVP — 
  Yahoo OAuth is complex; add in Phase 2 if manual proves limiting)
- Auction draft mode (snake only for MVP — auction is a future feature)
- Mobile layout (desktop first)
- Multi-sport support (NBA only)
- Historical season tracking beyond current season
- Public sharing or multi-user support
- Automatic injury news scraping (user inputs injury status manually 
  or checks Yahoo — real-time scraping is Phase 2)

---

## DATA SOURCES

### Player stats and ADP:
- **Basketball Reference** — historical per-game stats, games played, age
  URL pattern: https://www.basketball-reference.com/leagues/NBA_2025_per_game.html
- **HashtagBasketball** or **FantasyPros** — ADP rankings for Yahoo leagues
  These are manually exportable as CSV before draft season
- **ESPN or Yahoo rankings** — secondary ADP source for cross-reference

### For MVP:
Build a `players.json` file manually curated from the above sources for 
the top 200 players by projected ADP. This mirrors the Wayfound 
`trails.json` approach — curated quality over live API dependency.

Update the player pool once before the September draft. Real-time stat 
updates are a Phase 2 feature.

### Player schema (players.json):
```json
{
  "id": "nikola-jokic",
  "name": "Nikola Jokic",
  "team": "DEN",
  "positions": ["C"],
  "yahoo_positions": ["C"],
  "adp": 1.2,
  "adp_source": "FantasyPros Yahoo 10-team 2025",
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
  "age": 29,
  "injury_risk": false,
  "injury_notes": null,
  "injury_status": "healthy",
  "contract_year": false
}
```

---

## TECH STACK

- **Frontend:** React (JSX) with Tailwind CSS
- **Language:** JavaScript (ES6+) — no TypeScript for MVP
- **AI Engine:** Anthropic Claude API (claude-sonnet-4-20250514), 
  max_tokens: 1024
- **Data:** Local players.json (top 200 players, manually curated)
- **Storage:** localStorage — two league states stored independently
- **Hosting:** Vercel (free tier)
- **Repo:** github.com/atgko/[tool-name-tbd]
- **Design:** Dark mode, sports-analytics aesthetic — think ESPN 
  dark theme meets a confident GM war room. Not generic SaaS.

### Environment variables needed:
```
REACT_APP_ANTHROPIC_API_KEY
```

---

## NAMING — TO BE DECIDED

The tool needs a name with personality. It should feel like a GM sidekick — 
confident, direct, a little opinionated. Think of names that imply intelligence 
applied to basketball decisions. 

Naming session is separate — do not block build progress on this. 
Use "HoopsGM" as a working name until the real name is decided.

---

## BUILD ORDER (confirm or adjust in plan mode)

### Phase 0 (now — pre-build):
- Finalize player pool data source and export top 200 ADP players
- Build players.json with full schema
- Decide tool name

### Phase 1 — MVP (August, targeting September draft):
1. React app scaffold with Tailwind, Vercel deployment
2. League setup form (two leagues, independent settings)
3. Player pool display — searchable, filterable, ADP-sorted
4. Draft day interface — mark picks (user / opponent / available)
5. AI recommendation engine — steps 1–5 above
6. Running roster display with category stat totals
7. Test with a mock draft before the real thing

### Phase 2 — Season-long (October onwards):
8. Waiver wire advisor
9. Trade analyzer  
10. Weekly performance summary
11. Start/sit advisor
12. Optional: Yahoo Fantasy API integration

---

## METRICS TO TRACK

**Draft day:**
- Recommendations followed vs. overridden (and outcome)
- Pick value delta — did recommended picks outperform ADP expectations?
- Category balance at end of draft vs. target benchmark

**Season-long:**
- W/L record per league
- Category win rates (which categories are consistently won/lost)
- Waiver wire pickup success rate (did recommended adds improve the team?)
- Trade recommendation accuracy (did accepted trades improve standing?)

**Personal PM tracking:**
- Mock draft sessions run before September
- AI recommendations followed vs. overridden
- End-of-season league standings (the ultimate product validation)

---

## THE PORTFOLIO STORY

This project is not the primary portfolio piece — Wayfound holds that role. 
This is a fun, technically meaningful side project that demonstrates:
- The same AI product thinking pattern as Wayfound in a different domain
- Real personal usage with measurable outcomes (league standings)
- Ability to scope a multi-phase product with a clear MVP and roadmap

If both projects are complete by early 2027, the portfolio narrative becomes:
"I build AI-powered decision support tools for domains I care about. 
Wayfound helps me plan better outdoor adventures. HoopsGM helps me 
win my fantasy league. The pattern is the skill."

---

## OPEN QUESTIONS FOR PLAN MODE

1. What is the best free data source for current-season NBA ADP rankings 
   that can be exported or scraped cleanly?
2. Should the draft board be a single scrollable list or a tiered 
   round-by-round view?
3. How should the tool handle positional flexibility — players eligible 
   at multiple positions (e.g., Luka at PG/SF)?
4. What is the right keyboard shortcut UX for marking picks during 
   a fast live draft where every second counts?
5. Should both leagues be visible simultaneously (split screen) or 
   toggled with a tab/switcher?

---

## NOW — ENTER PLAN MODE

You have the full context. Please:

1. Confirm your understanding of what this tool is and what it is not
2. Ask any clarifying questions before proceeding
3. Propose a file and folder structure
4. Propose the players.json schema (refine what's above if needed)
5. Outline the draft day recommendation engine in implementation terms
6. Identify technical risks or data sourcing gaps
7. Confirm or adjust the build order

Do not write any code yet. Just plan.
```
