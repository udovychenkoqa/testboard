import { JetBrains_Mono as FontMono, Inter as FontSans } from 'next/font/google';

export const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
});

// Monospace for technical/tabular data — build numbers, durations, IDs, env
// tags. JetBrains Mono (no code ligatures needed here) reads cleanly for digits.
export const fontMono = FontMono({
  subsets: ['latin'],
  variable: '--font-mono',
});
