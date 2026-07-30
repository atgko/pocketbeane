---
timestamp: 2026-07-30T14-52-57Z
slug: pages-index-jsx-pages-draft-jsx-pages-season-jsx
---
Method: dual-agent (A: design-review sub-agent · B: detector+browser-evidence sub-agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No pick clock despite a stated 60–90s operating window; `RecommendationPanel` nulls the prior result before fetching, so Zone 2 goes blank during the wait. No `aria-live` anywhere. |
| 2 | Match System / Real World | 4 | Genuinely excellent — fantasy-native language throughout ("On the block," "Sell high/Buy low," "R3 · P28"). Best axis in the product. |
| 3 | User Control and Freedom | 3 | Real undo/confirm/archive flow, but `Z` (undo) has zero guards vs. `U`'s three, and the Philosophy Quiz force-opens a modal the moment you enter the draft board. |
| 4 | Consistency and Standards | 2 | Three coexisting button treatments, `Badge` bypassed by ≥8 hand-rolled pills, a signal color used as a button fill, four radii in play against the documented three. |
| 5 | Error Prevention | 3 | Strong: turn-enforcement, reassign guard, roster-full guard, manual entry auto-disabled when Yahoo-linked. Gap: undo has no confirmation and auction bids aren't checked against budget. |
| 6 | Recognition Rather Than Recall | 2 | The entire keyboard model is undiscoverable except via an unlabeled 16px icon; tooltips carry real meaning but don't exist on touch; tab state isn't in the URL. |
| 7 | Flexibility and Efficiency | 3 | The draft board's keyboard layer is real and well-built, but it's the only surface that has one — homepage and Season Hub have zero keyboard affordances, and Cmd/Ctrl+Z is explicitly excluded. |
| 8 | Aesthetic and Minimalist Design | 2 | Palette/surface system is handsome, but the type scale collapses to ~2 levels across both workspaces; 124 `text-ink-muted` calls plus 44 hardcoded sub-12px sizes dim a large share of the UI into one flat field. |
| 9 | Error Recovery | 2 | Every error path is a raw `err.message` in red mono, and one path currently leaks a raw Yahoo debug payload into a user-facing Advisor card. |
| 10 | Help and Documentation | 2 | The Shortcuts modal is real and well-scoped; nothing else in the app explains itself, and several stats (ADP, cat wins %) are unexplained or touch-invisible tooltip-only. |
| **Total** | | **25/40** | **Acceptable** — significant improvements needed, on a genuinely solid foundation |

## Design Specificity Verdict

**Authored for this product, but the authorship is concentrated in one component and two screens the user rarely lives in.**

**LLM assessment (Assessment A):** The One Voice Rule is enforced *in both directions* — every Claude-authored surface renders as an Advisor card, and the one deterministic panel (`PitchingStartsPanel`) deliberately stays off it, with a comment explaining why. `ArchetypeGlyph.jsx` is nine real hand-authored monoline SVGs, and the base palette is verifiably shifted off framework defaults (`surface-base`'s green channel sits above red, by design). That's real craft, not a coat of paint.

But the "editorial" half of "dark editorial analytics" barely exists where the user actually works: Fraunces (`font-display`) appears in exactly three places app-wide (`AdvisorCard`'s title, the homepage hero, and the Draft DNA card) and in **zero** files under `src/components/draft/` or `src/components/season/` — the two surfaces the product is actually used on. The homepage's own chrome opts out of the system too: its wordmark is the largest type in the app, rendered *outside* the type scale, and its buttons are hand-rolled at a fourth radius (4px) the design system doesn't document. Brass — reserved by DESIGN.md's own Scarcity Rule for ≤3 appearances per screen — both under-delivers (one reusable use site) and over-repeats (the draft board's left column can stack four identically-labeled "BEANE'S TAKE" eyebrows at once).

**Deterministic scan (Assessment B):** 45 findings across 2 detector rules — 43 are hardcoded sub-13px arbitrary font sizes (`text-[10px]`, `text-[9px]`, etc.), concentrated in the Season Hub (28 of 43 hits), which mechanically corroborates Assessment A's type-scale finding independent of any subjective read. `pages/draft.jsx` and all of `src/components/draft/*` and `src/components/ui/*` (except `Badge.jsx`) came back **completely clean** — the detector's evidence lines up with the LLM's read that the draft board is the most disciplined surface in the app. The other 2 findings (a `side-tab` rule hit in `shared.jsx`) are a confirmed **false positive** — a CSS-triangle marker for the trade-favor scale, not a colored card accent; the rule can't distinguish the two.

**Visual overlays:** Browser-based visual verification did not run this pass. The dev server on port 3000 is up (bound, `curl`/CDP both confirm a process listening) but wedged — every navigation attempt returned `net::ERR_EMPTY_RESPONSE` from a pre-existing `node.exe` process that has been running since yesterday. This is not something either sub-agent's session started, so it was left alone rather than killed. Practically: everything above is source-derived (traced against real DESIGN.md token values and computed contrast ratios), not screenshot-verified. **Restarting the dev server is worth doing before the next critique or live-mode session** — no overlay evidence is possible against a wedged process.

## Overall Impression

The foundation is real and the palette/component discipline holds up mechanically (the detector found zero findings in the entire `draft/` and `ui/` directories). But the system's two signature moves — the Fraunces/editorial voice and the brass identity accent — live almost entirely on the homepage and the post-draft DNA card, and are nearly absent from the draft board and Season Hub where the user actually spends their time under real time pressure. The single biggest opportunity: the product's defining interaction (the pick recommendation, under a real clock) is currently its least-designed moment — no clock, and the answer blanks itself while the user waits for a new one.

## What's Working

1. **The One Voice Rule holds up under inspection, including the negative case.** `PitchingStartsPanel` deliberately stays off the Advisor card because it's deterministic, not Claude-driven — with a comment explaining why. That's what makes the green-rule-plus-brass-eyebrow pattern mean something everywhere else it appears.
2. **The draft board's keyboard model is real, considered, and clean by every measure available.** In-character turn-blocking copy, a two-step confirm for destructive picks, and a manual-entry layer that fully steps aside once Yahoo sync is live. It's also the one surface with zero detector findings and zero hand-rolled pills.
3. **Failure-mode engineering that a technical reviewer would actually notice**: season-over 403s merge onto cached rosters instead of overwriting them (so the recap survives), matchup data is cached per fantasy week instead of re-fetched, and `BeaneNote` reuses that same cache rather than firing its own LLM call — with a comment explaining the cost reasoning.

## Priority Issues

**[P0] Primary action buttons fail WCAG AA contrast — including the homepage's main entry point.**
Why it matters: PRODUCT.md states "WCAG AA contrast is the confirmed working standard… tightest pairing ~4.8:1." That's not accurate as shipped — computed from the real token values, the "Season Hub" button (`bg-signal-info text-ink-primary`) is 2.51:1, the active position filter (`bg-beane-green text-ink-primary`) is 2.36:1, "Confirm Delete" is 3.20:1, and "Return to board" is 4.17:1. Two of these also directly contradict DESIGN.md's own written rules (dark text on green, not white; `beane-green-text` for text use, not the fill token). All 124 uses of `ink-muted` sit at 12px or below — DESIGN.md's "AA-large-only" exemption for that token doesn't actually cover any real usage.
Fix: swap each flagged button to the documented token pairing (`text-[#06120C]` on `beane-green`/`signal-down`/`signal-info` fills; `beane-green-text` for green-as-text), and either retint `ink-muted` to clear 4.5:1 or stop claiming AA compliance in PRODUCT.md.
Suggested command: `/impeccable audit` (contrast is exactly its domain), then `/impeccable harden` for the PRODUCT.md claim mismatch.

**[P0] The draft board has no visible clock, and the recommendation blanks itself during the exact moment it matters.**
Why it matters: PRODUCT.md's own operating context is a 60–90s pick clock, and the UI has no on-screen timer anywhere. Worse, `RecommendationPanel.jsx`'s `runAnalysis()` nulls the previous result before fetching the new one, so the answer column goes empty for the ~4s Claude call at the single highest-stakes moment in the product. There's no skeleton, no elapsed/remaining indicator, and no retained prior answer — a person under real time pressure is looking at blank space with no sense of how long the blank will last.
Fix: keep the prior recommendation visible (reduced opacity / "superseded" treatment) until the new one lands, add a determinate 4-second progress cue, and add an actual pick-clock display using the existing `data-lg` mono token.
Suggested command: `/impeccable polish` (this is a finishing-pass fix on an existing flow) or `/impeccable animate` for the loading-state transition specifically.

**[P1] Near-zero accessibility semantics: 9 ARIA attributes app-wide, 3 modals with no dialog semantics.**
Why it matters: a full sweep found one `aria-selected`, one `aria-label`, and seven decorative `aria-hidden` — nothing else. `UndoModal`, the Shortcuts modal, and `PhilosophyQuiz` are all `fixed inset-0` overlays with no `role="dialog"`, no focus trap, and no focus restore; `RosterView`'s own `UndoModal` instance has no Escape handler at all. `PlayerPool` rows are unreachable by Tab (`<tr onClick>`, no `tabIndex`/`role`), and the row-selection indicator is a ~1.6:1 surface-color step with no other cue. PRODUCT.md claims a "completed responsive/a11y pass" — the semantic layer of that pass hasn't happened yet, which is a credibility gap for an incubator reviewer, not just a compliance one.
Fix: one shared `Modal` primitive (dialog role, aria-modal, focus trap/restore, its own Escape handler) used by all three overlays; `aria-live="polite"` on turn/loading/result regions; real listbox semantics (`role="option"`, `aria-selected`, `tabIndex`) on player rows with a non-color-only selected indicator.
Suggested command: `/impeccable audit` for the full a11y sweep, then `/impeccable harden`.

**[P1] Type scale collapses to ~2 levels across both workspaces, and Fraunces is absent from where the user lives.**
Why it matters: confirmed independently by both assessments — the detector mechanically found 43 hardcoded sub-13px arbitrary font sizes (28 of them in the Season Hub alone), and the design review separately found that Season Hub panels use essentially just `text-sm font-semibold` for titles and `text-xs` for body, with `font-display` (Fraunces) appearing in zero files under `draft/` or `season/`. The `LeagueTab` panel alone stacks a tier badge, 9 category chips, a full standings list, and an LLM take with no internal hierarchy — a textbook Visual Noise Floor on the one tab meant to answer "where do I stand."
Fix: promote season-tab panel titles to the `heading` token and body text to `body` (15px) — the density argument doesn't hold in a `max-w-3xl` single column; route `AdvisorCard`'s existing `title` prop (which already renders `font-display`) into panels that currently hand-roll a plain paragraph instead.
Suggested command: `/impeccable typeset`, then `/impeccable layout` for `LeagueTab`'s internal hierarchy specifically.

**[P1] Every error is a raw exception string, and one path is currently leaking debug output into a user-facing Advisor card.**
Why it matters: the identical pattern (`<p className="text-xs text-signal-down font-mono">{err.message}</p>`) repeats across ~10 files. One instance is worse than cosmetic: `shared.jsx`'s matchup-advice error handling is explicitly marked `// TEMPORARY` and concatenates the raw Yahoo debug payload into the thrown message, rendered inside the same Advisor card that's supposed to signal "Beane is talking." That's the product's confident-GM persona breaking in exactly the surface designed to project it, and it's a leftover from a debug commit still live in the tree.
Fix: remove the `debugRaw` concatenation (log it to console instead); build one `AdvisorError` component with plain-language copy + a retry action, since every advisor already has a working refresh handler to wire it to.
Suggested command: `/impeccable clarify` for the copy, `/impeccable harden` for the underlying error-handling pattern.

## Persona Red Flags

**Alex (Power User):** The primary "Draft Board"/"Season Hub" action button is visually identical in size and weight to "Edit," "Archive," and "Delete" in the same row — the one thing Alex opens the app to do isn't distinguishable from a destructive action next to it. `Cmd/Ctrl+Z` is explicitly excluded from the undo binding. The keyboard shortcuts list is reachable only by mousing to an unlabeled 16px icon — a keyboard-first feature gated behind a mouse-only target. The "5 of 5 refreshes left" counter is backed by `useState(0)`, so it silently resets on reload — Alex will catch this in one session and stop trusting any number the app shows him.

**Sam (Accessibility-Dependent):** All three routes serve an empty `<div id="__next">` until client hydration, with no SSR heading or announcement. The active position filter and the "Season Hub" button both fail 4.5:1 contrast outright (2.36:1 and 2.51:1). The draft board's "it's your turn" state is color-and-motion only, in no live region, during a time-limited action with no extension. `PlayerPool` rows aren't Tab-reachable at all, and three modals (including the one guarding an irreversible undo) have no dialog semantics or focus trap.

**Casey (Mobile User):** The draft board is a `min-w-[880px]` grid inside an `overflow-hidden h-screen` shell — on a 390px viewport this is a 2.25× horizontally-scrolling desktop layout where the recommendation and player pool can never be visible together, which sits in tension with PRODUCT.md's claim that mobile is "a real, supported usage mode." Only 14 responsive utility classes exist across the whole `season/` tab directory, and the archived-league state has zero mobile padding. Every primary action sits in the top third of the screen — nothing actionable exists in the thumb zone — and most buttons measure 26–28px against a 44px target guideline. State like the active Season Hub tab and every advisor's fetched answer live in plain `useState`, so a phone-call interruption silently discards both the UI state and the LLM spend that produced it.

## Minor Observations

- `src/components/draft/DraftComplete.jsx` (13.5 KB) is dead code — nothing imports it; `pages/draft.jsx` uses `DraftRecap` instead. Two near-identical post-draft recap implementations will drift over time.
- Emoji used as functional UI chrome on the season recap trophy (`🥇🥈🥉` at `text-4xl`) directly contradicts DESIGN.md's explicit "emoji only in Beane's conversational text, never as UI elements" rule — and it's currently the largest visual element on that screen.
- Four border radii are in active use (4px/6px/8px/12px) against DESIGN.md's documented three-tier system.
- `signal-info` carries two jobs (a semantic "sparingly used" informational highlight, and a button fill) — a direct Meaning-Only Rule conflict the detector didn't catch because it isn't a contrast rule.
- Season Hub tabs don't sync to the URL (`?tab=` is read once but never pushed), so there's no bookmarking, no back-button between tabs, and no way to share a specific tab.
- `font-mono` numerals frequently ship without `tabular-nums` (turn ticker, refresh counter, recap stat table), against DESIGN.md's own Tabular Rule.
- The Season Hub is the one surface still shaped like a single `max-w-3xl mx-auto` column — the exact pattern DESIGN.md's No-Uniform-Stack Rule names as the generic-SaaS tell.
- Detector false positive worth remembering for future runs: the `side-tab` rule flags `shared.jsx`'s `TradeFavorBar` CSS-triangle marker as a "colored side accent" — it's a directional pointer, not a card accent, and the rule can't currently tell the difference.

## Questions to Consider

1. If Fraunces never appears on the draft board or in the Season Hub, is "dark editorial analytics" the real direction — or is it actually closer to "Bloomberg terminal," with the editorial voice deliberately reserved for the two moments (Beane's Note, the Draft DNA reveal) that earn it? Committing to the second explicitly would let two fonts get dropped from two workspaces on purpose, and make the moments where Fraunces does appear land harder.
2. The product exists because there's a clock. What would the recommendation panel look like if it sized its own answer to time remaining — a one-line "8s left: take Jokić" under real time pressure vs. a fuller case with 45s to spare?
3. Beane currently speaks in four identically-labeled brass boxes. What if the eyebrow named the *kind* of take ("THE CALL" / "WHAT I'M WATCHING" / "THE MARKET" / "THE VERDICT") so brass carries information instead of just branding?
4. The homepage currently answers "which of my leagues?" before "what do I need to do right now?" For one real user across two or three leagues, would a single cross-league action list ("Waivers process in 6h," "Draft in 3 days — philosophy not set") serve better than a league grid?
5. `BeaneNote` already proves that an answer can simply be waiting when the user arrives, because its fetch is cached per fantasy week. Which of the five Season Hub tabs could survive being converted from "press a button, then wait" to "already there"?
