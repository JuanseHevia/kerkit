import type { Config } from 'tailwindcss';

/**
 * The gallery's web theme mirrors @kerkit/ui's "Calm Confidence" tokens. The
 * RN token objects can't be imported into a web bundle, so their *values* are
 * transcribed into CSS variables (web/src/index.css) and surfaced here.
 */
export default {
  content: ['./web/index.html', './web/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: 'var(--k-page)',
        card: 'var(--k-card)',
        line: 'var(--k-border)',
        ink: {
          DEFAULT: 'var(--k-ink)',
          soft: 'var(--k-ink-soft)',
          faint: 'var(--k-ink-faint)',
        },
        forward: {
          DEFAULT: 'var(--k-forward)',
          deep: 'var(--k-forward-600)',
          soft: 'var(--k-forward-soft)',
        },
        warm: 'var(--k-warm)',
        ocean: 'var(--k-ocean)',
      },
      fontFamily: {
        display: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        card: '16px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(20,19,17,0.06)',
        lift: '0 10px 34px rgba(20,19,17,0.09)',
      },
      maxWidth: {
        shell: '1100px',
      },
    },
  },
  plugins: [],
} satisfies Config;
