/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // PocketBeane dark GM war room palette
        bg:      '#0f1117',   // page background
        surface: '#1a1f2e',   // card / panel background
        border:  '#2a3142',   // subtle borders

        // Pick states
        pick:    '#16a34a',   // user pick — green-600
        opp:     '#374151',   // opponent pick — grey

        // Alert types
        value:   '#d97706',   // amber-600 — value pick flag
        injury:  '#dc2626',   // red-600   — injury flag
        scarcity:'#ea580c',   // orange-600 — position scarcity alert
        category:'#7c3aed',   // violet-600 — category gap alert
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
