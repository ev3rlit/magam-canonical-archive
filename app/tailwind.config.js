const workspaceSafelist = require('./tailwind.workspace-safelist.cjs');

/** @type {import('tailwindcss').Config} */
const typography = require('@tailwindcss/typography');
const { join } = require('path');

module.exports = {
  content: [
    join(__dirname, 'app/**/*.{js,ts,jsx,tsx,mdx}'),
    join(__dirname, 'components/**/*.{js,ts,jsx,tsx,mdx}'),
  ],
  // Runtime styling rollout keeps the existing workspace safelist bootstrap path active.
  safelist: workspaceSafelist,
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          900: '#312e81',
        },
        node: {
          sticky: '#fff475', // Classic Post-it
          surface: '#ffffff', // Standard Shape
          border: '#e2e8f0', // slate-200
          text: '#1e293b', // slate-800
        }
      },
      boxShadow: {
        'node': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'node-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'node-selected': '0 0 0 2px #6366f1, 0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      },
      scale: {
        '102': '1.02',
      },
      animation: {
        'pop-in': 'popIn 0.2s ease-out forwards',
      },
      keyframes: {
        popIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        }
      }
    },
  },
  plugins: [typography],
};
