/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // PocketBeane "Front Office" palette — see ui-redesign/D01_UI_REVAMP_DESIGN_BRIEF.md
        surface: {
          base:    'rgb(var(--color-surface-base) / <alpha-value>)',
          raised:  'rgb(var(--color-surface-raised) / <alpha-value>)',
          overlay: 'rgb(var(--color-surface-overlay) / <alpha-value>)',
          line:    'rgb(var(--color-surface-line) / <alpha-value>)',
        },
        beane: {
          green:       'rgb(var(--color-beane-green) / <alpha-value>)',
          'green-dim': 'rgb(var(--color-beane-green-dim) / <alpha-value>)',
          'green-text':'rgb(var(--color-beane-green-text) / <alpha-value>)',
        },
        brass: 'rgb(var(--color-brass) / <alpha-value>)',
        ink: {
          primary:   'rgb(var(--color-ink-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-ink-secondary) / <alpha-value>)',
          muted:     'rgb(var(--color-ink-muted) / <alpha-value>)',
        },
        signal: {
          up:    'rgb(var(--color-signal-up) / <alpha-value>)',
          down:  'rgb(var(--color-signal-down) / <alpha-value>)',
          watch: 'rgb(var(--color-signal-watch) / <alpha-value>)',
          info:  'rgb(var(--color-signal-info) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans:    ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
        mono:    ['var(--font-jetbrains-mono)', 'Fira Code', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Weight is applied via a companion font-medium/font-semibold utility
        // at each call site — Tailwind's fontSize tuple doesn't carry weight.
        display:   ['2.4rem',    { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        title:     ['1.5rem',    { lineHeight: '1.25' }],
        heading:   ['1.125rem',  { lineHeight: '1.35' }],
        body:      ['0.9375rem', { lineHeight: '1.5' }],
        label:     ['0.8125rem', { lineHeight: '1.3', letterSpacing: '0.02em' }],
        // Compact badge/eyebrow-only step below `label`. Documents what was
        // previously ~40 scattered text-[9px]/[10px]/[11px] arbitrary
        // values (found by the D-01 audit) as one real, deliberate token —
        // never for body or data content, only dense inline badges/pills.
        micro:     ['0.625rem', { lineHeight: '1.3', letterSpacing: '0.02em' }],
        data:      ['0.875rem',  { lineHeight: '1.4' }],
        'data-lg': ['1.25rem',   { lineHeight: '1.2' }],
      },
      keyframes: {
        // Indeterminate loading bar — a sliding segment, not a fill that
        // implies a known percentage. Used where we're waiting on a Claude
        // call of unknown duration (see AdvisorCard "thinking" states) and
        // don't want to fabricate progress we can't actually measure.
        'indeterminate-slide': {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(250%)' },
        },
      },
      animation: {
        'indeterminate-slide': 'indeterminate-slide 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
