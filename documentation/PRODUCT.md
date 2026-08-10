# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary user:** Athavan Elangko (owner/builder) — an experienced fantasy basketball player running two Yahoo NBA leagues (snake draft, 9-cat H2H) and a Yahoo MLB league, using PocketBeane himself throughout the draft and the season. Drafting strategy is ADP-value-first, positional-scarcity aware, superstar-first early, category-balance-aware mid/late, and willing to accept injury risk for elite upside as long as it's flagged.

**Secondary framing:** the product is being pushed as far as possible right now with a genuine goal of applying to a university AI incubator program — so build quality, polish, and demonstrable range matter beyond personal use.

**Future users (aspirational, not committed):** other serious multi-sport fantasy players. NFL and NHL expansion is a live near-term goal (ahead of their respective drafts) if the backlog moves quickly, not a distant Phase 3 abstraction — but broader multi-user/commercial features (accounts, billing, freemium tiers) remain explicitly deferred as premature for a project still centered on one real user.

Accessed on both desktop and mobile web — mobile is a real, supported usage mode (not just defensive polish), covered by a completed responsive/a11y pass.

## Product Purpose

PocketBeane is an AI-powered fantasy sports assistant and draft-day co-pilot with a season-long advisor layer. It synthesizes ADP value, positional scarcity, category balance, and injury risk into one direct, opinionated recommendation per pick — rather than a ranked list — then stays relevant after the draft with waiver wire advice, trade analysis, start/sit calls, and league-wide pulse checks.

Success is measured by real outcomes: end-of-season league standings, category win rates, and whether waiver/trade recommendations actually improved the user's team. The tool either helps win real leagues or it didn't work.

## Positioning

PocketBeane's mechanism a generic fantasy dashboard can't truthfully copy: it gives one confident, synthesized recommendation (not a stat table or ranked list) grounded in four combined signals — ADP gap, positional scarcity, category-need, and injury risk — weighted by a GM Philosophy Profile the user sets once. It speaks as an opinionated GM sidekick, not a neutral tool, and its sport-agnostic architecture (one config registry drives positions/categories/roster slots per sport) lets a new sport go live from a config + data file rather than new app logic.

## Operating Context

- Live Yahoo Fantasy drafts (NBA today, MLB league also active) — the recommendation panel is used pick-by-pick during a real, time-pressured draft (60–90s per pick).
- Full season use after the draft: weekly matchup advisor, waiver wire advisor, trade analyzer, trade value index, start/sit advisor, and league pulse, all pulling live Yahoo league/roster data.
- Yahoo OAuth 2.0 is the system of record for league settings, standings, rosters, and draft state; manual pick entry remains the fallback when Yahoo sync fails or during live-draft polling gaps.
- Season-end and season-over states are explicitly handled (Yahoo permanently 403s concluded leagues) so advisors stop cleanly rather than erroring or silently burning API spend on dead seasons.
- A GM Philosophy Profile (injury tolerance, category strategy, roster philosophy) is set once per user, applies across all leagues by default, and can be lightly overridden per league — it is never a gate and never re-asked.

## Capabilities and Constraints

- Sport-agnostic core: NBA and MLB are live with real, refreshed player data; NHL and NFL are config-stubbed in `src/config/sports.js` and are an active near-term goal (target: before their respective drafts), not a distant roadmap item.
- Claude (Anthropic) powers the recommendation synthesis, draft recap, and season advisors; always proxied server-side — the API key never reaches the browser.
- State is client-first: Zustand + localStorage for league config, draft history, and the GM Philosophy Profile; no user-facing backend database. `players.json`/sport data files are bundled, not duplicated into storage.
- Recommendation budget: 5 manual refreshes per draft session (a free-tier constraint carried over from the original design, not currently backed by real billing).
- Multi-user accounts, billing/monetization, and public sharing are explicitly out of scope for now — deferred until there's a real user base to justify the complexity.
- Performance constraint: draft recommendations must return within ~4 seconds (client-side steps are instant; only the final Claude synthesis call is on the critical path).
- Data staleness is a known, accepted risk: player pools (`players.json`, sport-specific equivalents) are curated/refreshed periodically, not live-scraped.

## Brand Commitments

- Name: **PocketBeane** — a Moneyball/Billy Beane reference; the product's voice is an intentional homage to that data-driven, opinionated-GM persona.
- Voice: confident, direct, opinionated GM sidekick — one recommendation with a clear rationale, not a hedge or a list of options. This voice is enforced in the Claude system prompt and should be preserved in any UI copy.
- Visual direction ("The Front Office" — dark editorial analytics, Moneyball green + brass) is recorded separately once DESIGN.md exists; not a PRODUCT.md concern.

## Evidence on Hand

- Real usage: the user's own live NBA and MLB Yahoo leagues are the actual test bed — draft recommendations, waiver/trade calls, and season recaps have been run against real rosters and real Claude calls, not just simulated data.
- No real third-party testimonials, customer logos, or press exist. The "PMF" material referenced in the backlog is an internal simulation used to prioritize backlog items, not real user evidence — future work must not present it as customer proof.
- Portfolio narrative ("I build AI tools for decisions I care about; PocketBeane wins fantasy leagues") is a confirmed, intentional positioning angle for the incubator application — safe to lean into, not to overstate into a false multi-user traction claim.

## Product Principles

1. One opinionated recommendation beats a ranked list — synthesize signals into a single direct call, always with rationale and any injury flag surfaced explicitly rather than hidden.
2. Real usage is the only validation that counts — the user's actual leagues are the test bed; success is measured by season standings and recommendation-followed outcomes, not synthetic metrics.
3. Sport-agnostic by architecture, not by aspiration — new sports are a config + data file, never new app logic; this constraint should hold as NHL/NFL come online.
4. Personalize without gating — the GM Philosophy Profile shapes every recommendation but is always skippable, never blocks a feature, and is never re-asked once set.
5. Fail soft on external dependencies — Yahoo API slowness, throttling, or permanent season-end 403s degrade to a clean fallback or manual entry, never a crash or a silent wrong answer.

## Accessibility & Inclusion

WCAG AA contrast is the confirmed working standard, with global focus-visible states in place. A 2026-07-30 audit found this claim didn't fully hold in practice — several primary action buttons and the `ink-muted` token failed 4.5:1 — and fixed the token pairings plus retinted `ink-muted` so the claim is accurate again. The same pass added real dialog semantics (role, focus trap, focus restore, Escape) to all three modal overlays, which had none before. Mobile web is a first-class, supported surface, not just desktop with mobile "not breaking."
