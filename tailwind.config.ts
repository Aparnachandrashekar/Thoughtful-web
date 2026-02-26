import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#FEFAF9',
        // Terracotta / dusty rose system (from inspo)
        terra: '#D4756A',
        'terra-deep': '#B85D52',
        'terra-muted': '#C4736B',
        'terra-light': '#EBA89F',
        'blush-pale': '#FBE8E4',
        'blush-light': '#F5DDD9',
        'blush-medium': '#EDD0C9',
        // Legacy pastel palette (keeps existing components working)
        blush: '#FFE5E5',
        lavender: '#E8E0F0',
        mint: '#E0F2E9',
        peach: '#FFE8D6',
        sky: '#E0F0FF',
        sand: '#F5F0E8',
      },
      fontFamily: {
        sans:   ['DM Sans', 'system-ui', 'sans-serif'],
        script: ['Dancing Script', 'cursive'],
      },
      borderRadius: {
        'xl':   '1rem',
        '2xl':  '1.5rem',
        '3xl':  '2rem',
        '4xl':  '3rem',
        'pill': '9999px',
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease-out both',
        'fade-up':    'fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-up':   'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in':   'scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) both',
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.88)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
}

export default config
