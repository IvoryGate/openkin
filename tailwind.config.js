/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
    "./src/renderer/index.html"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3B82F6',
          hover: '#2563EB',
          deep: '#1E40AF'
        },
        surface: {
          DEFAULT: '#0F172A',
          secondary: '#1E293B',
          tertiary: '#334155'
        },
        text: {
          primary: '#F1F5F9',
          secondary: '#94A3B8',
          muted: '#64748B'
        },
        border: {
          DEFAULT: '#334155',
          hover: '#475569'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      borderRadius: {
        'lg': '8px',
        'md': '6px'
      },
      transitionDuration: {
        '200': '200ms'
      }
    },
  },
  plugins: [],
}
