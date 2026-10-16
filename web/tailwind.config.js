/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand teal, sampled from the Al Khadim logo (#0D4E60). 400 is the main shade.
        primary: {
          DEFAULT: '#0F5468',
          50:  '#EEF6F8',
          100: '#D6EAEF',
          200: '#AED4DE',
          300: '#6FAABA',
          400: '#0F5468',
          500: '#0A4556',
          600: '#083A49',
          700: '#062F3B',
          800: '#052530',
          900: '#031A22',
        },
        dark: '#0f172a',
        // Public website theme — values come from CSS variables set from the
        // Website Builder (lib/homepage/config.ts → themeVars).
        hp: {
          primary:        'rgb(var(--hp-primary) / <alpha-value>)',
          'primary-dark': 'rgb(var(--hp-primary-dark) / <alpha-value>)',
          accent:         'rgb(var(--hp-accent) / <alpha-value>)',
          gold:           'rgb(var(--hp-gold) / <alpha-value>)',
          ink:            'rgb(var(--hp-ink) / <alpha-value>)',
          sand:           'rgb(var(--hp-sand) / <alpha-value>)',
          surface:        'rgb(var(--hp-surface) / <alpha-value>)',
          text:           'rgb(var(--hp-text) / <alpha-value>)',
          muted:          'rgb(var(--hp-muted) / <alpha-value>)',
        },
      },
      borderRadius: {
        'hp-btn':  'var(--hp-radius-btn)',
        'hp-card': 'var(--hp-radius-card)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        heading: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        'hp-heading': ['var(--hp-font-heading)'],
        'hp-body':    ['var(--hp-font-body)'],
        'hp-arabic':  ['var(--hp-font-arabic)'],
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
      });
    },
  ],
};
