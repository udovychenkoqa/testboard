'use client';

import type { RunSummary } from '@/app/lib/tm/runs';

import NextLink from 'next/link';
import { useTranslations } from 'next-intl';

import FormattedDate from '@/app/components/date-format';
import { RunProgress } from '@/app/components/tm/result';

export const RunList: React.FC<{ runs: RunSummary[] }> = ({ runs }) => {
  const t = useTranslations('tm.runs');

  return (
    <ul className="flex flex-col divide-y divide-divider rounded-lg border border-divider bg-content1">
      {runs.map((run) => (
        <li key={run.id}>
          <NextLink
            className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-default-50 md:flex-row md:items-center md:gap-6"
            href={`/runs/manual/${run.id}`}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13.5px] font-medium">{run.name}</span>
                <span
                  className={`shrink-0 rounded-md px-1.5 py-px text-[11px] font-medium ${
                    run.status === 'completed' ? 'bg-default-100 text-default-500' : 'bg-primary/10 text-primary'
                  }`}
                >
                  {t(`status.${run.status}`)}
                </span>
              </div>
              <span className="text-[11.5px] text-default-400">
                {t('cases', { count: run.total })} · <FormattedDate relativeDay date={new Date(run.createdAt)} /> ·{' '}
                {t('createdBy', { who: run.createdBy })}
              </span>
            </div>
            <RunProgress className="w-full md:w-64" counts={run.counts} total={run.total} />
          </NextLink>
        </li>
      ))}
    </ul>
  );
};
