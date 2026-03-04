/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-light': 'var(--accent-light)',
        cyan: 'var(--cyan)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        card: 'var(--card)',
        'border-light': 'var(--border-light)',
        'border-2': 'var(--border-2)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        success: 'var(--success)',
        danger: 'var(--danger)',
        gold: 'var(--gold)',
        blue: 'var(--blue)',
        purple: 'var(--purple)',
        'status-pending': 'var(--status-pending)',
        'status-confirmed': 'var(--status-confirmed)',
        'status-shipped': 'var(--status-shipped)',
        'status-delivered': 'var(--status-delivered)',
        /* Hero slider primary & secondary */
        'hero-primary': 'var(--hero-primary)',
        'hero-secondary': 'var(--hero-secondary)',
      },
      fontFamily: {
        heading: ['Sora', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        button: '12px',
        'card-lg': '20px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-hover)',
        'bottom-sheet': '0 -8px 32px rgba(0,0,0,0.12)',
        'top-bar': '0 1px 3px rgba(0,0,0,0.04)',
        'nav': '0 -1px 12px rgba(0,0,0,0.06)',
        'product': '0 2px 8px rgba(0,0,0,0.04), 0 0 1px rgba(0,0,0,0.06)',
        'product-hover': '0 12px 28px rgba(0,0,0,0.1), 0 0 1px rgba(0,0,0,0.08)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
        'out-expo': 'cubic-bezier(0.19, 1, 0.22, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
}
