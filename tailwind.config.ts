import type { Config } from 'tailwindcss';

import { heroui } from '@heroui/theme';

const config = {
  content: ['./app/**/*.{js,ts,tsx,mdx}', './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  darkMode: 'class',
  plugins: [
    heroui({
      layout: {
        borderWidth: {
          small: '1px',
          medium: '1px',
          large: '2px',
        },
        // Softer, mockup-matched rounding: fields ~9px, cards ~14px.
        radius: {
          small: '8px',
          medium: '10px',
          large: '14px',
        },
      },
      // App-wide palette from the Run-form mockup. `default-*` drives field
      // fills/borders (faded inputs, chips), `content1` is cards/panels,
      // `background`/`foreground` the page ground and ink.
      themes: {
        light: {
          colors: {
            background: '#f4f6f8',
            foreground: '#1a2230',
            divider: '#e7ebf0',
            content1: '#ffffff',
            content2: '#f6f8fa',
            primary: {
              DEFAULT: '#4f46e5',
              foreground: '#ffffff',
            },
            // Status hues shared with the logo, Run health and the pass-rate
            // chart (HeroUI's defaults were a pinkish red / neon green).
            success: { DEFAULT: '#639922', foreground: '#ffffff' },
            warning: { DEFAULT: '#BA7517', foreground: '#ffffff' },
            danger: { DEFAULT: '#E24B4A', foreground: '#ffffff' },
            default: {
              50: '#f6f8fa',
              100: '#f1f3f6',
              200: '#e2e6ec',
              300: '#cfd6df',
              400: '#97a0b0',
              500: '#6b7688',
              600: '#4b5567',
              700: '#333c4c',
              800: '#212a38',
              900: '#141b26',
              DEFAULT: '#e2e6ec',
              foreground: '#1a2230',
            },
          },
        },
        dark: {
          colors: {
            background: '#0e1218',
            foreground: '#e8ecf2',
            divider: '#262d38',
            content1: '#161b23',
            content2: '#1b212b',
            primary: {
              DEFAULT: '#6366f1',
              foreground: '#ffffff',
            },
            success: { DEFAULT: '#97C459', foreground: '#173404' },
            warning: { DEFAULT: '#EF9F27', foreground: '#412402' },
            danger: { DEFAULT: '#ef4444', foreground: '#ffffff' },
            default: {
              // Slightly lighter than content1 (#161b23) so table-row hover is
              // visible in dark mode.
              50: '#1a2029',
              100: '#1d232d',
              200: '#2a323e',
              300: '#39424f',
              400: '#6b7686',
              500: '#97a2b3',
              600: '#b6bfcc',
              700: '#d2d9e2',
              800: '#e6ebf1',
              900: '#f3f6fa',
              DEFAULT: '#2a323e',
              foreground: '#e8ecf2',
            },
          },
        },
      },
    }),
  ],
} satisfies Config;

export default config;
