---
target: Draft Board + Season Hub (pages/draft.jsx, pages/season.jsx)
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-05T19-17-14Z
slug: board-season-hub-pages-draft-jsx-pages-season-jsx
---
Method: dual-agent (A: general-purpose design review · B: general-purpose detector/browser evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Clock, live turn badge, refresh counter are strong, but `FilterBar` labels the toggle with the *opposite* of its active state, and the Season Hub header renders a literal empty `"· / matched"` |
| 2 | Match Between System and Real World | 3 | Strong domain language (ADP, R1·#6, Contender/Bubble) undercut by generic SaaS feature names in the editorial slot ("Head-to-Head Matchup Advisor") |
| 3 | User Control and Freedom | 3 | Best-in-class undo (Z, UndoModal, Escape everywhere) — but the 5-refresh cap is a hard, unexplained, unrecoverable wall |
| 4 | Consistency and Standards | 2 | Four button radii live (0/4/8/12px); the shared `Button` primitive is imported zero times on either screen; `color-scheme: dark` is never set, so native `<select>`/scrollbars render in light UA chrome |
| 5 | Error Prevention | 3 | Turn enforcement with reasons and a snake-order guard against 3 consecutive picks are genuinely excellent |
| 6 | Recognition Rather Than Recall | 2 | 6 keyboard shortcuts with no legend visible at rest during a 60-90s pick — the only hint is inside an error message, after the mistake |
| 7 | Flexibility and Efficiency of Use | 3 | Real power (keyboard drafting, `?tab=` deep links, auto-fire on turn) but no pool sorting/saved filters and no keyboard nav on Season Hub tabs |
| 8 | Aesthetic and Minimalist Design | 2 | 9 tinted category pills ungrouped on one card; Value column green on effectively every visible row; brass 1-2×/screen and 0× on My Team; a 704px content column on a 1440px canvas |
| 9 | Error Recovery | 2 | `AdvisorError` component exists and is good, but "Needs Yahoo" is a bare label with no path forward, and one panel still prints raw `err.message` |
| 10 | Help and Documentation | 2 | No shortcut legend, no explanation of the Value delta, the refresh budget, or the standing-tier thresholds; no first-run guidance on the hub |
| **Total** | | **25/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment (Assessment A):** The Draft Board is genuinely specific — density, pick clock, turn-enforcement copy, and recommendation prose could not be reused unchanged by another product. The Season Hub is not: swap "Trade Analyzer" for "Invoice Analyzer" and nothing about the layout, color, or composition would resist. The mechanical cause behind "flat, a lot of green" is measurable, not a vibe: **203 green-tinted text nodes vs. 2 brass on one draft-board render**, because the Value column renders `signal-up` on effectively every visible row (ADP-sorted, so most rows read "ahead of ADP") rather than reserving it for genuine outliers. Typography is inverted twice: the entire Draft Board contains exactly one Fraunces element ("On My Radar," 18px, in the narrowest column), while sentences throughout are set in mono; and the Season Hub's own `<h1>` is plain Inter while the card headings beneath it are Fraunces — the single most identity-bearing element on the page is the least branded thing on it. The Named-Take Rule holds (6 distinct eyebrows, zero repeats) but the regression moved one element down: the button inside every one of those cards reads "Get Beane's Take," six identical times. One structural finding: `RecommendationPanel.jsx`'s `AdvisorCard eyebrow="BEANE'S CORNER"` wraps the pick clock, refresh button, and bid controls — containing zero Claude output — spending roughly half the draft board's entire brass allowance on a control panel, not a take. That's the One Voice Rule running backwards.

**Deterministic scan (Assessment B):** Both the static CLI detector (`detect.mjs` against `pages/draft.jsx`, `pages/season.jsx`, `src/components/draft/`, `src/components/season/`, `src/components/ui/`) and the live browser-injected overlay detector on both surfaces came back **completely clean — zero findings**. This isn't a contradiction of Assessment A: the mechanical scanner catches structural/class-level anti-patterns (arbitrary font sizes, banned utility patterns), not semantic-density judgments like "100% of a column is green" or "the h1 skips the display font" — those require the kind of composition-level read only Assessment A's method can make. Where the two passes *do* overlap, B's independent browser measurements corroborate A's read: computed contrast on player-status badges lands at ~4.81:1 (barely-passing, 12px text); the Draft Board's 3-column grid does not reflow at 390px (`scrollWidth: 920` vs `clientWidth: 390`, horizontally scrollable instead) while the Season Hub *does* reflow to a real single column at the same width — both consistent with A's mobile-layout finding, from opposite ends. B also caught something A didn't call out directly: player-status badges wrap onto their own line at 1440px because name, status text, and warning icon are three separate inline spans with no `whitespace-nowrap` guard (visible on "Anthony Edwards DAY-TO-DAY" and "Trae Young OUT" in the screenshots).

**One B finding flagged with a caveat, not a defect:** the literal `"· / matched"` empty-fraction text B observed on the Season Hub header may be an artifact of the manually-seeded test data missing a roster-match-count field, rather than a bug that would occur against a real Yahoo sync — worth a quick real-data check before treating it as confirmed.

## Overall Impression

The Draft Board's actual thesis — one opinionated call — is real and it lands: "THE CALL / On My Radar," naming Chet Holmgren with specific stats and closing "grab him and you've built a foundation," is the product working exactly as intended. But the screen around that moment doesn't know it's the point: the recommendation prose sits at 12px in the narrowest of three columns while the commodity player table gets the widest column at 14px, and it's rendered in a sea of green that's lost all meaning because it's applied to nearly every row rather than reserved for outliers. The Season Hub's problem is structural before it's chromatic — `max-w-3xl mx-auto` puts a 704px column on a 1440px canvas, which is DESIGN.md's own named anti-pattern (the No-Uniform-Stack Rule), and it's the reason the hub reads generic regardless of what color anything is. Fix the grid first; the color rebalance will have somewhere real to go once it's not fighting an empty page.

## What's Working

1. **The Named-Take Rule held.** Six Advisor cards across both surfaces, six specific eyebrows, zero repeats. Given a homepage regression on this exact rule was found this same week, it's worth knowing precisely: it did not drift on Draft Board or Season Hub.
2. **Someone is actively defending the One Voice boundary.** Explicit code comments decline to wrap deterministic panels (Pitching Starts, Sleeper Radar) in an Advisor card, and the loading-dim treatment deliberately excludes deterministic content so it never fades with Claude's output. That's a maintained discipline, not an accident.
3. **Error prevention on the Draft Board beats most shipped software** — wrong-turn picks get a specific corrective instruction instead of just a disabled control, a snake-order guard refuses a reassignment that would create 3 consecutive picks and says why, and a stale recommendation deliberately stays on screen (dimmed, not blanked) during a refetch because the user is under clock pressure. These read like decisions made after using the product for real, under real time pressure.

## Priority Issues

**[P1] Green carries no scarcity, so nothing can pop.**
Why it matters: this is the literal mechanism behind "a lot of greens but it doesn't pop" — a semantic color applied to ~100% of visible rows (the Value column, category bars) is decoration, which DESIGN.md forbids by name.
Fix: reserve `signal-up` for genuine outliers (top-decile value) and render the rest neutral; same treatment for the category bars. The screen should have roughly 8 green things on it, not 203.
Suggested command: `/impeccable colorize`

**[P1] Brass is present but never the loudest thing — and absent entirely on My Team.**
Why it matters: the product owner named brass as the one accent working and asked to lean into it; right now it's technically within the scarcity ceiling (≤3/screen) while failing the other half of that rule's purpose — it's never what the eye lands on first, and the tab where the user looks at their own team (My Team) has zero brass.
Fix: give brass one large moment per screen — the Season Hub `<h1>` in Fraunces with a brass accent, a brass-bordered treatment on the single top recommendation — and widen the visual gap between brass (`#C9A227`) and the caution-signal amber (`#E0A83D`), which currently read too close together on a dark field.
Suggested command: `/impeccable bolder`

**[P1] The Season Hub is DESIGN.md's own named anti-pattern.**
Why it matters: `max-w-3xl mx-auto` produces a 704px centered column on a 1440px viewport with ~65% of the canvas empty — this is the No-Uniform-Stack Rule verbatim, and it's the single biggest reason the hub could belong to any product, independent of color.
Fix: put the hub on a real 12-column grid — an 8/4 split (active advisor take left, standing/roster/context rail right) fills the canvas and creates structural hierarchy the current tab stack can't.
Suggested command: `/impeccable layout`

**[P2] Six identical CTAs, a self-contradicting toggle, and a dead-end blocked state.**
Why it matters: each Advisor card earns a bespoke eyebrow and then hands the user a boilerplate "Get Beane's Take" button, six times; the player-pool availability toggle's label states the *opposite* of the current filter state; and "Needs Yahoo" is a bare label with no path to actually connect — the single most common state on the hub for anyone not currently OAuth'd.
Fix: name each CTA for its take ("Read the matchup," "Set the lineup," "Price the market"); make the toggle state what's currently showing, not the alternative; turn "Needs Yahoo" into a real button that starts the connect flow.
Suggested command: `/impeccable clarify`

**[P2] Design-system regressions compound across shared and screen-local components.**
Why it matters: the shared `Button` primitive (correct green fill, 8px radius) is imported zero times on either screen — every button is hand-rolled, which is why the system's one saturated CTA moment never actually appears anywhere; a fourth, undocumented 4px radius is live on several Trades/Waivers/This Week controls; two data cards sit at 8px/16px padding against the documented 12px/20px floor; and neither `<html>` nor `<body>` sets `color-scheme: dark`, so the native `<select>` and every scrollbar render in light browser chrome — visibly a stray white bar in the mobile Season Hub screenshot.
Fix: set `color-scheme: dark` at the root; route hub buttons through the shared `Button` component; normalize the two data cards to `rounded-xl p-5`.
Suggested command: `/impeccable harden`

## Persona Red Flags

**Alex (Power User):** Six keyboard shortcuts exist and are displayed nowhere on the board at rest — the only in-context hint is inside an error message, seen only after the mistake, during a 60-90s pick window. The Value column has no legend anywhere in the UI. The refresh budget hard-stops at 5 with no explanation of why or when it resets. Season Hub tabs have no keyboard navigation — Alex must Tab through five buttons individually.

**Sam (Accessibility-Dependent User):** The Season Hub's tab strip announces `role="tablist"`/`role="tab"`/`aria-selected` but has no `aria-controls`, no `role="tabpanel"`, no roving tabindex, and no arrow-key handler — it announces as a tab widget and then doesn't behave like one. The player pool puts `tabIndex={0}`/`aria-selected` on every table row inside a plain `<table>` with no `role="grid"`, making ~300 rows individual tab stops with a meaningless ARIA attribute. A pick-history edit control has hover-only visibility with no `focus-visible` equivalent (unlike its sibling control, which has one) — invisible but still focusable for a keyboard user. Global single-letter shortcuts (U/O/Z) fire regardless of focus context and will collide with screen-reader browse mode.

**Casey (Distracted Mobile User):** Every advisor CTA and the "Refresh"/"Home" links measure roughly 26px tall — well under the 44px touch-target minimum. At 390px the Season Hub's tab strip is wider than the viewport with no fade/chevron cue that "My Team" exists off-screen. On the Draft Board at 390px, the 3-column desktop grid is preserved and made horizontally scrollable rather than restacked — the visible slice is the rank column only, with **no player names on screen at all** in the default scroll position, which directly conflicts with PRODUCT.md's framing of mobile as "a real, supported usage mode," not just non-breaking.

## Minor Observations

- Season Hub header renders a literal `"· / matched"` with an empty numerator when the seeded data lacks a match-count field — flag for a real-data check rather than treat as confirmed against production data.
- The league name prints twice in the Season Hub header (once as the `<h1>`, once again verbatim in the subtitle).
- Trophy emoji (🥇🥈🥉) render as functional rank chrome at `text-4xl` in the Season Recap panel — DESIGN.md explicitly forbids emoji as UI chrome.
- Beane's weekly outlook prose renders in italic Inter — italic sans standing in for "voice" is exactly what the three-font system exists to replace.
- One panel (`RecommendationPanel.jsx`) still prints a raw `err.message` directly, bypassing the `AdvisorError` component built specifically to prevent that.
- "Season Mode" renders in `signal-info` blue as a permanent page-state label — that color is documented as reserved for sparing informational highlights, not a persistent badge.
- Empty roster slots stretch (`flex-1`) to fill the same visual weight as filled slots, so an empty roster reads with similar visual weight to a full one.
- Player-status badges (name + status text + warning icon) wrap onto a second line at 1440px — three separate inline elements with no `whitespace-nowrap` guard (confirmed via DOM, visible on "Anthony Edwards DAY-TO-DAY" and "Trae Young OUT").
- One inconclusive, unreproduced observation: a single screenshot appeared to show a stale/mismatched active-tab highlight; an immediate re-check showed correct state. Flagged for completeness, not treated as a confirmed defect.

## Questions to Consider

- The recommendation — the product's stated thesis — sits at 12px in the narrowest column while the ranked player table gets the widest, brightest column. What would it look like if the take took the center and the pool became the rail?
- The pick clock counts up with no deadline because Yahoo exposes no synced timer — an honest constraint, not an oversight. Is an unactionable count-up better than no clock, or does it manufacture anxiety at exactly the moment the product promised reassurance?
- The Draft Board auto-fires a take on your turn; the Season Hub waits to be asked, six separate times. If the pitch is an opinionated GM who volunteers a call, should the hub open with a take already sitting there — a Monday-morning brief — rather than a row of buttons?
