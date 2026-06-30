export const ARCHETYPES = {
  moneyball_gm: {
    id: 'moneyball_gm',
    name: 'The Moneyball GM',
    tagline: "You don't follow the board. You exploit it.",
    description: 'Found value where others weren\'t looking. Drafted multiple players significantly below their ADP — the Moneyball philosophy in action.',
  },
  category_surgeon: {
    id: 'category_surgeon',
    name: 'The Category Surgeon',
    tagline: 'You identified your targets and you went and got them.',
    description: 'Deliberately constructed dominance in specific categories while strategically punting others. Not a weak roster — a focused one.',
  },
  architect: {
    id: 'architect',
    name: 'The Architect',
    tagline: "Every pick had a purpose. Your roster isn't a collection — it's a blueprint.",
    description: 'Built a statistically balanced roster with deliberate category construction. No obvious holes, no wasted picks. The most systematic drafter in the room.',
  },
  ceiling_chaser: {
    id: 'ceiling_chaser',
    name: 'The Ceiling Chaser',
    tagline: 'Safe is boring. You came to win, not to finish third.',
    description: 'Took calculated swings on high-upside players. Accepted injury risk for elite ceiling. High variance, high reward — this team could win the league or be a disaster. Either way it will be interesting.',
  },
  riverboat_gambler: {
    id: 'riverboat_gambler',
    name: 'The Riverboat Gambler',
    tagline: "High risk, higher reward. Your league doesn't know what's coming.",
    description: 'Maximum variance roster. Multiple injury risks, multiple boom-or-bust players. Very little floor but an enormous ceiling. The most unpredictable team in the league.',
  },
  underdog_whisperer: {
    id: 'underdog_whisperer',
    name: 'The Underdog Whisperer',
    tagline: 'Everyone else saw a question mark. You saw a steal.',
    description: 'Found the best value in the late rounds. Built significant upside in rounds 7 through 13 with sleeper picks that others overlooked.',
  },
  zero_to_hero: {
    id: 'zero_to_hero',
    name: 'The Zero-to-Hero',
    tagline: 'Rounds 1 through 3 might raise eyebrows. Rounds 8 through 13 is where you win.',
    description: 'Stars-and-scrubs taken to its logical extreme. Superstar anchor in the first picks, depth built entirely in the late rounds with high-upside fliers. Uneven on paper. Terrifying in practice.',
  },
  floor_builder: {
    id: 'floor_builder',
    name: 'The Floor Builder',
    tagline: "Your team won't beat you. Every week, every category.",
    description: 'Prioritized consistency and durability above all else. Zero chronic injury risks, high games-played average across the roster, steady category contributors throughout. Built to win close matchups.',
  },
  contrarian: {
    id: 'contrarian',
    name: 'The Contrarian',
    tagline: 'The consensus said one thing. You said hold on.',
    description: 'Consistently went against ADP consensus throughout the draft. Zigged when others zagged. The most independent thinker in the room — for better or for worse.',
  },
}

export function getFallbackPrediction(archetypeId, sport = 'nba') {
  const mlbOverrides = {
    architect:     'Consistent production across all categories will quietly put you in playoff position by June.',
    ceiling_chaser: 'One of your upside picks is going to be the most-discussed player in your league by July.',
    floor_builder:  'Durability wins leagues in August when everyone else is scrambling for replacements.',
  }
  if (sport === 'mlb' && mlbOverrides[archetypeId]) return mlbOverrides[archetypeId]
  return FALLBACK_PREDICTIONS[archetypeId]
}

export const FALLBACK_PREDICTIONS = {
  moneyball_gm: 'The value you found on this board will show up in the standings by week 6.',
  category_surgeon: 'Your category focus will be unbeatable in your target stats — opponents won\'t see it coming.',
  architect: 'Consistent production across 7 categories will quietly put you in playoff position by January.',
  ceiling_chaser: 'One of your upside picks is going to be the most-discussed player in your league by December.',
  riverboat_gambler: 'If even two of your high-variance picks hit, this team wins the league outright.',
  underdog_whisperer: 'At least one of your late-round sleepers will make opponents wish they\'d taken them first.',
  zero_to_hero: 'Your anchor gives you a floor nobody can touch — and your late-round picks will take care of the ceiling.',
  floor_builder: 'Durability wins leagues in February when everyone else is scrambling for replacements.',
  contrarian: 'Going against consensus is only controversial until the standings prove you right.',
}

function getPickRound(pickNumber, numTeams) {
  return Math.ceil(pickNumber / numTeams)
}

export function calculateAdpDeltas(userPicks, playerMap, numTeams) {
  return userPicks
    .map(pick => {
      const player = playerMap[pick.playerId]
      if (!player) return null
      return {
        player,
        pickNumber: pick.pickNumber,
        round: getPickRound(pick.pickNumber, numTeams),
        adpDelta: (player.adp ?? pick.pickNumber) - pick.pickNumber,
      }
    })
    .filter(Boolean)
}

export function getTopCategories(categoryGaps) {
  return categoryGaps
    .filter(g => g.grade === 'strong')
    .map(g => g.label)
    .slice(0, 3)
}

const ARCHETYPE_STATS_KEY = 'pocketbeane_archetype_stats'
const DEFAULT_STATS = {
  moneyball_gm: 0, category_surgeon: 0, architect: 0,
  ceiling_chaser: 0, riverboat_gambler: 0, underdog_whisperer: 0,
  zero_to_hero: 0, floor_builder: 0, contrarian: 0, totalDrafts: 0,
}

export function trackArchetypeStat(archetypeId) {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(ARCHETYPE_STATS_KEY)
    const stats = raw ? { ...DEFAULT_STATS, ...JSON.parse(raw) } : { ...DEFAULT_STATS }
    stats[archetypeId] = (stats[archetypeId] ?? 0) + 1
    stats.totalDrafts = (stats.totalDrafts ?? 0) + 1
    localStorage.setItem(ARCHETYPE_STATS_KEY, JSON.stringify(stats))
  } catch {}
}

export function classifyDraftDNA(userPicks, playerMap, categoryGaps, numTeams, gmProfile = null, sport = 'nba') {
  const enriched = calculateAdpDeltas(userPicks, playerMap, numTeams)
  if (enriched.length === 0) return ARCHETYPES.contrarian

  const log = (id, fired, details) =>
    console.debug(`[DraftDNA] ${id}: ${fired ? '✓ MATCH' : '✗'} | ${details}`)

  const strongCats = categoryGaps.filter(g => g.grade === 'strong')
  const weakCats = categoryGaps.filter(g => g.grade === 'weak' || g.grade === 'missing')
  const okOrStrongCats = categoryGaps.filter(g => g.grade === 'strong' || g.grade === 'ok')

  const netAdpValue = enriched.reduce((sum, e) => sum + e.adpDelta, 0)
  const valuePicks = enriched.filter(e => e.adpDelta >= 10)

  // 1. Moneyball GM — 4+ value steals, positive net value
  const moneyballFired = valuePicks.length >= 4 && netAdpValue > 0
  log('moneyball_gm', moneyballFired, `valuePicks=${valuePicks.length}(need≥4), netValue=${netAdpValue.toFixed(1)}(need>0)`)
  if (moneyballFired) return ARCHETYPES.moneyball_gm

  // 2. Category Surgeon — dominant in 3+ cats, deliberately punting others
  const isPuntProfile = gmProfile?.categoryStrategy === 'punt_categories'
  const surgeonFired = strongCats.length >= 3 && (weakCats.length >= 1 || isPuntProfile)
  log('category_surgeon', surgeonFired, `strongCats=${strongCats.length}(need≥3), weakCats=${weakCats.length}, isPunt=${isPuntProfile}`)
  if (surgeonFired) return ARCHETYPES.category_surgeon

  // 3. Architect — competitive in 7+ of 9 categories
  const architectFired = okOrStrongCats.length >= 7
  log('architect', architectFired, `okOrStrong=${okOrStrongCats.length}(need≥7)`)
  if (architectFired) return ARCHETYPES.architect

  // 4. Ceiling Chaser — 2+ early injury risks + young player upside
  const earlyInjuryPicks = enriched.filter(e => e.round <= 5 && e.player.injury_risk)
  const youngPicks = enriched.filter(e => e.player.age < 24)
  const isAggressiveProfile = gmProfile?.injuryTolerance === 'aggressive'
  const ceilingFired = earlyInjuryPicks.length >= 2 && (youngPicks.length >= 1 || isAggressiveProfile)
  log('ceiling_chaser', ceilingFired, `earlyInjury=${earlyInjuryPicks.length}(need≥2), youngPicks=${youngPicks.length}, aggressive=${isAggressiveProfile}`)
  if (ceilingFired) return ARCHETYPES.ceiling_chaser

  // 5. Riverboat Gambler — maximum variance across the board
  const allInjuryPicks = enriched.filter(e => e.player.injury_risk)
  // MLB: pitchers have naturally low gp (30 starts vs 162 games), so use injury_risk as the variance signal instead
  const lowGpPicks = sport === 'mlb'
    ? enriched.filter(e => e.player.injury_risk)
    : enriched.filter(e => (e.player.prior_season?.gp ?? 82) < 65)
  const riverboatFired = allInjuryPicks.length >= 3 && lowGpPicks.length >= 2 && strongCats.length >= 2 && weakCats.length >= 2
  log('riverboat_gambler', riverboatFired, `allInjury=${allInjuryPicks.length}(need≥3), lowGp=${lowGpPicks.length}(need≥2), strong=${strongCats.length}(need≥2), weak=${weakCats.length}(need≥2)`)
  if (riverboatFired) return ARCHETYPES.riverboat_gambler

  // 6. Underdog Whisperer — late-round value concentration
  const lateValuePicks = enriched.filter(e => e.round >= 7 && e.adpDelta >= 10)
  const earlyValuePicks = enriched.filter(e => e.round < 7 && e.adpDelta >= 10)
  const contractYearPicks = enriched.filter(e => e.player.contract_year)
  const lateValueSum = lateValuePicks.reduce((s, e) => s + e.adpDelta, 0)
  const earlyValueSum = earlyValuePicks.reduce((s, e) => s + e.adpDelta, 0)
  const underdogFired = lateValuePicks.length >= 3 && (contractYearPicks.length >= 2 || lateValueSum > earlyValueSum)
  log('underdog_whisperer', underdogFired, `lateValue=${lateValuePicks.length}(need≥3), contractYear=${contractYearPicks.length}, lateSum=${lateValueSum.toFixed(1)} vs earlySum=${earlyValueSum.toFixed(1)}`)
  if (underdogFired) return ARCHETYPES.underdog_whisperer

  // 7. Zero-to-Hero — elite anchor + late-round depth
  const hasEliteRound1 = enriched.some(e => e.round === 1 && (e.player.adp ?? 99) <= 5.5)
  const lateRoundValuePicks = enriched.filter(e => e.round >= 9 && e.adpDelta >= 8)
  const zeroHeroFired = hasEliteRound1 && lateRoundValuePicks.length >= 2
  log('zero_to_hero', zeroHeroFired, `eliteR1=${hasEliteRound1}, lateRoundValue=${lateRoundValuePicks.length}(need≥2)`)
  if (zeroHeroFired) return ARCHETYPES.zero_to_hero

  // 8. Floor Builder — zero injury risks, high games played
  const avgGp = enriched.reduce((s, e) => s + (e.player.prior_season?.gp ?? 0), 0) / enriched.length
  // MLB: SP have ~30 starts vs batters' ~140 games; threshold of 20 ensures any healthy mixed roster qualifies
  const gpFloorThreshold = sport === 'mlb' ? 20 : 70
  const floorFired = allInjuryPicks.length === 0 && avgGp > gpFloorThreshold
  log('floor_builder', floorFired, `injuryPicks=${allInjuryPicks.length}(need=0), avgGp=${avgGp.toFixed(1)}(need>70)`)
  if (floorFired) return ARCHETYPES.floor_builder

  // 9. Contrarian — catch-all for everyone else
  log('contrarian', true, 'catch-all')
  return ARCHETYPES.contrarian
}
