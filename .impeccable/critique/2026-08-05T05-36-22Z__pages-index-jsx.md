---
target: Homepage (pages/index.jsx)
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-05T05-36-22Z
slug: pages-index-jsx
---
Method: dual-agent (A: general-purpose design review · B: general-purpose detector/browser evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Sync/loading states are covered, but archive/restore/re-sync-success give no confirmation — only a silent state change |
| 2 | Match System / Real World | 3 | Terminology (9CAT, ADP, "R2 P14") fits the primary persona (experienced player) but not a first-timer |
| 3 | User Control and Freedom | 2 | The Yahoo league picker opens with no cancel, no outside-click, no Escape — it only closes once you select a league |
| 4 | Consistency and Standards | 3 | The H1 skips the design system's own `display` (Fraunces) token; Advisor Card never uses the documented Named-Take pattern; delete confirmation copy differs between `LeagueCard` and `ActiveLeagueBar` |
| 5 | Error Prevention | 3 | Delete has a real two-step confirm; archiving is deliberately non-automatic per a code comment describing a past incident |
| 6 | Recognition Rather Than Recall | 3 | Badges are text-labeled throughout, but the standing trend arrow is a colored glyph with no text or aria-label |
| 7 | Flexibility and Efficiency of Use | 1 | No keyboard shortcuts, no bulk actions — for a user PRODUCT.md says is running 3 concurrent leagues today |
| 8 | Aesthetic and Minimalist Design | 2 | Header, Yahoo CTA, toast, a 5-button action bar, the league grid, and an archived-section toggle all compete at similar visual weight |
| 9 | Error Recovery | 2 | A raw Yahoo OAuth error code gets echoed straight into the toast; caught fetch errors surface `err.message` unfiltered |
| 10 | Help and Documentation | 1 | No help link, tooltip, or contextual guidance anywhere on this screen |
| **Total** | | **23/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment:** The design *system* is genuinely product-specific — DESIGN.md's three-font discipline, the Advisor Card, the ArchetypeGlyph set, the Moneyball palette, and real domain logic in the hero-selection function are not generic. But the homepage itself under-delivers that system. The page's own `<h1>PocketBeane</h1>` renders in plain Inter (`text-3xl font-bold`), not the `font-display` (Fraunces) token DESIGN.md reserves for "page heroes." The Advisor Card on this page never receives a custom `eyebrow` prop in either of its render branches, so it always shows the literal default "BEANE'S TAKE" — never a named take like "THE MATCHUP READ," which DESIGN.md's own Named-Take Rule requires. Verified directly in source: `AdvisorCard.jsx` defaults `eyebrow = "BEANE'S TAKE"`, and neither call site in `BeaneNote.jsx` overrides it. The one screen actually observed live (the empty state — no leagues seeded in the test profile) shows zero brass, zero serif, zero Advisor Card: it reads as competent, generic dark-mode SaaS, not "MLB front office war room." The specificity exists in the codebase; it isn't reliably reaching this screen.

**Deterministic scan:** The static CLI detector returned zero findings across `pages/index.jsx`, `src/components/home/`, and `src/components/ui/`. The browser pass (live DOM, not static source) caught one real finding the static scanner couldn't: a `line-length` violation (~89 chars/line, unconstrained by any `max-w`) in the empty-state copy at `pages/index.jsx:904-907`, visually confirmed via screenshot. This is exactly the kind of computed-layout issue a static scanner structurally can't see — a good example of the two passes catching different failure classes rather than one just being noisier.

**My own catch, independent of either agent:** that same empty-state paragraph reads *"Add one for each Yahoo draft you're running. ESPN and other platforms are coming soon."* — this is now factually stale. Sleeper shipped as a real, working second platform earlier today (see `BACKLOG.md`'s SLP-01). This isn't a design nit, it's a product-accuracy bug on the very first screen a new or returning user sees.

## Overall Impression

The empty state is calm and doesn't overreach — one clear CTA, no clutter. But the moment a league exists, the page's own DOM order buries its actual differentiator: `ActiveLeagueBar` (a row of 5 transactional buttons — Season Hub/Draft, Edit, Yahoo Link/Resync, Archive/Restore, Delete) renders *before* the Hero card and Beane's Note in `pages/index.jsx` (confirmed at source lines 271 vs. 282/296). The product's whole thesis — per PRODUCT.md — is "one opinionated recommendation, not a list." The homepage's DOM order inverts that: chrome first, the take second. That single ordering choice is the root cause of 4 of 5 cognitive-load checklist failures below, and it's the biggest opportunity here.

## What's Working

1. **`pickHeroLeagueId`'s urgency ranking** (upcoming draft > active season > mid-draft-with-picks > archived) is real, well-reasoned domain logic, not a generic "most recent" sort — it surfaces what actually needs the user's attention.
2. **The Archived section** is genuine progressive disclosure: collapsed by default, grouped by season year, keeps the home screen focused without deleting history.
3. **Delete's two-step confirm plus deliberately non-automatic archiving** is error-prevention grounded in a real incident, not generic caution — a code comment explains it was a direct fix for auto-archive silently and irreversibly reclassifying an active league.

## Priority Issues

**[P1] `ActiveLeagueBar` outranks the Hero card in visual weight and DOM order.**
Why it matters: causes 4 of 5 cognitive-load failures below and buries the product's core differentiator (Beane's one opinionated take) under transactional buttons, inverting PRODUCT.md's own stated thesis.
Fix: move the action bar into or below the Hero card as subordinate footer actions — read, then act, not act, then read.
Suggested command: `/impeccable layout`

**[P1] The Yahoo league picker has no way out.**
Why it matters: `picker.open` state only clears when a league is selected — no cancel button, outside-click, or Escape handling exists in `LeagueCard`/`ActiveLeagueBar`. A user who opens it by mistake, or whose league isn't in the list, is stuck. Fails heuristic 3 outright.
Fix: add an explicit close affordance plus outside-click/Escape dismissal.
Suggested command: `/impeccable harden`

**[P2] The empty-state copy is factually stale as of today.**
Why it matters: "ESPN and other platforms are coming soon" is now wrong — Sleeper shipped as a real second platform this session. This is the first thing a new or returning empty-state user reads.
Fix: update the copy to reflect Sleeper; this is also where the ~89-char/line-length finding lives, worth fixing in the same pass with a `max-w` constraint.
Suggested command: `/impeccable clarify`

**[P2] The homepage doesn't apply its own design system.**
Why it matters: the H1 skips `font-display` (Fraunces); the Advisor Card never gets a Named-Take eyebrow. Both are explicit DESIGN.md rules, both verified violated in source. Undercuts the "authored, not generic" claim on the single most-visited screen in the app.
Fix: apply the display token to the H1; pass a real `eyebrow` (e.g. `"THE MATCHUP READ"`) per `BeaneNote` branch.
Suggested command: `/impeccable polish`

**[P2] Trend arrows carry state through color and glyph alone.**
Why it matters: no text fallback or `aria-label` — fails for color-blind and screen-reader users specifically, not a general inconvenience.
Fix: add `aria-label`/`title` plus a text equivalent.
Suggested command: `/impeccable harden`

**[P3] Zero accelerators for a persona PRODUCT.md itself describes as real.**
Why it matters: PRODUCT.md states the primary user runs 3 concurrent leagues today; there are no keyboard shortcuts and no bulk actions, so every league repeats the same 5-button sequence by mouse.
Suggested command: `/impeccable optimize`

## Persona Red Flags

**Alex (Power User):** Manages 3 real leagues per PRODUCT.md's own description. Every one requires repeating the same 5-button `ActiveLeagueBar` sequence with no bulk action and no keyboard path — the one accelerator that exists (`LeagueSwitcher`) is mouse-only.

**Sam (Accessibility-Dependent User):** The trend arrow conveys state via color+glyph with no `aria-label`. Disclosure buttons (`LeagueSwitcher`, the Yahoo picker) carry no `aria-expanded`/`aria-haspopup` in source, so a screen reader won't announce them as toggleable. The Delete→Confirm/Cancel swap has no `aria-live` region to announce the change in meaning.

**Casey (Distracted Mobile User):** On a live 390px-width capture, "Set Up a League" sits well below the fold with a large empty region beneath it — not egregious in the empty state, but if DESIGN.md's "stack in priority order" is followed literally in the populated state, the 5-button action bar would land directly under the header on mobile too, compounding the P1 hierarchy issue on the surface PRODUCT.md calls a first-class, real usage mode.

## Minor Observations

- Delete-confirmation copy differs between components: `ActiveLeagueBar` says "Confirm Delete," `LeagueCard`'s compact version just says "Confirm."
- The raw `yahoo_error` query param is echoed directly into the toast rather than mapped to a plain-language message.
- The circular "N" badge visible in the bottom-left corner of both live captures is the Next.js dev overlay, not product UI — noted so it isn't mistaken for a design element.

## Questions to Consider

- What if Hero + Beane's Note rendered first, full-width, before any action button appears — "read, then act" instead of "act, then read"?
- If Alex (the one real user today) runs 3 leagues, is the archived/grouped-by-sport-and-year machinery solving a scale problem that doesn't exist yet, or genuinely earning its keep already?
- Is the Named-Take Rule enforced anywhere in the shipped app, or only aspirational in DESIGN.md right now?
