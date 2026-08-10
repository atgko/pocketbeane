# PocketBeane — Philosophy Onboarding UX
# Claude Code Prompt | Owner: Athavan Elangko | GitHub: atgko/pocketbeane

---

## CONTEXT FOR CLAUDE CODE

We are implementing the GM Philosophy Onboarding flow for PocketBeane.
Before writing any code, read this document in full, review the existing
codebase structure, and confirm your understanding. Ask clarifying
questions before proceeding.

This ticket touches user experience, state management, and the AI
recommendation engine. Changes must be made carefully and in the
order specified below.

---

## BACKGROUND — WHY WE ARE BUILDING THIS

PocketBeane's core value proposition is a Moneyball-philosophy driven
recommendation engine that gives one opinionated pick with rationale.
Right now, every user gets the same recommendation logic regardless of
how they actually play fantasy basketball.

The GM Philosophy Profile makes PocketBeane feel personal. Research
shows users who complete a philosophy-style onboarding quiz convert at
2x the rate of users who skip it. However, poorly timed or repetitive
quiz flows cause 40-60% drop-off at signup.

The solution is a progressive, skippable, user-level profile — not a
league-level gate.

---

## CORE DESIGN DECISIONS — DO NOT DEVIATE FROM THESE

### Decision 1 — Profile is user-level, not league-level
The GM Philosophy Profile belongs to the user, not to individual leagues.
It is set once and applied to all leagues by default. League-specific
overrides are optional and lightweight (one toggle, not a full requiz).

Do NOT tie the philosophy quiz to the league setup flow. League setup
is functional (name, teams, draft position, scoring format). The
philosophy profile is a separate, optional layer.

### Decision 2 — The quiz is never a gate
The user can always skip the philosophy quiz. Skipping must be a single
click. Users who skip get generic recommendations with a subtle,
non-intrusive nudge to complete their profile later.

Never block access to any feature because the profile is incomplete.

### Decision 3 — The quiz appears at the right moment, not at signup
The philosophy questions are most contextually relevant when the user
is about to receive their first draft recommendation — not during
account or league setup. Trigger the quiz the first time the user
enters the draft board, before the first AI recommendation fires.

### Decision 4 — Multi-league users never repeat the quiz
When a user sets up a second or third league, they are shown:
"Using your existing GM Profile for this league."
With an optional: "Customize for this league →" link.
No requiz. No repeated questions. One tap to acknowledge, one tap to
customize if needed.

### Decision 5 — Progress is always visible
If the quiz is shown, display "Question X of 3" throughout. Users
abandon flows when they cannot see how long they will take. A visible
progress indicator eliminates this anxiety.

---

## THE THREE PHILOSOPHY QUESTIONS

These are the exact questions and options to implement. Do not rephrase
or add questions without approval.

### Question 1 — Injury Risk Tolerance
"How do you handle injury risk?"

Options:
- Play it safe — I avoid injury-prone players regardless of upside
- Calculated risk — I'll take injury risk for elite upside, flag it for me
- Round dependent — Safe early, riskier in mid-to-late rounds

### Question 2 — Category Strategy
"What's your category strategy?"

Options:
- Compete in all 9 — I want to be balanced across every category
- Punt 1-2 categories — I'd rather dominate 7 than spread thin across 9
- Read the draft — I'll decide based on what's available

### Question 3 — Roster Philosophy
"What's your roster philosophy?"

Options:
- Stars and scrubs — Elite players first, fill depth late
- Balanced depth — Consistent contributors across all roster spots
- Streaming-friendly — Flexible roster I can move around week to week

---

## DATA SCHEMA

### draftProfile object (store in localStorage as 'pocketbeane_gm_profile')

```json
{
  "injuryTolerance": "calculated_risk",
  "categoryStrategy": "punt_categories",
  "rosterPhilosophy": "stars_and_scrubs",
  "completedAt": "2026-09-01T10:00:00Z",
  "skippedAt": null,
  "version": 1
}
```

Valid values:
- injuryTolerance: "play_it_safe" | "calculated_risk" | "round_dependent"
- categoryStrategy: "compete_all_9" | "punt_categories" | "read_the_draft"
- rosterPhilosophy: "stars_and_scrubs" | "balanced_depth" | "streaming_friendly"

### leagueProfileOverride object (stored inside each league's localStorage state)

```json
{
  "hasOverride": false,
  "injuryTolerance": null,
  "categoryStrategy": null,
  "rosterPhilosophy": null
}
```

When hasOverride is false, the league uses the global draftProfile.
When hasOverride is true, only the non-null fields override the global
profile. Null fields still inherit from global.

---

## UX FLOW — IMPLEMENT EXACTLY IN THIS ORDER

### Flow A — New user, first league, entering draft board for first time

1. User completes league setup (existing flow — do not change)
2. User clicks into the draft board for the first time
3. Before the draft board renders, check localStorage for
   'pocketbeane_gm_profile'
4. If no profile exists and quiz has not been skipped:
   — Show PhilosophyQuiz component as an overlay (not a separate page)
   — Draft board is visible but dimmed behind the overlay
   — This is intentional: user can see what they are about to use
5. Quiz shows Question 1 of 3 with progress indicator
6. User answers all 3 questions → profile saved → overlay dismisses →
   draft board becomes active
7. OR user clicks "Skip for now" → skippedAt timestamp saved →
   overlay dismisses → draft board active with generic recommendations
   → subtle banner shown: "Complete your GM Profile for personalized
   picks → [Set up profile]"

### Flow B — Returning user, profile already set

1. User enters draft board
2. No quiz overlay — proceed directly to draft board
3. Profile is silently injected into all AI recommendation prompts

### Flow C — User sets up a second league

1. League setup form completes (existing flow)
2. On the final confirmation screen of league setup, show:
   "GM Profile: Using your existing profile for this league.
   [Customize for this league →]"
3. If user taps Customize: show a lightweight override screen —
   same 3 questions but framed as "Override for [League Name] only"
   with current answers pre-selected. User only changes what they want.
4. If user ignores or confirms: league inherits global profile.
   No quiz shown.

### Flow D — User wants to edit their profile later

1. Profile is accessible from a "GM Profile" item in the settings menu
   or navigation
2. User can update any answer at any time
3. Changes apply immediately to all leagues without overrides
4. Show confirmation: "GM Profile updated. Recommendations will
   reflect your new preferences."

---

## AI PROMPT INTEGRATION

This is the most important part of this ticket. The philosophy profile
must be injected into every Claude API call in recommend.js.

### System prompt addition

Add the following block to the existing system prompt in recommend.js,
populated dynamically from the resolved profile (global + any league
override):

```
GM PHILOSOPHY PROFILE FOR THIS USER:
- Injury tolerance: [value from profile, human-readable]
- Category strategy: [value from profile, human-readable]
- Roster philosophy: [value from profile, human-readable]

Weight all recommendations according to this philosophy. If the user
punts categories, do not flag weakness in their punted category as a
problem — flag it as intentional. If the user accepts injury risk for
upside, surface the injury flag but do not use it as a reason to
recommend against a player. If the user plays stars-and-scrubs, weight
round 1-4 picks toward the absolute best player available rather than
positional balance.

If the profile is incomplete or skipped, apply balanced default
recommendations and note that the user can set their GM Profile for
personalized picks.
```

### Profile resolution helper function

Create a helper function resolveProfile(leagueKey) that:
1. Reads global draftProfile from localStorage
2. Reads leagueProfileOverride for the given leagueKey
3. Merges them: override values take precedence over global values
   for non-null override fields
4. Returns a single resolved profile object
5. Returns default balanced profile if no global profile exists

This function should be called once at the start of each recommendation
request and its output passed into the prompt builder.

---

## COMPONENT ARCHITECTURE

### New components to create:

**src/components/PhilosophyQuiz.jsx**
- The 3-question overlay component
- Props: onComplete(profile), onSkip()
- Shows progress indicator "Question X of 3"
- Draft board visible but dimmed behind it (z-index overlay)
- Skippable at any point with one click
- Clean, card-based UI — feels like a personality quiz not a form
- Animate between questions (simple fade or slide)
- On completion, brief success state before dismissing:
  "GM Profile set. PocketBeane will now tailor picks to your style."

**src/components/ProfileNudge.jsx**
- Subtle banner shown to users who skipped the quiz
- Single line: "Complete your GM Profile for personalized picks"
- One CTA button: "Set up profile"
- Dismissible — show maximum once per session, not on every page
- Does not appear if profile is complete

**src/components/ProfileOverrideScreen.jsx**
- Lightweight version of PhilosophyQuiz for league-specific overrides
- Shows current global answers pre-selected
- Header: "Customize GM Profile for [League Name]"
- User only changes what they want — unchanged questions inherit global
- Save / Cancel options

**src/pages/GMProfile.jsx** (or modal, depending on nav structure)
- Settings page for viewing and editing the global GM Profile
- Shows current answers with edit option
- Shows which leagues have overrides and what they are
- Link to reset to defaults

### Modified files:

**src/recommend.js**
- Add resolveProfile(leagueKey) helper function
- Inject resolved profile into system prompt on every API call
- Handle null/incomplete profile gracefully with default language

**src/leagueStore.js**
- Add leagueProfileOverride to each league's state object
- Initialize as { hasOverride: false, injuryTolerance: null,
  categoryStrategy: null, rosterPhilosophy: null }

**src/App.jsx**
- Add profile check logic when user navigates to draft board
- Trigger PhilosophyQuiz overlay if no profile and not previously skipped
- Add GM Profile to navigation/settings

**src/components/LeagueSetupForm.jsx** (or equivalent)
- Add profile acknowledgment on final confirmation screen for
  second/third league setup (Flow C)
- Do NOT add quiz questions to this form

---

## WHAT NOT TO BUILD

- Do not add the philosophy quiz to the league setup form
- Do not make the quiz mandatory or block any feature behind it
- Do not ask more than 3 questions
- Do not repeat the full quiz for additional leagues
- Do not store the profile server-side (localStorage only for MVP)
- Do not build a social or shareable profile feature (out of scope)
- Do not add a fourth question without approval

---

## ACCEPTANCE CRITERIA

Work through these in order. Do not mark the ticket complete until
all criteria are met.

**Profile storage:**
- [ ] draftProfile saved to localStorage key 'pocketbeane_gm_profile'
- [ ] Profile persists across sessions and browser refreshes
- [ ] skippedAt timestamp saved when user skips
- [ ] completedAt timestamp saved when user completes

**Quiz UX:**
- [ ] Quiz overlay appears on first draft board entry only
- [ ] Draft board is visible but dimmed behind the overlay
- [ ] Progress indicator shows "Question X of 3" throughout
- [ ] Skip option visible and functional at all times
- [ ] Answers are tappable cards, not dropdowns or radio buttons
- [ ] Transition between questions is animated (fade or slide)
- [ ] Success state shown briefly on completion before overlay dismisses
- [ ] Quiz never appears again after completion or skip

**Multi-league:**
- [ ] Second league setup shows profile acknowledgment, not quiz
- [ ] Customize override option available on league setup confirmation
- [ ] Override screen pre-populates with current global answers
- [ ] Leagues without overrides inherit global profile correctly
- [ ] resolveProfile(leagueKey) returns correct merged profile

**AI integration:**
- [ ] Resolved profile injected into every Claude API system prompt
- [ ] Recommendations visibly reflect injury tolerance setting
- [ ] Recommendations visibly reflect category strategy setting
- [ ] Recommendations visibly reflect roster philosophy setting
- [ ] Skipped/incomplete profile produces generic recommendations
  with note about setting GM Profile

**Profile editing:**
- [ ] GM Profile accessible from settings/nav at any time
- [ ] Edits apply immediately to all recommendations
- [ ] League overrides visible and editable from profile page

**Nudge:**
- [ ] ProfileNudge banner shown to skip users on draft board
- [ ] Nudge shown maximum once per session
- [ ] Nudge not shown if profile is complete
- [ ] Nudge CTA opens PhilosophyQuiz correctly

---

## BUILD ORDER

Implement in this exact sequence. Do not jump ahead.

1. Create draftProfile schema and localStorage read/write helpers
2. Create resolveProfile(leagueKey) helper function
3. Inject resolved profile into recommend.js system prompt
   (test with hardcoded profile values first)
4. Build PhilosophyQuiz component (UI only, no storage yet)
5. Connect PhilosophyQuiz to localStorage on complete and skip
6. Add quiz trigger logic to App.jsx for first draft board entry
7. Build ProfileNudge component
8. Build ProfileOverrideScreen component
9. Add profile acknowledgment to league setup confirmation (Flow C)
10. Build GMProfile settings page
11. Add GM Profile to navigation
12. End-to-end test: new user flow, skip flow, returning user flow,
    multi-league flow, profile edit flow

---

## PLAN MODE REMINDER

Before writing any code:
1. Read this document in full
2. Read the existing codebase — especially recommend.js, leagueStore.js,
   and App.jsx
3. Confirm your understanding of the existing prompt structure in
   recommend.js before proposing changes to it
4. Propose the component file structure
5. Confirm the build order above or flag any dependencies that require
   a different sequence
6. Ask any clarifying questions

Do not write any code until the plan is confirmed.
