import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { ReportTestOutcome } from './parser';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

enum OutcomeColors {
  Success = 'success',
  Primary = 'primary',
  Danger = 'danger',
  Warning = 'warning',
  Default = 'default',
}

export function testStatusToColor(outcome?: ReportTestOutcome): {
  title: string;
  colorName: OutcomeColors;
  color: string;
} {
  const outcomes = {
    [ReportTestOutcome.Expected]: {
      title: 'Passed',
      colorName: OutcomeColors.Success,
      color: 'text-success-500',
    },
    [ReportTestOutcome.Unexpected]: {
      title: 'Failed',
      colorName: OutcomeColors.Danger,
      color: 'text-danger-500',
    },
    [ReportTestOutcome.Flaky]: {
      title: 'Flaky',
      colorName: OutcomeColors.Warning,
      color: 'text-warning-500',
    },
    [ReportTestOutcome.Skipped]: {
      title: 'Skipped',
      colorName: OutcomeColors.Default,
      color: 'text-gray-500',
    },
    unknown: {
      title: 'N/A',
      colorName: OutcomeColors.Primary,
      color: 'text-gray-200',
    },
  };

  return outcome ? outcomes[outcome] : outcomes.unknown;
}

// Single source of truth for status colours. Values are HeroUI theme vars
// (success/danger/warning in tailwind.config.ts = the Testboard palette), so
// they switch with light/dark on their own. `hex` keeps its name for the
// existing call sites but holds any CSS colour — use it via `style`, not as an
// SVG presentation attribute (var() doesn't resolve there).
export interface StatusStyle {
  label: string;
  hex: string;
  tint: string;
  border: string;
}

const themeVar = (token: string, alpha?: number) =>
  alpha === undefined ? `hsl(var(--heroui-${token}))` : `hsl(var(--heroui-${token}) / ${alpha})`;

export const STATUS_COLORS = {
  passed: themeVar('success'),
  failed: themeVar('danger'),
  flaky: themeVar('warning'),
  skipped: themeVar('default-400'),
} as const;

const styleFor = (label: string, token: string): StatusStyle => ({
  label,
  hex: themeVar(token),
  tint: themeVar(token, 0.14),
  border: themeVar(token, 0.35),
});

const STATUS_STYLES: Record<ReportTestOutcome, StatusStyle> = {
  [ReportTestOutcome.Expected]: styleFor('Passed', 'success'),
  [ReportTestOutcome.Unexpected]: styleFor('Failed', 'danger'),
  [ReportTestOutcome.Flaky]: styleFor('Flaky', 'warning'),
  [ReportTestOutcome.Skipped]: styleFor('Skipped', 'default-400'),
};

export const statusStyle = (outcome: ReportTestOutcome): StatusStyle => STATUS_STYLES[outcome];

// Message key (status.*) for an outcome — the visible label is translated.
export const STATUS_KEYS: Record<ReportTestOutcome, 'passed' | 'failed' | 'flaky' | 'skipped'> = {
  [ReportTestOutcome.Expected]: 'passed',
  [ReportTestOutcome.Unexpected]: 'failed',
  [ReportTestOutcome.Flaky]: 'flaky',
  [ReportTestOutcome.Skipped]: 'skipped',
};

// Worst outcome present in a report's stats — drives the row accent.
export const passRateColor = (passRate: number): string =>
  passRate < 90 ? STATUS_COLORS.failed : passRate < 99 ? STATUS_COLORS.flaky : STATUS_COLORS.passed;

// Same, as a translucent tint for pills behind passRateColor text.
export const passRateTint = (passRate: number, alpha = 0.14): string =>
  themeVar(passRate < 90 ? 'danger' : passRate < 99 ? 'warning' : 'success', alpha);
