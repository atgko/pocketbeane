'use strict'

/**
 * aliases.js
 *
 * Manual name mappings for players where FantasyPros and Basketball Reference
 * use genuinely different names that fuzzy matching won't resolve reliably.
 *
 * Format: { 'FantasyPros name': 'Basketball Reference name' }
 *
 * Notes:
 * - Accent differences (Jokić vs Jokic) and period differences (P.J. vs PJ)
 *   are handled automatically by normalization — no alias needed for those.
 * - Add entries here for: nickname vs full name, shortened vs full name,
 *   or any case where fuzzy match produces wrong results.
 * - Run build-players.js, check review.json, then add confirmed mismatches here.
 */

module.exports = {
  // Nickname → Full name differences
  'Nic Claxton':       'Nicolas Claxton',
  'Mo Bamba':          'Mohamed Bamba',
  'OG Anunoby':        'O.G. Anunoby',
  'Naz Reid':          'Nazreon Reid',       // verify — BBRef may use full name
  'Kenrich Williams':  'Kenrich Williams',   // placeholder, same name
  'Kj Martin':         'KJ Martin',
  'Cam Thomas':        'Cam Thomas',
  'Jalen Williams':    'Jalen Williams',

  // Confirmed fuzzy matches — BBRef encodes accented characters as ? in CSV exports
  'Luka Doncic':          'Luka Don?i?',
  'Alperen Sengun':       'Alperen ?eng?n',
  'Nikola Vucevic':       'Nikola Vu?evi?',
  'Kristaps Porzingis':   'Kristaps Porzi??is',
  'Dennis Schroder':      'Dennis Schr?der',
  'Egor Demin':           'Egor D?min',
}
