import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#5C5C5C',
        accent: '#2575E6',
        'accent-hover': '#1A65D6',
        page: '#FFFFFF',
        surface: '#F0F7FF',
        'surface-soft': '#E8F2FF',
        'ink-muted': '#949494',
        'ink-faint': '#B8B8B8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        outfit: ['Outfit', 'system-ui', 'sans-serif'],
        script: ['Dancing Script', 'cursive'],
        'google-signin': ['Roboto', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        body: ['14px', { lineHeight: '1.45' }],
      },
      borderRadius: {
        card: '12px',
        lg: '16px',
      },
      boxShadow: {
        card: '0 2px 16px rgba(186, 220, 255, 0.22)',
        'card-hover': '0 4px 24px rgba(186, 220, 255, 0.32)',
        input: '0 4px 28px rgba(186, 220, 255, 0.28)',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-in-out both',
        'fade-up': 'fadeUp 400ms ease-out both',
        'slide-in-left': 'slideInLeft 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'slide-out-right': 'slideOutRight 250ms ease-in both',
        'slide-down-in': 'slideDownIn 300ms ease-out both',
        'button-pulse': 'buttonPulse 1.5s ease-in-out infinite',
        'page-in': 'pageIn 200ms ease-in-out both',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideOutRight: {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(24px)' },
        },
        slideDownIn: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        buttonPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(37, 99, 235, 0.35)' },
          '50%': { boxShadow: '0 0 0 6px rgba(37, 99, 235, 0)' },
        },
        pageIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      transitionDuration: {
        focus: '200ms',
      },
    },
  },
  plugins: [],
}

export default config
