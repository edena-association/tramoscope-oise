/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        edena: {
          primary: '#0B2966',
          secondary: '#E4E2DD'
        },
        trame: {
          verte: '#2E7D32',
          bleue: '#1565C0',
          turquoise: '#00897B',
          brune: '#6D4C41',
          noire: '#4A148C',
          rose: '#C2185B'
        },
        analyse: {
          alerte: '#D32F2F',
          potentiel: '#F57C00',
          bon: '#388E3C'
        }
      },
      fontFamily: {
        sans: ['"Rethink Sans"', 'Inter', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        DEFAULT: '6px'
      }
    }
  },
  plugins: []
};
