import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#444444',
        'ink-muted': '#7D8693',
        'ink-faint': '#AEB8C5',
        accent: '#2F76E8',
        'accent-hover': '#2568D9',
        'accent-soft': '#EAF2FF',
        page: '#FFFFFF',
        surface: '#F8FBFF',
        'surface-soft': '#F3F8FF',
        border: '#E7EEF8',
        'border-hover': '#D8E4F5',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        outfit: ['Outfit', 'system-ui', 'sans-serif'],
        script: ['Dancing Script', 'cursive'],
        'google-signin': ['Roboto', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        body: ['14px', { lineHeight: '1.45' }],
        display: ['34px', { lineHeight: '1.1' }],
        'mobile-title': ['15px', { lineHeight: '1.35' }],
        'mobile-body': ['15px', { lineHeight: '1.45' }],
        'mobile-secondary': ['13px', { lineHeight: '1.4' }],
        'mobile-caption': ['12px', { lineHeight: '1.35' }],
        'mobile-label': ['11px', { lineHeight: '1.3' }],
      },
      borderRadius: {
        card: '12px',
        lg: '16px',
      },
      boxShadow: {
        card: '0 2px 16px rgba(47, 118, 232, 0.08)',
        'card-hover': '0 8px 32px rgba(47, 118, 232, 0.12)',
        input: '0 4px 24px rgba(47, 118, 232, 0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-in-out both',
        'fade-up': 'fadeUp 400ms ease-out both',
        'slide-in-left': 'slideInLeft 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'slide-out-right': 'slideOutRight 250ms ease-in both',
        'fade-out': 'fadeOut 150ms ease-in both',
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
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideDownIn: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        buttonPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(47, 118, 232, 0.35)' },
          '50%': { boxShadow: '0 0 0 6px rgba(47, 118, 232, 0)' },
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
