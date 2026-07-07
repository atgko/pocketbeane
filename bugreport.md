# Bug Report — MLB Current-Season Data Pipeline

Filed: 2026-07-06
Session: schema validation fixes for the merge script, blocked by scraped MLB
player data. Started as a 2-item fix, expanded once the real data was run
through the pipeline and the actual failures didn't match the assumed ones.

Final pipeline result after all fixes below: **293 updated / 0 skipped / 0
invalid** (against `data-updates/mlb-current-season-2026-07-06.json` →
`src/data/mlb_players.json`).

---

## 1. `VALID_INJURY_STATUSES` didn't accept `null` — FIXED

**File:** `scripts/mergeCurrentSeasonData.js`
**Status:** Fixed this session.

`null` (injury page unavailable during scraping) was rejected by
`validatePlayerEntry`. Added `null` to `VALID_INJURY_STATUSES`. Left
`'healthy'` / `'day-to-day'` / `'out'` untouched.

**Note:** the task description assumed `'il'` was already a 4th valid value.
It was never in the array — only 3 values existed before this fix. Not
added, since that wasn't part of the requested change; flagging in case
`'il'` is actually needed for real IL-tagged players.

---

## 2. `scrape_mlb.py` "runs" field — NOT AN ISSUE

**File:** `scripts/scrape_mlb.py`
**Status:** No change made — nothing to fix.

Task description asked to rename an output field from `"runs"` to `"r"`.
The scraper already outputs `"r"` — confirmed via grep, no `"runs"` key
exists anywhere in the file. The real bug was adjacent (see #3).

---

## 3. `b_runs` vs `b_r` — wrong Baseball Reference data-stat key — FIXED [HERMES]

**File:** `scripts/scrape_mlb.py` (line ~106, `build_hitter()`)
**Status:** Fixed this session.
**Owner:** Hermes-side. This is the scraping logic (`source:
"hermes_weekly_pull"`) — if Hermes runs this same script or an equivalent
elsewhere as part of the cron job, this fix needs to travel with it.

```python
'r': parse_int(e.get('b_runs')),   # before — always None, key doesn't exist
'r': parse_int(e.get('b_r')),      # after — confirmed present in bbref-batting.html
```

`b_runs` doesn't exist as a `data-stat` attribute in the scraped HTML;
the real key is `b_r`. This produced `r: null` for all 178 hitters in the
batch, which the required-field validator (correctly) rejected — this is
what caused the "178 invalid entries" failure, not a mismatch with what
Fix 2 (above) described.

---

## 4. Pitchers with few appearances misclassified as hitters — FIXED [HERMES]

**File:** `scripts/scrape_mlb.py` (position-detection loop in `main()`)
**Status:** Fixed this session.
**Owner:** Hermes-side, same as #3.

Position detection classified a player as `pitcher` only if
`gs > 5 or sv > 0` in the current scrape window. Real pitchers returning
from injury or with few appearances so far this season (e.g. Blake Snell:
1 start, Shane Bieber: 3 starts) fell below that threshold and defaulted to
`hitter`. Carlos Estévez (a real reliever with a 1-game/0-PA batting-table
cameo and no games meeting the threshold) got a fabricated hitter record
with null rate stats (`avg`/`obp`/`slg`/`ops` all `null` — undefined at 0 AB).

Fix: anchor classification on the authoritative `player_type` field already
in `mlb_players.json`, falling back to the threshold-based detection only
when `player_type` isn't already known to be `pitcher`:

```python
elif norm in pitcher_norms or pdata.get('player_type') == 'pitcher':
    position_type = 'pitcher'
```

Recovered 10 real pitchers that were previously silently skipped or
misclassified (Snell, Bieber, Pivetta, Greene, Horton, Smith, Estévez, +3
others) — verified each against real pitching lines before trusting the fix.

---

## 5. `injury_status` read from the wrong path — FIXED [POCKETBEANE]

**File:** `scripts/mergeCurrentSeasonData.js`
**Status:** Fixed this session.
**Owner:** PocketBeane-side (merge/receiving logic). Not Hermes — Hermes
only produces the data, it doesn't run this script.

The merge step read `entry.injury_status` (top-level), but the real value
lives at `entry.current_season.injury_status`. Since the top-level path is
always `undefined`, every player's injury status silently fell back to
`'healthy'` — even though the scraper explicitly sent `null` (injury page
404'd this run) and fix #1 above had already made that `null` pass
validation. The validator was checking the right path all along; only the
write step wasn't.

Fix also had to preserve the distinction between "explicitly `null`" and
"key genuinely absent" — a naive `??` fix would still coalesce an explicit
`null` away to the fallback, since `??` treats `null` and `undefined`
identically. Used a `!== undefined` presence check instead, mirroring the
pattern the file already used for `injury_note`.

---

## 6. `calculateTrend` was NBA-only, silently wrong for MLB — FIXED [POCKETBEANE]

**File:** `scripts/calculateTrend.js`, called from `scripts/mergeCurrentSeasonData.js`
**Status:** Fixed this session.
**Owner:** PocketBeane-side.

`TREND_SIGNAL_STATS` was hardcoded to `['pts', 'reb', 'ast']` — NBA fields
that don't exist anywhere in MLB's `prior_season`/`current_season` schema.
Every MLB player's trend silently computed as `"stable"` regardless of
actual performance, and the function could never return the `trend: null`
the task expected in the first place (it only ever returns
`improving`/`stable`/`declining`).

Fix, in three parts:

1. Added `TREND_PROFILES` (`nba`, `mlb_hitter`, `mlb_pitcher`) per
   `docs/SCHEMA.md`'s already-documented intent (hitters: `hr`/`rbi`/`avg`;
   pitchers: `k`/`era`/`whip`). `calculateTrend()`'s 2-arg NBA call
   signature is unchanged and all existing NBA tests pass unmodified.
2. **Per-game normalization.** `hr`/`rbi`/`k` are season-to-date *totals*
   in this schema, not rates. Comparing a partial current season's total
   against a full prior season's total read as `"declining"` for nearly
   every player regardless of real form (12 HR through 84 games vs. 23 HR
   through a full 157-game season). `mergeCurrentSeasonData.js`'s
   `buildTrendInputs()` now converts those to per-game rates before
   comparison (`avg`/`era`/`whip` are already rates and pass through
   unchanged). Also aliases current_season's `so` (strikeouts) to prior's
   `k` for the same stat — the two schemas use different key names.
3. **Sign-flip regression.** The first cut summed `era`/`whip` sign-flipped
   (lower-is-better) alongside a "higher is better" `k` in one combined
   total. For a small sample with a tiny K-rate and a blown-up ERA/WHIP
   (e.g. Carlos Estévez: ERA 2.45→162, WHIP 1.061→18, 0 K in a token
   outing), the sign-flipped ERA/WHIP term dominated the sum and pushed the
   *prior* total negative — which inverted the deviation's sign and
   reported `"improving"` for a disastrous outing. Fixed by computing each
   stat's percentage deviation independently (sign-flipping only that
   stat, not a combined total) and averaging — this can't cross zero the
   way a raw summed total can. The original sum-then-one-deviation method
   is kept, unchanged, for profiles with no `lowerIsBetter` stats (NBA,
   MLB hitters), since summing same-signed values can't hit this bug.

Regression tests added in `scripts/test/calculateTrend.test.js` for both
the per-game normalization and the sign-flip case.

**Follow-up (same session, separate request):** extended from 3 buckets to
5 — `TREND_MINOR_THRESHOLD = 0.05` added alongside the existing
`TREND_THRESHOLD = 0.15`, so real-but-modest movement (5–15% deviation)
reads as `"slightly-improving"`/`"slightly-declining"` instead of being
folded into `"stable"` alongside players with zero real change. See
`BACKLOG.md` T1-3 follow-up entry for full detail (UI, prompt, and test
changes). Not a bug fix — a product enhancement layered on top of the
trend fixes above, filed here only because it touches the same function.

---

## 7. `mergeCurrentSeasonData.test.js` fixtures were stale — FIXED [POCKETBEANE]

**File:** `scripts/test/mergeCurrentSeasonData.test.js`
**Status:** Fixed this session. Was 11/18 passing at baseline (confirmed
before touching anything, unrelated to any fix above); now 19/19 passing
(added one regression test, see #8).
**Owner:** PocketBeane-side.

The test fixtures (`validIncomingEntry()`) built incoming player entries
with stat fields flat on the entry object (`{ id, pts, reb, ... }`). The
real validator/merge logic (and the real scraper output, and the file's
own docstring usage example) expect stats nested under
`entry.current_season.{field}`. The fixtures predated whatever change moved
stats under `current_season` and were never updated, so the suite had been
asserting against a shape nothing in production actually sends. Updated
`validIncomingEntry()` to nest stats correctly, and fixed each test that
deleted/overrode a flat field to target the nested path instead.

---

## 8. `getRequiredFields()` broken for the `nba` sport — FIXED [POCKETBEANE]

**File:** `scripts/mergeCurrentSeasonData.js`
**Status:** Fixed this session. Found while fixing #7 — fixing the test
fixtures surfaced a live bug that had nothing to do with the fixtures
themselves.
**Owner:** PocketBeane-side. **This is a currently-live break in the NBA
merge path** — the sport PocketBeane originally shipped with, unrelated to
anything MLB/Hermes this session.

`SPORT_SCHEMAS.nba` is a flat array, but the branch meant to catch that
case checked `typeof schema === 'string'` — which never matches an array
(`typeof [] === 'object'`). Every NBA (or default, since
`sport = incomingData.sport || 'nba'`) call fell through to the
object-schema branch built for `mlb`/`nhl`/`nfl`'s `{ hitter: [...],
pitcher: [...] }` shape, where `Object.keys(arrayValue)` returns numeric
string indices and `schema[keys[0]]` returned just `schema['0']` — the bare
string `'pts'` — instead of the full 10-field array. Iterating a string
walks its characters, so every NBA validation call effectively checked for
fields named `"p"`, `"t"`, `"s"` instead of `pts`/`reb`/`ast`/etc., and
every real NBA entry would fail validation. Fixed with an `Array.isArray()`
check. Added a regression test (`validatePlayerEntry: sport="nba"
(explicit) validates the full stat set...`) so this can't silently return.

---

## Fixed this session — file summary

| File | Bug # | Owner |
|---|---|---|
| `scripts/mergeCurrentSeasonData.js` | 1, 5, 6, 8 | PocketBeane |
| `scripts/scrape_mlb.py` | 3, 4 | Hermes |
| `scripts/calculateTrend.js` | 6 (+ 5-tier follow-up) | PocketBeane |
| `scripts/test/mergeCurrentSeasonData.test.js` | 7, 8 | PocketBeane |
| `scripts/test/calculateTrend.test.js` | 6 (+ 5-tier follow-up) | PocketBeane |
| `pages/season.jsx` | 6 (5-tier follow-up — `TREND_STYLES`) | PocketBeane |
| `pages/api/season/waiver-advice.js` | 6 (5-tier follow-up — prompt text) | PocketBeane |
| `docs/SCHEMA.md` | 6 (5-tier follow-up — docs) | PocketBeane |

All PocketBeane-side items are now fixed. Test suite: 36/36 passing
(`calculateTrend.test.js` 17/17, `mergeCurrentSeasonData.test.js` 19/19).
Real pipeline: 293 updated / 0 skipped / 0 invalid. Trend tier distribution
across real MLB data: 52 improving, 26 slightly-improving, 58 stable, 47
slightly-declining, 110 declining.

## Still open (Hermes-side, not fixed here)

None outstanding from this report — #3 and #4 (the only Hermes-owned
items) were fixed in `scripts/scrape_mlb.py` this session. If Hermes runs
its own copy of this scraper (rather than this file directly), those two
fixes need to be ported over there.
