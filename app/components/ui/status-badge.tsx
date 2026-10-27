import { useTranslations } from 'next-intl';

import { ReportTestOutcome } from '@/app/lib/parser';
import { STATUS_KEYS, statusStyle } from '@/app/lib/tailwind';

interface StatusBadgeProps {
  outcome: ReportTestOutcome;
  // Uppercase FAILED/PASSED style (report verdict) vs. sentence case (test row).
  variant?: 'badge' | 'text';
  className?: string;
}

// Tinted status pill with a leading dot. Colours from the single statusStyle map.
export const StatusBadge: React.FC<StatusBadgeProps> = ({ outcome, variant = 'badge', className }) => {
  const s = statusStyle(outcome);
  const t = useTranslations('status');
  const label = t(STATUS_KEYS[outcome]);

  if (variant === 'text') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium ${className ?? ''}`}
        style={{ color: s.hex }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.hex }} />
        {label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-md px-[7px] h-5 text-[11px] font-semibold uppercase tracking-wide ${className ?? ''}`}
      style={{ color: s.hex, backgroundColor: s.tint, border: `1px solid ${s.border}` }}
    >
      {label}
    </span>
  );
};

// Report-level verdict from stats (failed wins, then flaky, else passed).
export const outcomeFromStats = (stats: { unexpected: number; flaky: number }): ReportTestOutcome =>
  stats.unexpected > 0
    ? ReportTestOutcome.Unexpected
    : stats.flaky > 0
      ? ReportTestOutcome.Flaky
      : ReportTestOutcome.Expected;
