# PocketBeane — Active Backlog

Last updated: 2026-06-15

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
- [ ] August 2026: refresh `players.json` with real FantasyPros 2026 ADP export
