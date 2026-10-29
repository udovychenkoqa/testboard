'use client';

import type { Result } from '@/app/lib/tm/constants';

import { useTranslations } from 'next-intl';

// One colour per run result, shared by badges, buttons and the progress bar.
export const RESULT_COLORS: Record<Result, { bar: string; badge: string }> = {
  passed: { bar: 'bg-success', badge: 'bg-success/10 text-success' },
  failed: { bar: 'bg-danger', badge: 'bg-danger/10 text-danger' },
  blocked: { bar: 'bg-warning', badge: 'bg-warning/10 text-warning-600' },
  skipped: { bar: 'bg-default-400', badge: 'bg-default-100 text-default-500' },
  untested: { bar: 'bg-default-200', badge: 'bg-default-100 text-default-400' },
};

const BAR_ORDER: Result[] = ['passed', 'failed', 'blocked', 'skipped'];

export const ResultBadge: React.FC<{ value: Result }> = ({ value }) => {
  const t = useTranslations('tm.runs.result');

  return (
    <span className={`whitespace-nowrap rounded-md px-1.5 py-px text-[11px] font-medium ${RESULT_COLORS[value].badge}`}>
      {t(value)}
    </span>
  );
};

// Stacked bar of finished results over the run total; the rest is untested.
export const RunProgress: React.FC<{ total: number; counts: Record<Result, number>; className?: string }> = ({
  total,
  counts,
  className = '',
}) => {
  const t = useTranslations('tm.runs');
  const done = total - counts.untested;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-default-100">
        {total > 0 &&
          BAR_ORDER.map((r) =>
            counts[r] ? (
              <span
                key={r}
                className={RESULT_COLORS[r].bar}
                style={{ width: `${(counts[r] / total) * 100}%` }}
                title={`${t(`result.${r}`)}: ${counts[r]}`}
              />
            ) : null,
          )}
      </div>
      <span className="text-[11.5px] text-default-400">{t('progress', { done, total })}</span>
    </div>
  );
};
