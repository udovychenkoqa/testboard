'use client';

import type { ReadReportsHistory, ReportHistory } from '@/app/lib/storage';

import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { FileText } from 'lucide-react';

import useQuery from '@/app/hooks/useQuery';
import { useDateLabels } from '@/app/components/date-format';
import { EmptyState } from '@/app/components/ui/empty-state';
import { GridSkeleton } from '@/app/components/ui/skeletons';
import { formatAgo } from '@/i18n/dates';

const LIMIT = 10;

// Reports carry the uploader's resultDetails as extra fields (the autotests send `env`; older CI sent
// `environment`).
const envOf = (report: ReportHistory): string | undefined => {
  const extra = report as ReportHistory & Record<string, unknown>;
  const value = extra.env ?? extra.environment;

  return typeof value === 'string' && value ? value : undefined;
};

const dotClass = (report: ReportHistory) =>
  report.stats.unexpected > 0 ? 'bg-danger' : report.stats.flaky > 0 ? 'bg-warning' : 'bg-success';

const formatDuration = (ms: number): string => {
  const seconds = Math.round(ms / 1000);

  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

// Autotest runs as they arrived in Testboard (one report per run). Works without any CI integration, so the
// Automated tab has real content even before GitLab is connected.
export const ReportRuns: React.FC = () => {
  const t = useTranslations('runTests.fromReports');
  const { intl, ago } = useDateLabels();
  const { data, isPending } = useQuery<ReadReportsHistory>(`/api/report/list?limit=${LIMIT}&offset=0`);
  const reports = data?.reports ?? [];

  return (
    <div className="rounded-lg border border-divider bg-content1">
      <div className="flex flex-col gap-0.5 border-b border-divider px-4 py-2.5">
        <span className="text-[12.5px] font-medium">{t('title')}</span>
        <span className="text-[11.5px] text-default-400">{t('hint')}</span>
      </div>

      {isPending ? (
        <GridSkeleton rowHeight={44} rows={5} />
      ) : reports.length === 0 ? (
        <EmptyState description={t('emptyDescription')} icon={FileText} title={t('emptyTitle')} />
      ) : (
        <ul className="flex flex-col divide-y divide-divider">
          {reports.map((report) => {
            const env = envOf(report);
            const created = new Date(report.createdAt);

            return (
              <li key={report.reportID}>
                <NextLink
                  className="flex min-h-[44px] items-center gap-3 px-4 py-2 transition-colors hover:bg-default-50"
                  href={`/report/${report.reportID}`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass(report)}`} />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{report.title || report.project}</span>
                  {env && (
                    <span className="shrink-0 rounded-md bg-default-100 px-1.5 py-0.5 font-mono text-[10.5px] text-default-600">
                      {env}
                    </span>
                  )}
                  <span className="hidden shrink-0 text-[11.5px] tabular-nums text-default-500 sm:inline">
                    {t('counts', {
                      passed: report.stats.expected,
                      failed: report.stats.unexpected,
                      flaky: report.stats.flaky,
                    })}
                  </span>
                  <span className="hidden w-16 shrink-0 text-right font-mono text-[11.5px] text-default-500 md:inline">
                    {formatDuration(report.duration)}
                  </span>
                  <span
                    className="w-24 shrink-0 truncate text-right text-[11.5px] text-default-500"
                    title={created.toLocaleString(intl)}
                  >
                    {formatAgo(created, ago, new Date())}
                  </span>
                </NextLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
