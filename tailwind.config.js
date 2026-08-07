/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        mc: {
          bg: 'var(--mc-bg)',
          surface: 'var(--mc-surface)',
          card: 'var(--mc-card)',
          border: 'var(--mc-border)',
          accent: 'var(--mc-accent)',
          'accent-hover': 'var(--mc-accent-hover)',
          text: 'var(--mc-text)',
          muted: 'var(--mc-muted)',
          green: 'var(--mc-green)',
          red: 'var(--mc-red)',
          orange: 'var(--mc-orange)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
