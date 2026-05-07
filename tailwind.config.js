/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0D0F1A',
        secondary: '#13162A',
        card: '#1A1E35',
        'card-hover': '#222745',
        'accent-teal': '#0F6E56',
        'accent-teal-light': '#E1F5EE',
        'accent-purple': '#534AB7',
        'accent-amber': '#854F0B',
        'accent-coral': '#993C1D',
        'text-primary': '#F0F2FF',
        'text-secondary': '#8B90B0',
        'border-subtle': 'rgba(255,255,255,0.08)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.4s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'score-pop': 'score-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'score-pop': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
