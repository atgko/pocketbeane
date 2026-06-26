const PROFILE_KEY = 'pocketbeane_gm_profile'

export const QUIZ_QUESTIONS = [
  {
    id: 'injuryTolerance',
    question: 'How do you handle injury risk?',
    options: [
      { value: 'conservative', label: 'Conservative', desc: 'Avoid injury-prone players — dock their ranking significantly' },
      { value: 'moderate',     label: 'Moderate',     desc: 'Flag injury risk but weigh it against upside' },
      { value: 'aggressive',   label: 'Aggressive',   desc: 'Injury history = market discount — exploit it' },
    ],
  },
  {
    id: 'categoryStrategy',
    question: "What's your category strategy?",
    options: [
      { value: 'compete_all_9',    label: 'Compete in all 9',      desc: 'Balanced across every category' },
      { value: 'punt_categories',  label: 'Punt 1-2 categories',   desc: 'Dominate 7 rather than spread thin' },
      { value: 'read_the_draft',   label: 'Read the draft',        desc: "Decide based on what's available" },
    ],
  },
  {
    id: 'draftStrategy',
    question: "What's your draft strategy?",
    options: [
      { value: 'beane',            label: 'Beane Mode',       desc: 'ADP value-first — exploit market mispricings, fill categories in the middle rounds' },
      { value: 'balanced',         label: 'Balanced',         desc: 'Even spread across all categories and positions from round one' },
      { value: 'stars-and-scrubs', label: 'Stars and scrubs', desc: 'Elite players first, fill depth late' },
      { value: 'punt',             label: 'Punt strategy',    desc: 'Dominate most categories by deliberately conceding 1-2' },
    ],
  },
]

export const INJURY_DISPLAY = {
  conservative: 'Conservative',
  moderate:     'Moderate',
  aggressive:   'Aggressive',
}

export const CATEGORY_DISPLAY = {
  compete_all_9:   'Compete in all 9',
  punt_categories: 'Punt 1-2 categories',
  read_the_draft:  'Read the draft',
}

export const STRATEGY_DISPLAY = {
  beane:            'Beane Mode',
  balanced:         'Balanced',
  'stars-and-scrubs': 'Stars and scrubs',
  punt:             'Punt strategy',
}

export function getGMProfile() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveGMProfile(updates) {
  if (typeof window === 'undefined') return
  const existing = getGMProfile() ?? {}
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...existing, ...updates, version: 1 }))
}

export function clearGMProfile() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(PROFILE_KEY)
}

// Merges global profile + optional per-league override.
// Returns null if no completed global profile exists.
export function resolveProfile(leagueOverride = null) {
  const global = getGMProfile()
  if (!global?.completedAt) return null

  const override = leagueOverride?.hasOverride ? leagueOverride : null
  return {
    injuryTolerance: override?.injuryTolerance ?? global.injuryTolerance,
    categoryStrategy: override?.categoryStrategy ?? global.categoryStrategy,
    draftStrategy: override?.draftStrategy ?? global.draftStrategy,
  }
}
