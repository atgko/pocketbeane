export function normalizeName(name) {
  return name
    // Strip diacritics — Yahoo's roster API returns accented names (Jeremy
    // Peña, Cristopher Sánchez, Yandy Díaz, ...) while players.json stores
    // the plain-ASCII form. Without this, every accented name silently fails
    // to match and gets treated as an unowned free agent.
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    // Yahoo splits two-way players (e.g. Shohei Ohtani) into two roster
    // entries — "Shohei Ohtani (Pitcher)" and "Shohei Ohtani (Batter)" —
    // that must still match players.json's single combined entry.
    .replace(/\s*\([^)]*\)\s*$/, '')
    .toLowerCase()
    .replace(/[.']/g, '')
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
