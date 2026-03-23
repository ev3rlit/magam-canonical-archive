/** @type {import('tailwindcss').Config} */
const typography = require('@tailwindcss/typography');
const { join } = require('path');

const semanticColor = (variableName) => `rgb(var(${variableName}) / <alpha-value>)`;

module.exports = {
  content: [
    join(__dirname, 'app/**/*.{js,ts,jsx,tsx,mdx}'),
    join(__dirname, 'components/**/*.{js,ts,jsx,tsx,mdx}'),
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: semanticColor('--color-background'),
        foreground: semanticColor('--color-foreground'),
        muted: semanticColor('--color-muted'),
        card: semanticColor('--color-card'),
        border: semanticColor('--color-border'),
        ring: semanticColor('--color-ring'),
        primary: {
          DEFAULT: semanticColor('--color-primary'),
          foreground: semanticColor('--color-primary-foreground'),
        },
        danger: {
          DEFAULT: semanticColor('--color-danger'),
          foreground: semanticColor('--color-danger-foreground'),
        },
        success: {
          DEFAULT: semanticColor('--color-success'),
          foreground: semanticColor('--color-success-foreground'),
        },
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
        'raised': '0 10px 32px -24px rgb(var(--shadow-color) / 0.3), 0 12px 24px -24px rgb(var(--shadow-color) / 0.2)',
        'floating': '0 18px 56px -28px rgb(var(--shadow-color) / 0.42), 0 14px 28px -24px rgb(var(--shadow-color) / 0.24)',
      },
      borderRadius: {
        'sm': '0.125rem',
        'md': '0.375rem',
        'lg': '0.75rem',
        'pill': '999px',
      },
      scale: {
        '102': '1.02',
      },
      spacing: {
        '1': '0.25rem',
        '2': '0.5rem',
        '3': '0.75rem',
        '4': '1rem',
        '6': '1.5rem',
        '8': '2rem',
        '12': '3rem',
        '16': '4rem',
        '20': '5rem',
      },
      backdropBlur: {
        'glass': '24px',
      },
      animation: {
        'pop-in': 'popIn 0.2s ease-out forwards',
      },
      transitionDuration: {
        'fast': '160ms',
        'base': '240ms',
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
