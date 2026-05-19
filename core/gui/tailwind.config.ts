/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        cyber: {
          bg:       '#06060e',
          surface:  '#0d0d1a',
          card:     '#12122a',
          border:   '#1e1e3a',
          muted:    '#8888aa',
          cyan:     'rgb(var(--cyber-cyan-rgb))',
          violet:   'rgb(var(--cyber-violet-rgb))',
          magenta:  '#e040fb',
          green:    '#00e676',
          yellow:   '#ffea00',
          red:      '#ff1744',
          orange:   '#ff9100',
        },
      },
      boxShadow: {
        'glow-cyan':   '0 0 20px rgba(var(--cyber-cyan-rgb), 0.15), 0 0 60px rgba(var(--cyber-cyan-rgb), 0.05)',
        'glow-violet': '0 0 20px rgba(var(--cyber-violet-rgb), 0.15), 0 0 60px rgba(var(--cyber-violet-rgb), 0.05)',
        'glow-green':  '0 0 20px rgba(0, 230, 118, 0.15)',
        'glow-red':    '0 0 20px rgba(255, 23, 68, 0.15)',
      },
      backgroundImage: {
        'gradient-cyber': 'linear-gradient(135deg, rgb(var(--cyber-cyan-rgb)) 0%, rgb(var(--cyber-violet-rgb)) 100%)',
        'gradient-card':  'linear-gradient(145deg, rgba(13,13,26,0.8) 0%, rgba(18,18,42,0.6) 100%)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'scan-line':  'scan-line 3s linear infinite',
        'fade-in':    'fade-in 0.5s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '0.6' },
          '50%':      { opacity: '1' },
        },
        'scan-line': {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
