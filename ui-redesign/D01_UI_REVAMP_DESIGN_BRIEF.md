# PocketBeane — D-01 Visual Identity & UI Revamp
# Design Research Brief & Direction Document
# Owner: Athavan Elangko | github.com/atgko/pocketbeane
# Prepared: July 2026 | Perspective: Senior product designer, sports & data tools

---

## HOW TO USE THIS DOCUMENT

This is the research deliverable for D-01's "research component (do this
first)" requirement. It contains: competitive landscape analysis, the
recommended visual direction with rationale, a full design token
specification, page-by-page layout guidance, and an anti-pattern
checklist. Hand this to Claude Code as the source of truth for the
revamp. Build order is at the end.

The core problem this document solves: PocketBeane currently looks like
what it is — a functional app assembled fast with Tailwind defaults.
The goal is for it to look like what it actually is underneath: a
serious, opinionated analytics product someone would pay for.

---

# PART 1 — THE COMPETITIVE LANDSCAPE

## What each reference product's design is actually doing

### Sleeper — social-first, draft-as-theater
Sleeper's core design insight is that the draft board is a shared social
experience. They designed the interface as a literal board so users can
see position runs happening and opponents' positional needs at a glance,
castable to a TV, with a Slack/Discord-style chat as the center of
league life. Their dark UI is a lifestyle aesthetic — it says "this is
where your friends hang out," not "this is where you analyze."

**Takeaway for PocketBeane:** The board-view insight is right — during a
draft, information density IS the feature. But the social layer is not
your product. Don't chase Sleeper's chat-first energy.

### Underdog — speed and minimalism
Underdog's app is praised for a clean, minimalist interface where
lineups can be built in under a minute — clear tabs, sticky bottom
navigation, fast contest entry, bright design with dark/light modes.
Every design decision serves speed-to-action for a transactional user.

**Takeaway:** Their navigation discipline (few tabs, sticky, always
visible) is worth stealing. Their brightness and casual energy is not —
PocketBeane is an advisor, not a slot machine.

### FantasyPros — the data dashboard you should NOT copy
FantasyPros is consensus aggregation rendered as tables: rankings,
tiers, columns, expert counts. It's information-rich and visually
anonymous — it looks like a spreadsheet with a nav bar. That's fine for
them because their brand IS the aggregate.

**Takeaway:** This is the critical strategic point. PocketBeane's
product differentiation is "one opinionated call vs. a ranked list."
If PocketBeane looks like FantasyPros, the design actively undermines
the product thesis. Whatever direction you choose, it must NOT read
as "another rankings table."

### Yahoo Sports — mass-market portal
Yahoo Fantasy is designed for the median casual player: white
backgrounds, franchise purple, dense nav, ad slots, editorial content
woven in. It's a portal, not a tool.

**Takeaway:** Nothing to borrow visually. PocketBeane sits ON TOP of
Yahoo as the intelligence layer — it should look like the upgrade,
not the platform.

### The Athletic — editorial authority
The Athletic's design language is confident editorial: serif
headlines, restrained palette, generous whitespace, typography doing
the heavy lifting. It signals "smart people wrote this."

**Takeaway:** This is the closest emotional register to Beane's voice.
The recommendation panel, season outlook, and bold predictions are
editorial content — written analysis with a point of view. They
deserve editorial typography.

### Stathead / Baseball Reference — trust through density
Stathead is unapologetically dense: tabular data, minimal chrome,
serious numerals. Zero decoration, total credibility.

**Takeaway:** For pure data surfaces (player pool, stat tables),
this discipline is right. Numbers formatted beautifully in tabular
figures ARE the aesthetic. Don't decorate data — typeset it.

## What current design research says (2026)

The strongest relevant findings from current UI research:

1. **The pastel-gradient SaaS look is dead.** Design commentary in 2026
   explicitly calls out visual saturation: every dashboard converged on
   pastel gradients, friendly sans-serifs, pill toggles, and decoration
   fluff — and professional users now read that as unfinished thinking.
   The pendulum is toward "structural UI": serif headlines that lend
   weight, ledger-style numerals, interfaces that read as trustworthy
   rather than friendly. This directly validates an editorial-analytical
   direction for PocketBeane.

2. **Color should carry meaning, not decoration.** The 2026 dashboard
   consensus: a neutral base with one or two accents reserved for
   status and calls to action. Red means broken, not "look here."

3. **Dark-first, not inverted-light.** Design dark as the primary
   surface: desaturated hues (not neon), off-white text (not pure
   #FFFFFF), elevated surfaces via subtle lightness steps rather than
   shadows, strict contrast ratios.

4. **Progressive disclosure beats density walls.** Show the
   prioritized answer first, reveal depth on demand. This maps
   perfectly to PocketBeane's product philosophy — one call first,
   supporting data underneath. The AI-native dashboard trend (products
   that summarize and prioritize instead of making users build charts)
   is literally what Beane already does. The UI should dramatize that.

5. **Dark-glass sophistication works for sports data.** Current
   showcase work in sports dashboards pairs immersive context with
   "sophisticated dark-glass UI" — depth through translucency and
   layering rather than borders everywhere.

---

# PART 2 — THE RECOMMENDED DIRECTION

## "The Front Office" — premium analytics with editorial voice

Of D-01's three candidate directions (sports-data minimal /
brand-forward / premium analytics), the recommendation is **premium
analytics as the foundation, with an editorial layer for Beane's
voice.** Not brand-forward — player imagery and team colors are
licensing risk, visual noise, and they make you look like a
platform you're not.

The metaphor that should drive every visual decision: **an MLB front
office war room.** Dark, focused, expensive-feeling. Data rendered
with Bloomberg-terminal discipline. Analysis delivered with the
editorial confidence of The Athletic. One voice in the room (Beane)
whose takes are visually distinct from raw data.

This direction wins because:
- It matches the product thesis (opinionated advisor, not dashboard)
- It's differentiated from every competitor (none of them feel
  "front office")
- It's achievable solo with Tailwind — it's a typography-and-token
  problem, not an illustration problem
- The Moneyball brand gives you a palette story for free (below)

## The brand story in the palette

Keep green — but make it intentional. Tailwind `green-500` (#22c55e)
is the single most recognizable "AI-assembled app" tell. The move is
not to abandon green (it's your equity and it reads "money" and
"go") but to shift it to a deeper, more serious register — and to
pair it with a brass/gold secondary that quietly references the
Oakland Athletics palette. That's the Moneyball tie made visual:
kelly green and gold, desaturated for dark UI. Nobody needs the
reference explained, but people who get it, get it. It becomes a
portfolio talking point: "even the palette encodes the philosophy."

---

# PART 3 — DESIGN TOKEN SPECIFICATION

All tokens go into `tailwind.config.js` as a proper theme extension.
Names below are the semantic tokens components should reference —
never raw hex in component code after this revamp.

## 3.1 Color system

### Surfaces (dark-first, never pure black)

> REVISED July 2026 after a Sleeper competitive comparison. The
> original values (#0B0F0E base, #121816 raised) were too compressed:
> the green undertone was imperceptible on most displays and the
> elevation steps too small for cards to lift off the canvas. The
> revision keeps the front-office restraint but makes the brand hue
> audible in every surface register and roughly doubles each
> elevation step — Sleeper's surface structure at Beane's volume.
> Accents were NOT changed; the canvas was the problem, not the voice.

| Token | Hex | Usage |
|---|---|---|
| `surface-base` | #0E1613 | App background. Deep green-black — green channel sits 8 points above red, so the tint is perceptible. Not gray-900, not #000 |
| `surface-raised` | #17231D | Cards, panels. A real elevation step (~6% lightness + saturation) — cards visibly lift off the canvas |
| `surface-overlay` | #203027 | Modals, dropdowns, hover states on cards |
| `surface-line` | #2C3E34 | Hairline borders, dividers. Borders at ~1px — structure visible but quiet |

### Brand
| Token | Hex | Usage |
|---|---|---|
| `beane-green` | #1DB068 | Primary brand accent. Deeper, less neon than green-500. CTAs, active states, positive deltas |
| `beane-green-dim` | #14724A | Pressed states, subdued positive fills, chart fills at rest |
| `brass` | #C9A227 | Secondary accent — the Moneyball gold. Reserved for premium/identity moments ONLY: Draft DNA card, archetype badges, "Beane's Take" label, percentile/edge highlights. If brass appears more than ~3 times on a screen, it's being overused |

### Text
| Token | Hex | Usage |
|---|---|---|
| `ink-primary` | #E8ECEA | Primary text. Off-white, never #FFFFFF |
| `ink-secondary` | #93A69B | Labels, captions, secondary data. Carries a deliberate green cast — the mid-register stays on-brand (the move Sleeper makes with its inactive-tab blues) |
| `ink-muted` | #64736B | Disabled, placeholders, tertiary metadata. Same green cast, lower volume |

### Semantics (color = meaning, used nowhere else)
| Token | Hex | Usage |
|---|---|---|
| `signal-up` | #2FBF71 | Positive trend/delta only |
| `signal-down` | #E05252 | Negative trend/injury-out/destructive only. Red is never decoration |
| `signal-watch` | #E0A83D | Day-to-day, categories-to-watch, caution states |
| `signal-info` | #4E9CD3 | Neutral informational highlights (sparingly) |

### Contrast requirements (D-01 acceptance criterion)
- `ink-primary` on `surface-base` (#E8ECEA on #0E1613): ~14:1 — passes AAA
- `ink-secondary` on `surface-raised` (#93A69B on #17231D): ~7:1 estimated — verify, comfortably above 4.5:1
- `beane-green` on `surface-base` for text: verify 4.5:1; if used
  for text and it fails, use a lightened text-variant token
  (`beane-green-text` #34C77F) — accent fills and text tints are
  different jobs
- Run every semantic color as text through a contrast checker
  before shipping; adjust lightness, not hue

## 3.2 Typography

Three-font system, each with one job. All available on Google Fonts
(free, self-hostable, no licensing risk):

| Role | Font | Usage |
|---|---|---|
| Display / editorial | **Fraunces** (serif) | Page titles, Beane's Take headers, Season Outlook headlines, Draft DNA archetype names, Bold Predictions. This is "the voice of the front office" — use at 24px+ only, weights 500-600. Never for UI controls |
| UI / body | **Inter** | Everything interactive and structural: nav, buttons, labels, body copy, form fields. Weights 400/500/600 |
| Data | **JetBrains Mono** | ALL numerals in tables, stat lines, ADP values, scores, budgets, timers. Always with `font-variant-numeric: tabular-nums` so columns align. This replaces the current generic mono and makes data feel engineered |

Type scale (rem-based, 1.25 ratio):
- `text-display`: 2.4rem Fraunces 600 — page heroes
- `text-title`: 1.5rem Fraunces 500 — section/panel titles
- `text-heading`: 1.125rem Inter 600 — card headers
- `text-body`: 0.9375rem Inter 400 — default
- `text-label`: 0.8125rem Inter 500, letter-spacing 0.02em,
  uppercase for eyebrow labels
- `text-data`: 0.875rem JetBrains Mono 500 tabular
- `text-data-lg`: 1.25rem JetBrains Mono 600 — hero stats

Rule of thumb: if it's a sentence, Inter. If it's a number, Mono.
If it's Beane speaking or an identity moment, Fraunces.

## 3.3 Spacing, radius, elevation

- Spacing: stay on Tailwind's 4px scale; default card padding
  `p-5` (20px) minimum — the current cramped `p-3`/`p-4` look is a
  vibe-code tell. Whitespace is what makes dense data feel calm.
- Radius: `rounded-xl` (12px) for cards, `rounded-lg` (8px) for
  buttons/inputs, `rounded-full` for pills/badges only. One radius
  language, applied consistently.
- Elevation: NO drop shadows on dark surfaces (invisible anyway).
  Elevation = surface lightness step + optional 1px `surface-line`
  border. For the Draft DNA card and modals only: a faint
  `ring-1 ring-white/5` plus a very subtle radial gradient is
  permitted for the "dark glass" premium feel.

## 3.4 Component system

Three card tiers replace today's uniform card:

1. **Data card** — `surface-raised`, hairline border, dense,
   mono numerals. Player rows, stat tables, standings.
2. **Advisor card ("Beane speaks")** — `surface-raised` with a
   3px `beane-green` left rule and a small brass "BEANE'S TAKE"
   eyebrow label in `text-label`. Fraunces heading, Inter body.
   Used for: recommendations, season outlook, trade verdicts,
   matchup advice. This is the signature component of the app —
   anywhere Claude's analysis appears, it looks like THIS and
   nothing else does.
3. **Identity card** — the premium tier: Draft DNA, archetype
   reveal, share card. Dark glass (subtle gradient
   `from-surface-overlay to-surface-base`), brass accents,
   Fraunces display type. Rare by design.

Buttons:
- Primary: `beane-green` fill, `surface-base` text (dark text on
  green — verify contrast), 8px radius, Inter 600. Hover: +6%
  lightness. No gradients on buttons.
- Secondary: transparent, 1px `surface-line` border,
  `ink-primary` text. Hover: `surface-overlay` fill.
- Destructive: `signal-down` outline style, filled only on
  confirm steps.
- Kill all default focus rings; replace with
  `ring-2 ring-beane-green/60 ring-offset-2 ring-offset-surface-base`.

Badges/pills: position eligibility, injury status, trend arrows —
`rounded-full`, `text-label` size, semantic colors at 15% opacity
fill with full-strength text (e.g. `bg-signal-watch/15
text-signal-watch`). This is how modern data products render
status without visual shouting.

---

# PART 4 — PAGE-BY-PAGE LAYOUT DIRECTION

## 4.1 Homepage — from vertical stack to command center

Current state (assumed): vertical list of leagues + connect button.
Target: a **front-office lobby** that answers "what needs my
attention" in one glance.

Layout (desktop, 12-col grid; mobile stacks in priority order):

1. **Top bar** — wordmark left, league switcher center-left as a
   first-class control (not buried in settings), Yahoo connection
   status + settings right.
2. **Hero status card** (spans 8 cols) — ONE contextual card that
   changes with the calendar:
   - Pre-draft: "NBA Draft in 12 days" + readiness checklist
     (pool refreshed ✓, philosophy set ✓, Yahoo linked ✓)
   - In-season: this week's matchup — opponent, projected
     category split rendered as a 9-segment bar, one Beane line
   - Off-week: roster standing indicator + next action
   This implements the "lead with one number/answer" pattern from
   modern fintech dashboards — the strongest trust signal in
   current design practice.
3. **Beane's Note** (4 cols) — one Advisor card, 2-3 sentences,
   refreshed weekly. The personality anchor of the homepage.
4. **League grid** below — one Data card per league: sport badge,
   record, standing tier (Contender / Bubble / Rebuilding), trend
   arrow. Click-through to that league's hub.

What disappears: any wall of raw controls, any uniform vertical
stack where a draft button sits visually equal to a settings link.
Hierarchy = calendar-aware priority.

## 4.2 Season Hub — from vertical scroll to tabbed workspace

Direct answer to the open question in your ask: **yes, break it up.
Not into separate pages — into tabs within the hub.** Separate
pages fragment a weekly workflow; one infinite vertical scroll
buries it. A persistent sub-navigation preserves flow and gives
each tool room.

Structure:
- **Hub header** (always visible): league name, week number,
  record, standing tier badge, sync-refresh button with
  "as of [date]" staleness stamp (already built — surface it here).
- **Tab bar**: `This Week` · `Waivers` · `Trades` · `League` ·
  `My Team`
  - **This Week** (default tab): matchup advisor + start/sit,
    sport-aware per the earlier decision (full treatment NFL,
    condensed NBA/NHL, pitching-starts panel MLB)
  - **Waivers**: waiver advisor recommendations as Advisor cards
    (top 3, one rationale line each), full FA list below on
    progressive disclosure
  - **Trades**: analyzer (roster-dropdown give/receive) + trade
    value index; verdict renders as an Advisor card with an
    oversized ACCEPT / DECLINE / COUNTER word in Fraunces
  - **League**: the merged League Standing Intelligence panel
    (standings + pulse + opportunity flags from the earlier
    consolidation decision)
  - **My Team**: synced roster, injury badges, trend arrows,
    category profile bars
- Mobile: tab bar becomes a sticky horizontal scroll strip under
  the header (Underdog's sticky-nav discipline, adapted).

The principle throughout: **the recommendation is the interface.**
Every tab leads with Beane's prioritized answer in an Advisor
card; raw data tables sit below it, collapsed by default.
Progressive disclosure isn't just a trend — it's your product
thesis rendered as layout.

## 4.3 Draft board — density is correct here; refine, don't reduce

The draft room is the one surface where information density is the
feature (Sleeper's core insight — a board you read at a glance).
Do not soften it. Refinements only:

- Player pool table moves fully to JetBrains Mono tabular numerals
  — ADP, stats, and value deltas align into scannable columns.
  This one change alone will make the board look professionally
  engineered.
- Value deltas get semantic color: `signal-up` for
  below-ADP-available, `ink-muted` for at-value. Color only where
  it means something.
- Beane's recommendation panel becomes the Advisor card — visually
  distinct from the board for the first time. During a live draft,
  the eye should find "the call" in under a second.
- Drafted-player rows: reduce to 40% opacity + strikethrough
  rather than removal — board history matters for run detection.
- Round/pick ticker in mono at the top; on-the-clock state uses a
  `beane-green` pulse (subtle, 2s ease, no spinning).

## 4.4 Draft DNA card — the flagship artifact

This is the only surface where you spend real visual budget. It
represents the app to everyone who sees a shared screenshot.

- Format: 4:5 primary (feed-friendly), rendered at 2x for
  screenshot sharpness.
- Composition: `surface-base` ground with a barely-there radial
  brass glow top-center → archetype name in Fraunces 600 at
  display size → tagline in Inter italic → three category-edge
  pills (brass borders) → Bold Prediction in a hairline-ruled
  block → wordmark + `pocketbeane.app` footer in `text-label`.
- The archetype icon: NOT an emoji. Commission-quality feel via a
  simple geometric monoline glyph per archetype (a diamond for
  Moneyball GM, ascending steps for Ceiling Chaser, etc.) —
  9 SVGs, single stroke weight, brass stroke. Claude Code can
  generate these as inline SVG; keep them abstract, not
  illustrative.
- No photography, no player likenesses (licensing + noise).

## 4.5 Philosophy quiz & GM profile

- Quiz overlay keeps the dimmed-board backdrop (already correct
  per the onboarding spec) but answer options become large
  tappable cards with Fraunces headers — personality-quiz feel,
  not form feel.
- GM Profile page renders the user's philosophy as a "scouting
  report on you" — Advisor card styling, their three settings as
  brass-labeled attributes. Make users want to screenshot their
  own profile.

---

# PART 5 — THE ANTI-VIBE-CODE CHECKLIST

These are the specific tells that make an app read as
"AI-assembled in a weekend." The revamp is complete only when
every one of these is gone:

- [ ] Tailwind default accent colors used raw (`green-500`,
      `blue-500`, `indigo-600`) → replaced by the token palette
- [ ] Pure `gray-900`/`black` background → `surface-base`
- [ ] Pure white text → `ink-primary`
- [ ] Every card identical (same bg, same border, same radius,
      same padding) → three-tier card system
- [ ] Emoji as functional icons (⚠️ 🏀 ✅ in UI chrome) →
      monoline SVG glyphs or typographic badges. Emoji permitted
      ONLY in Beane's conversational text, never as UI elements
- [ ] System font stack everywhere → Fraunces/Inter/JetBrains Mono
- [ ] `max-w-4xl mx-auto` single-column vertical stack on every
      page → grid layouts with hierarchy
- [ ] Gradient text headings, glassmorphism on every card,
      pill-shaped everything → restraint per the token spec
- [ ] Buttons that are just colored rectangles with default focus
      rings → the button system above
- [ ] Proportional-figure numerals in data tables (columns that
      don't align) → tabular-nums everywhere data appears
- [ ] shadcn/Tailwind-UI default look preserved unmodified →
      every component re-skinned through tokens
- [ ] Red/green used decoratively → semantic colors only

---

# PART 6 — BUILD ORDER FOR CLAUDE CODE

Sequence matters: tokens first so every later step inherits them.

1. **Token foundation** — extend `tailwind.config.js` with the
   full Part 3 system (colors, fonts, type scale). Load the three
   Google Fonts via `next/font` (self-hosted, no layout shift).
   Add `tabular-nums` utility. Nothing visual changes yet.
2. **Global sweep** — replace all raw color classes with semantic
   tokens app-wide. Mechanical, big diff, zero redesign. After
   this commit the app looks 60% more intentional with no layout
   changes.
3. **Component system** — build `Card` (three variants), `Button`
   (three variants), `Badge`, `AdvisorCard`, `TabBar` as shared
   components. Migrate existing surfaces onto them.
4. **Draft DNA card** — the flagship. New composition per 4.4,
   including the 9 monoline archetype SVGs.
5. **Season Hub restructure** — tabbed workspace per 4.2. This is
   the largest layout change; do it after components exist.
6. **Homepage command center** — per 4.1, including the
   calendar-aware hero card.
7. **Draft board refinement** — mono numerals, semantic deltas,
   Advisor-card recommendation panel per 4.3.
8. **A11y pass** — contrast-check every text/surface pair against
   Part 3 requirements; fix focus states; verify keyboard nav on
   the draft board still works with new components.
9. **Mobile pass** — Season Hub sticky tabs, Draft DNA share
   rendering, homepage stack order.

Each step is one Claude Code session with one commit. Steps 1-3
should complete before ANY page-level work — resist the urge to
redesign a page first.

---

# PART 7 — WHAT NOT TO DO

- No player photos, team logos, or league marks — licensing risk
  and visual noise. The brand is typography + palette + voice.
- No illustration packs or stock imagery. The "imagery element"
  acceptance criterion in D-01 is satisfied by the archetype
  glyph system + the dark-glass DNA card treatment — imagery as
  craft, not clip art.
- No light mode in this pass. Dark-first is the product register;
  a light theme doubles the token QA surface for zero personal-use
  benefit. Revisit only if the product goes public.
- No animation framework. CSS transitions on hover/active and the
  one draft-clock pulse are the entire motion budget.
- Do not redesign the recommendation ENGINE output format in this
  ticket — this is a presentation-layer revamp. Prompt/content
  changes are out of scope.

---

*This document satisfies the D-01 research component. The visual
direction is decided: The Front Office — premium analytics
foundation, editorial voice layer, Moneyball palette story.
Token spec is build-ready. Hand Parts 3-6 to Claude Code as the
implementation source of truth.*
