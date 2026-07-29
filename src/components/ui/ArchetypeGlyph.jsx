const COMMON = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }

// Abstract monoline glyphs, one per Draft DNA archetype — brass stroke, no fills
// except the small anchor/discovery dots called out per-glyph. Keep these
// geometric, not illustrative (D01_UI_REVAMP_DESIGN_BRIEF.md Part 4.4).
const PATHS = {
  moneyball_gm: (
    <path d="M12 3 L21 12 L12 21 L3 12 Z" />
  ),
  category_surgeon: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  architect: (
    <path d="M4 18 L12 4 L20 18 M4 18h16M7.5 18v-2.2M12 18v-3.4M16.5 18v-2.2" />
  ),
  ceiling_chaser: (
    <path d="M4 20h4v-4h4v-4h4v-4h4v-4" />
  ),
  riverboat_gambler: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="16" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  underdog_whisperer: (
    <>
      <circle cx="4" cy="16" r="1.3" fill="currentColor" stroke="none" />
      <path d="M4 16 9 18 20 5" />
      <path d="M20 5h-4M20 5v4" />
    </>
  ),
  zero_to_hero: (
    <>
      <circle cx="12" cy="19.5" r="1.3" fill="currentColor" stroke="none" />
      <path d="M12 18v-4" />
      <path d="M12 2 13.2 9.2 20 12 13.2 14.8 12 22 10.8 14.8 4 12 10.8 9.2 Z" />
    </>
  ),
  floor_builder: (
    <path d="M4 6h16M4 20h16M7.5 6v14M12 6v14M16.5 6v14" />
  ),
  contrarian: (
    <>
      <path d="M3 12h18" strokeDasharray="1.5 3" opacity="0.4" />
      <path d="M3 12h4l3-6 4 12 3-6h4" />
    </>
  ),
}

export default function ArchetypeGlyph({ id, className = '' }) {
  const content = PATHS[id] ?? PATHS.contrarian
  return (
    <svg viewBox="0 0 24 24" className={className} {...COMMON}>
      {content}
    </svg>
  )
}
