/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0b0c10',
        surface: {
          DEFAULT: '#13151b',
          secondary: '#181b24',
          plate: '#1e222d',
          cavity: '#08090c',
          hover: '#242836',
        },
        border: {
          DEFAULT: '#202430',
          subtle: '#171a22',
          highlight: 'rgba(255, 255, 255, 0.08)',
        },
        accent: {
          DEFAULT: '#f59e0b',
          hover: '#fbbf24',
          dim: 'rgba(245, 158, 11, 0.15)',
          glow: 'rgba(245, 158, 11, 0.45)',
        },
        vfd: {
          bg: '#05070a',
          amber: '#f59e0b',
          amberDim: 'rgba(245, 158, 11, 0.18)',
          cyan: '#06b6d4',
          red: '#ef4444',
          green: '#10b981',
        },
        text: {
          primary: '#f1f2f6',
          muted: '#7a8194',
          subtle: '#484e60',
        },
      },
      fontFamily: {
        sans: ['"Bricolage Grotesque"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        cover: '10px',
        btn: '6px',
      },
      boxShadow: {
        'skeuo-btn': '0 3px 5px -1px rgba(0, 0, 0, 0.8), 0 1px 2px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.14), inset 0 -1px 0 rgba(0, 0, 0, 0.4)',
        'skeuo-btn-active': 'inset 0 2px 5px rgba(0, 0, 0, 0.9), inset 0 1px 2px rgba(0, 0, 0, 0.7), 0 1px 0 rgba(255, 255, 255, 0.04)',
        'skeuo-inset': 'inset 0 2px 6px rgba(0, 0, 0, 0.85), inset 0 1px 2px rgba(0, 0, 0, 0.7), 0 1px 0 rgba(255, 255, 255, 0.05)',
        'skeuo-screen': 'inset 0 3px 10px rgba(0, 0, 0, 0.95), 0 1px 0 rgba(255, 255, 255, 0.06)',
        'skeuo-card': '0 8px 24px -4px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.08), inset 0 -1px 0 rgba(0, 0, 0, 0.5)',
        'glow-amber': '0 0 14px rgba(245, 158, 11, 0.4)',
        'glow-amber-lg': '0 0 24px rgba(245, 158, 11, 0.55)',
      },
    },
  },
  plugins: [],
}
