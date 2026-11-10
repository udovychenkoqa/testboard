'use client';

import type { AutomationStats } from '@/app/lib/tm/projects';

import { useTranslations } from 'next-intl';

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

// One row of the project card: label and ratio, then a full-width bar of automated (solid) and planned (light).
export const AutomationBar: React.FC<{ label: string; stats: AutomationStats }> = ({ label, stats }) => {
  const t = useTranslations('tm.projects');
  const { caseCount, automatedCount, toAutomateCount } = stats;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="truncate text-default-500">{label}</span>
        <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-default-500">
          <span className="text-primary">{pct(automatedCount, caseCount)}%</span> · {automatedCount}/{caseCount}
        </span>
      </div>
      <div
        aria-label={t('automated', { percent: pct(automatedCount, caseCount) })}
        className="flex h-1.5 overflow-hidden rounded-full bg-default-200"
        role="img"
        title={t('barTitle', { automated: automatedCount, planned: toAutomateCount, total: caseCount })}
      >
        <div className="bg-primary" style={{ width: `${pct(automatedCount, caseCount)}%` }} />
        <div className="bg-primary/30" style={{ width: `${pct(toAutomateCount, caseCount)}%` }} />
      </div>
    </div>
  );
};
