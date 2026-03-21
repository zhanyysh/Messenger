/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Epilogue', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
      },
      colors: {
        background: '#0a0a0c',
        surface: 'rgba(255, 255, 255, 0.03)',
        border: 'rgba(255, 255, 255, 0.08)',
        primary: '#D4FF00', // Electric Lime
        secondary: '#FF0055', // Hyper Pink
        textMain: '#ffffff',
        textMuted: '#888888',
      },
      animation: {
        'blob': 'blob 10s infinite',
      },
      keyframes: {
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        }
      }
    },
  },
  plugins: [],
}
