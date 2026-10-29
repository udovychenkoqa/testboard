import { type ReportStats } from '@/app/lib/parser';
import { STATUS_COLORS } from '@/app/lib/tailwind';

interface StatBarProps {
  stats: Pick<ReportStats, 'expected' | 'unexpected' | 'flaky' | 'skipped'>;
  height?: number;
  className?: string;
  // Scale to executed tests only, so the bar agrees with a pass-rate figure
  // shown next to it (skipped tests then live in the caption, not the bar).
  executedOnly?: boolean;
}

// Segmented pass/fail/flaky/skipped bar. 8px in the verdict strip, 5px in table
// rows. Colours match statusStyle().
export const StatBar: React.FC<StatBarProps> = ({ stats, height = 8, className, executedOnly }) => {
  const skipped = executedOnly ? 0 : stats.skipped;
  const total = stats.expected + stats.unexpected + stats.flaky + skipped || 1;
  const segments: Array<[number, string]> = [
    [stats.expected, STATUS_COLORS.passed],
    [stats.unexpected, STATUS_COLORS.failed],
    [stats.flaky, STATUS_COLORS.flaky],
    [skipped, STATUS_COLORS.skipped],
  ];

  return (
    <div
      className={`flex w-full gap-px overflow-hidden rounded-full bg-default-100 ${className ?? ''}`}
      style={{ height }}
    >
      {segments.map(([n, color], i) =>
        n > 0 ? <div key={i} style={{ width: `${(n / total) * 100}%`, backgroundColor: color }} /> : null,
      )}
    </div>
  );
};
