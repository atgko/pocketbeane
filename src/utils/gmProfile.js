const PROFILE_KEY = 'pocketbeane_gm_profile'

export const QUIZ_QUESTIONS = [
  {
    id: 'injuryTolerance',
    question: 'How do you handle injury risk?',
    options: [
      { value: 'play_it_safe',     label: 'Play it safe',     desc: 'Avoid injury-prone players regardless of upside' },
      { value: 'calculated_risk',  label: 'Calculated risk',  desc: 'Accept injury risk for elite upside — flag it for me' },
      { value: 'round_dependent',  label: 'Round dependent',  desc: 'Safe early, riskier in mid-to-late rounds' },
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
    id: 'rosterPhilosophy',
    question: "What's your roster philosophy?",
    options: [
      { value: 'stars_and_scrubs',     label: 'Stars and scrubs',      desc: 'Elite players first, fill depth late' },
      { value: 'balanced_depth',       label: 'Balanced depth',        desc: 'Consistent contributors across all roster spots' },
      { value: 'streaming_friendly',   label: 'Streaming-friendly',    desc: 'Flexible roster I can move around week to week' },
    ],
  },
]

export const INJURY_DISPLAY = {
  play_it_safe:    'Play it safe',
  calculated_risk: 'Calculated risk',
  round_dependent: 'Round dependent',
}

export const CATEGORY_DISPLAY = {
  compete_all_9:   'Compete in all 9',
  punt_categories: 'Punt 1-2 categories',
  read_the_draft:  'Read the draft',
}

export const ROSTER_DISPLAY = {
  stars_and_scrubs:   'Stars and scrubs',
  balanced_depth:     'Balanced depth',
  streaming_friendly: 'Streaming-friendly',
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
    rosterPhilosophy: override?.rosterPhilosophy ?? global.rosterPhilosophy,
  }
}
