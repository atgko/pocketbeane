---
name: PocketBeane
description: AI fantasy sports draft co-pilot and season advisor, styled as an MLB front office war room — dark editorial analytics with a Moneyball palette story.
colors:
  surface-base: "#0E1613"
  surface-raised: "#17231D"
  surface-overlay: "#203027"
  surface-line: "#2C3E34"
  beane-green: "#1DB068"
  beane-green-dim: "#14724A"
  beane-green-text: "#34C77F"
  brass: "#B49C27"
  ink-primary: "#E8ECEA"
  ink-secondary: "#93A69B"
  ink-muted: "#7C8D84"
  signal-up: "#2FBF71"
  signal-down: "#E05252"
  signal-watch: "#E0A83D"
  signal-info: "#4E9CD3"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "2.4rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.25
  heading:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.02em"
  micro:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.02em"
  data:
    fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  data-lg:
    fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  control: "8px"
  card: "12px"
  identity: "20px"
  pill: "9999px"
spacing:
  card-padding: "20px"
  identity-padding-x: "36px"
  identity-padding-bottom: "28px"
components:
  button-primary:
    backgroundColor: "{colors.beane-green}"
    textColor: "#06120C"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  button-destructive:
    backgroundColor: "transparent"
    textColor: "{colors.signal-down}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  card-data:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-padding}"
  card-advisor:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-padding}"
  card-identity:
    backgroundColor: "{colors.surface-overlay}"
    rounded: "{rounded.identity}"
    padding: "36px 36px 28px"
  badge:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
---

# Design System: PocketBeane

## Overview

**Creative North Star: "The Front Office"**

PocketBeane is styled as an MLB front office war room: dark, focused, expensive-feeling, where data is rendered with Bloomberg-terminal discipline and analysis is delivered with the editorial confidence of a beat writer who's earned the right to an opinion. It is a premium analytics foundation with one editorial voice layered on top — Beane's takes are visually distinct from the raw board everywhere they appear, because the product's whole thesis is "one opinionated call," not a ranked list or a spreadsheet.

The palette carries the brand story on purpose: a deeper, less-neon green than the default "AI-assembled app" tell, paired with a desaturated brass/gold that quietly nods to the Oakland Athletics — the Moneyball tie made visual without ever needing to explain itself. Confirmed anti-references, deliberately rejected during D-01: Sleeper's chat-first social energy, Underdog's bright casual/slot-machine feel, FantasyPros' spreadsheet-with-a-navbar anonymity, Yahoo's mass-market portal chrome, and generically the 2020s pastel-gradient SaaS look (rounded pill toggles, friendly sans everywhere, decoration standing in for hierarchy).

**Key Characteristics:**
- Dark-first, desaturated green-black surfaces — never pure black or Tailwind gray-900
- Three-font system with one job each: Fraunces (editorial voice), Inter (structure), JetBrains Mono (every number)
- One signature "Beane speaks" component (the Advisor card), visually distinct from raw data everywhere it appears
- Brass/gold is a rare, deliberate accent reserved for identity moments, not a general secondary color
- Flat by default — no drop shadows; depth comes from surface-lightness steps and hairline borders, with one deliberate "dark glass" exception for identity moments

## Colors

A deep green-black canvas with two reserved accents — a serious, deliberately-less-neon green for action, and a Moneyball-brass gold for identity moments only — plus four semantic signal colors that each mean exactly one thing.

### Primary
- **Beane Green** (`#1DB068`): CTAs, active states, positive deltas, the on-the-clock draft pulse. Shifted deeper and less saturated than Tailwind's `green-500` — the single most common "AI-assembled app" tell — so it reads as a considered brand color, not a framework default.
- **Beane Green Dim** (`#14724A`): pressed button states, subdued positive fills, chart fills at rest.
- **Beane Green Text** (`#34C77F`): a lightened, text-safe variant of the brand green for the rare case it needs to render as text on a dark surface — accent fills and text tints are different jobs and use different tokens.

### Secondary
- **Brass** (`#B49C27`): the Moneyball gold. Reserved for premium/identity moments only — the Draft DNA card, archetype badges, the "BEANE'S TAKE" eyebrow label, percentile/edge highlights. Deepened and hue-shifted from `#C9A227` (D-04 step 3, 2026-08-06) — the prior value read too close to `signal-watch`'s caution-amber on a dark field (~7° hue apart, ~9pt lightness apart). The new value pulls brass warmer-yellow and darker, reading as antique gold/coin rather than a second amber alert, while `signal-watch` itself is untouched — it's one of four semantic signals that must hold its family relationship, not a free-floating identity token.
  **The Brass Scarcity Rule.** If brass appears more than roughly three times on one screen, it's being overused — its rarity is what makes it read as premium instead of decorative.

### Neutral
- **Surface Base** (`#0E1613`): the app background. A deep green-black — the green channel sits deliberately above the red channel so the brand tint is perceptible even at near-black, rather than a generic `gray-900`/`#000`.
- **Surface Raised** (`#17231D`): cards and panels — a real elevation step (~6% lightness + saturation over base) so cards visibly lift off the canvas.
- **Surface Overlay** (`#203027`): modals, dropdowns, hover states on cards.
- **Surface Line** (`#2C3E34`): hairline borders and dividers, ~1px — structure stays visible without loud borders everywhere.
- **Ink Primary** (`#E8ECEA`): primary text — off-white, never pure `#FFFFFF`.
- **Ink Secondary** (`#93A69B`): labels, captions, secondary data — carries a deliberate green cast so even mid-emphasis text stays on-brand.
- **Ink Muted** (`#7C8D84`): disabled states, placeholders, tertiary metadata — same green cast, lower volume. Retinted 2026-07-30 from `#64736B` (audit found 124 real call sites at 12px or below, all failing 4.5:1 — the "AA-large-only" exception this token previously carried didn't actually cover any of its real usage). This value clears 4.74:1 on `surface-raised` / 5.25:1 on `surface-base`, so every existing call site now passes AA without a per-site edit.

### Semantic Signals
- **Signal Up** (`#2FBF71`): positive trend or delta, and only that.
- **Signal Down** (`#E05252`): negative trend, injury-out, or a destructive action — and only that. Red is never used decoratively.
- **Signal Watch** (`#E0A83D`): day-to-day/caution states, categories worth watching.
- **Signal Info** (`#4E9CD3`): neutral informational highlights, used sparingly.

**The Meaning-Only Rule.** A signal color means exactly one thing everywhere it appears. Red never means "look here," only "negative/broken"; if a color on screen isn't carrying real semantic weight, it shouldn't be there.

## Typography

**Display Font:** Fraunces (serif), with Georgia as fallback
**Body Font:** Inter, with system-ui as fallback
**Label/Mono Font:** JetBrains Mono, with Fira Code / Consolas as fallback

**Character:** An editorial voice paired with an engineering one. Fraunces carries every moment Beane is speaking or an identity reveal happens; Inter runs the entire interactive/structural surface; JetBrains Mono renders every number in the app so tables read as engineered rather than approximate.

### Hierarchy
- **Display** (Fraunces 600, 2.4rem, line-height 1.15, letter-spacing -0.01em): page heroes, Draft DNA archetype names, Bold Predictions. Never for UI controls.
- **Title** (Fraunces 500, 1.5rem, line-height 1.25): section/panel titles, Season Outlook headlines.
- **Heading** (Inter 600, 1.125rem, line-height 1.35): card headers, Advisor card titles.
- **Body** (Inter 400, 0.9375rem, line-height 1.5): default copy.
- **Label** (Inter 500, 0.8125rem, letter-spacing 0.02em, uppercase for eyebrows): eyebrow labels, badges, captions.
- **Micro** (Inter 600, 0.625rem, letter-spacing 0.02em): added 2026-07-30 to formally document the compact badge/tier-pill/sport-tag step every screen already needed — previously ~40 scattered `text-[9px]`/`text-[10px]`/`text-[11px]` arbitrary values. Badge/tag content only; never body copy or anything a user reads as a sentence.
- **Data** (JetBrains Mono 500, 0.875rem, line-height 1.4, `tabular-nums`): every numeral in tables, stat lines, ADP values, scores, budgets, timers.
- **Data Large** (JetBrains Mono 600, 1.25rem, line-height 1.2, `tabular-nums`): hero stats.

### Named Rules
**The Sentence-or-Number Rule.** If it's a sentence, Inter. If it's a number, Mono. If it's Beane speaking or an identity moment, Fraunces. Nothing crosses lanes.
**The Tabular Rule.** Every numeral in a table or stat line renders in JetBrains Mono with `tabular-nums`. Proportional-figure numerals in a data column — columns that don't align — are the single most common tell of an unfinished data product.

## Layout

A 12-column grid drives command-center surfaces on desktop (e.g. the homepage's 8/4 hero-plus-Beane's-Note split); mobile stacks content in priority order rather than forcing every page into a uniform single column. The Season Hub uses a persistent tab bar (This Week / Waivers / Trades / League / My Team) instead of one long vertical scroll or a set of separate pages, becoming a sticky horizontal-scroll strip on mobile. The draft board keeps its dense three-column desktop layout by design — information density is the feature there — and becomes horizontally scrollable rather than redesigned or clipped at mobile widths.

Card padding has a floor of 20px (`p-5`); cramped padding below that is treated as an unfinished-product tell, since whitespace is what makes dense data feel calm rather than crowded. Identity/glass cards get more generous padding (36px sides, 28px bottom) so they read as rare and premium relative to ordinary data cards.

**The No-Uniform-Stack Rule.** A single `max-w-4xl mx-auto` vertical column repeated on every page is the generic-SaaS tell; hierarchy comes from a real grid, not a list where every element carries equal visual weight.

## Elevation & Depth

Flat by default. No drop shadows anywhere — they're invisible on dark surfaces regardless — so depth is communicated entirely through surface-lightness steps (`surface-base` → `surface-raised` → `surface-overlay`) plus a 1px `surface-line` hairline border. One deliberate exception: identity-tier cards (Draft DNA, modals) get a "dark glass" treatment — a faint `ring-1 ring-white/5` plus a barely-there radial brass glow top-center — reserved for premium/identity moments only, never used on ordinary data or advisor cards.

### Shadow Vocabulary
- **Identity Glass Ring** (`ring: 1px solid rgba(255,255,255,0.05)` + a subtle top-center radial brass gradient): the one elevation exception in the system, identity/glass cards only.

**The Flat-By-Default Rule.** Surfaces are flat at rest — elevation is a lightness step and a hairline border, never a shadow. The one exception (identity glass) exists to make premium moments feel different, not to become a second elevation system.

## Shapes

One radius per tier, applied consistently: `8px` (`rounded-lg`) for buttons, inputs, and controls; `12px` (`rounded-xl`) for data and advisor cards; `20px` (`rounded-[20px]`) for the identity/glass tier only; fully rounded (`rounded-full`) for pills and badges. Borders are hairline (1px, `surface-line`) and are the primary structural device in place of shadows.

**The One-Radius-Per-Tier Rule.** Controls, cards, and identity moments each get exactly one radius value. A fourth, arbitrary radius appearing anywhere else in the app is a regression, not a variant.

## Components

### Buttons
- **Shape:** 8px radius, 10px/18px vertical/horizontal padding, Inter 600 at 13.5px.
- **Primary:** `beane-green` fill with near-black (`#06120C`) text — dark text on the brand green, not white — 6-10% brightness lift on hover. No gradients on any button.
- **Secondary:** transparent fill, 1px `surface-line` border, `ink-primary` text. Hover fills with `surface-overlay`.
- **Destructive:** transparent fill, `signal-down` border and text; filled only on confirm steps.
- **Focus:** a single global `:focus-visible` rule (2px solid `beane-green` at 60% opacity, 2px offset) replaces all default browser focus rings app-wide — deliberately applied at the base layer rather than only inside the shared `Button` component, since many interactive elements predate the design system as raw `<button>`/`<a>`/`<input>` markup.

### Badges
- **Style:** fully rounded pill, Inter 600, label-size text, semantic color at 15% opacity fill with full-strength text color — status conveyed without visual shouting. A compact `sm` size variant exists for dense rows (draft board, Season Hub tables) where the default pill reads too large next to tight data.
- **Tones:** `up` / `down` / `watch` / `info` map directly to the four signal colors. `brass` adds a 35%-opacity brass border on top of a 12%-opacity fill and is reserved for identity/edge callouts, not general status. `neutral` (`surface-overlay` fill, `ink-secondary` text) is the default no-signal case.

### Cards / Containers
Three tiers, never one uniform card — this is the system's central discipline.
- **Data card:** `surface-raised` background, hairline `surface-line` border, 12px radius, 20px padding, dense mono numerals. Player rows, stat tables, standings — anywhere raw data lives.
- **Advisor card ("Beane speaks") — the signature component:** `surface-raised` background and border, plus a 3px `beane-green` left rule and a brass, uppercase eyebrow label. Fraunces heading, Inter body (with `<strong>` spans promoted to full `ink-primary` weight for in-line emphasis). Used for every surface where Claude's analysis actually appears — recommendations, season outlook, trade verdicts, matchup advice — and nowhere else.
  **The One Voice Rule.** Anywhere Claude's analysis appears, it renders as an Advisor card and nothing else does. The moment the green rule and brass eyebrow appear, the user knows Beane is talking, not the board.
  **The Named-Take Rule** (added 2026-07-30): the eyebrow names the *kind* of take — "THE CALL," "THE VERDICT," "THE CEILING," "THE MATCHUP READ" — never a repeated generic default. A screen with several Advisor cards stacked (the draft board, a Season Hub tab) must never show the same eyebrow word twice; each one earns its own label from what the card is actually for. The brass eyebrow is the rarest, most identity-bearing text in the app — it should read as considered every time, not as boilerplate stamped on every card.
- **Identity card — the rare, premium tier:** 20px radius, dark-glass gradient (`surface-overlay` → `surface-base`), a faint white-5% ring, generous 36px/28px padding, center-aligned, Fraunces display type. Reserved for the Draft DNA card and modals — deliberately rare by design.

### Navigation (Tab bar)
Underlined-tab style: the active tab shows `ink-primary` text with a 2px `beane-green` bottom border; inactive tabs sit at `ink-secondary`, brightening to `ink-primary` on hover, with no border. The strip scrolls horizontally with `shrink-0` tabs, so on mobile it becomes a sticky horizontal-scroll strip rather than wrapping or overflowing the viewport.

### Signature component — ArchetypeGlyph
Nine abstract monoline SVG glyphs, one per Draft DNA archetype (diamond, scope, blueprint-triangle, ascending-steps, dice, rising-arrow, sparkle-anchor, pillars, diverging-zigzag), single brass stroke weight, no fills except a few small discovery-marker dots. Deliberately abstract, never illustrative and never emoji — this is what satisfies the product's "one imagery element" without licensing risk (no player likenesses, no team marks) or visual noise.

## Do's and Don'ts

### Do:
- **Do** render every numeral — tables, stat lines, ADP, scores, budgets, timers — in JetBrains Mono with `tabular-nums`.
- **Do** reserve brass for identity/premium moments only, at roughly three or fewer appearances per screen.
- **Do** render every Claude-authored insight as an Advisor card — the green rule plus brass eyebrow is the only signal for "Beane spoke here."
- **Do** give each Advisor card's eyebrow a name specific to what it's for (The Call, The Verdict, The Ceiling) — never reuse the same eyebrow word twice on one screen.
- **Do** keep card padding at a 20px floor; treat cramped padding as an unfinished-product regression, not a density choice.
- **Do** apply the global `:focus-visible` treatment to every interactive element, including raw, pre-design-system `<button>`/`<a>`/`<input>` elements — don't assume the shared `Button`/`TabBar` components cover all of them.

### Don't:
- **Don't** use Tailwind's raw default accent colors (`green-500`, `blue-500`, `indigo-600`) anywhere — always the semantic token.
- **Don't** use a pure `#000000`/`gray-900` background or pure `#FFFFFF` text — `surface-base` and `ink-primary` carry a deliberate green cast instead.
- **Don't** add a drop shadow to a data or advisor card — elevation is a lightness step and a hairline border; the dark-glass ring is reserved for identity cards only.
- **Don't** use emoji as functional UI chrome (icons, status indicators, badges) — emoji are permitted only inside Beane's conversational text, never as interface elements.
- **Don't** force a page into a single `max-w-4xl mx-auto` vertical stack — use a real grid so hierarchy is structural, not just a list.
- **Don't** use red or green decoratively — they mean exactly one thing (negative/positive) everywhere they appear.
