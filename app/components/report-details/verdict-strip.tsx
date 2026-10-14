'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { StatBar } from '@/app/components/ui/stat-bar';
import { Sparkline } from '@/app/components/ui/sparkline';
import { type ReportHistory } from '@/app/lib/storage';
import { ReportTestOutcome } from '@/app/lib/parser';
import { getReportMetaChips } from '@/app/lib/transformers';
import { STATUS_COLORS, passRateTint } from '@/app/lib/tailwind';
import FormattedDate from '@/app/components/date-format';

// Multi-select: empty set == "All" (no filter). Serialized to the URL as
// short comma-joined tokens, e.g. ?status=failed,flaky.
export type StatusFilter = ReportTestOutcome;

export const STATUS_FILTER_TOKENS: Record<StatusFilter, string> = {
  [ReportTestOutcome.Unexpected]: 'failed',
  [ReportTestOutcome.Flaky]: 'flaky',
  [ReportTestOutcome.Expected]: 'passed',
  [ReportTestOutcome.Skipped]: 'skipped',
};

const TOKEN_TO_FILTER: Record<string, StatusFilter> = Object.fromEntries(
  Object.entries(STATUS_FILTER_TOKENS).map(([outcome, token]) => [token, outcome as StatusFilter]),
);

export const parseStatusFilters = (value?: string | null): StatusFilter[] =>
  (value ?? '')
    .split(',')
    .map((token) => TOKEN_TO_FILTER[token.trim()])
    .filter((v): v is StatusFilter => !!v);

export const serializeStatusFilters = (filters: StatusFilter[]): string | undefined =>
  filters.length ? filters.map((f) => STATUS_FILTER_TOKENS[f]).join(',') : undefined;

const STATUS_CHIPS: { key: StatusFilter; labelKey: 'failed' | 'flaky' | 'passed' | 'skipped'; dot: string }[] = [
  { key: ReportTestOutcome.Unexpected, labelKey: 'failed', dot: STATUS_COLORS.failed },
  { key: ReportTestOutcome.Flaky, labelKey: 'flaky', dot: STATUS_COLORS.flaky },
  { key: ReportTestOutcome.Expected, labelKey: 'passed', dot: STATUS_COLORS.passed },
  { key: ReportTestOutcome.Skipped, labelKey: 'skipped', dot: STATUS_COLORS.skipped },
];

const formatDuration = (ms?: number) => (ms ? `${(ms / 1000).toFixed(1)}s` : '—');

interface VerdictStripProps {
  report: ReportHistory;
  // Last N reports for this project, newest first (from /api/report/trend).
  history: ReportHistory[];
  statusFilter: StatusFilter[];
  onStatusFilterChange: (filter: StatusFilter[]) => void;
}

export function VerdictStrip({ report, history, statusFilter, onStatusFilterChange }: Readonly<VerdictStripProps>) {
  const t = useTranslations('report');
  const ts = useTranslations('status');
  const { stats } = report;
  const metaChips = getReportMetaChips(report);

  const passRate = stats.total > 0 ? Math.round((stats.expected / stats.total) * 100) : 0;

  // history is newest-first; the run right after the current one in that
  // order is the "previous" run for the delta badge.
  const currentIndex = history.findIndex((h) => h.reportID === report.reportID);
  const previous = history[currentIndex >= 0 ? currentIndex + 1 : 1];
  const previousRate =
    previous && previous.stats.total > 0 ? Math.round((previous.stats.expected / previous.stats.total) * 100) : null;
  const delta = previousRate === null ? null : passRate - previousRate;

  const sparkValues = [...history]
    .reverse()
    .map((h) => (h.stats.total > 0 ? Math.round((h.stats.expected / h.stats.total) * 100) : 0));

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-3">
      <div className="flex flex-col gap-3 rounded-xl border border-divider bg-content1 p-3.5 px-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span
            className="font-mono text-[26px] font-semibold tracking-[-0.02em] tabular-nums"
            style={{ color: stats.unexpected > 0 ? STATUS_COLORS.failed : undefined }}
          >
            {stats.unexpected > 0 ? t('verdict.failed', { count: stats.unexpected }) : t('verdict.allPassed')}
          </span>
          <span className="text-[13px] text-default-500">
            {stats.flaky > 0 && t('verdict.flaky', { count: stats.flaky })}
            {t('verdict.passed', { count: stats.expected })}
            {stats.skipped > 0 && t('verdict.skipped', { count: stats.skipped })}
          </span>
          <span className="ml-auto font-mono text-xs text-default-500 tabular-nums">
            {t('verdict.tests', { count: stats.total })} · {formatDuration(report.duration)} ·{' '}
            <FormattedDate date={report.createdAt} />
          </span>
        </div>

        <StatBar height={8} stats={stats} />

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            className={`inline-flex h-[26px] items-center rounded-lg border px-2.5 text-xs transition-colors ${
              statusFilter.length === 0
                ? 'border-primary/40 bg-primary/10 text-primary font-medium'
                : 'border-default-200 bg-default-100 text-default-600'
            }`}
            type="button"
            onClick={() => onStatusFilterChange([])}
          >
            {ts('all')}
          </button>
          {STATUS_CHIPS.map((chip) => {
            const active = statusFilter.includes(chip.key);

            return (
              <button
                key={chip.key}
                className={`inline-flex h-[26px] items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors ${
                  active
                    ? 'border-primary/40 bg-primary/10 text-primary font-medium'
                    : 'border-default-200 bg-default-100 text-default-600'
                }`}
                type="button"
                onClick={() =>
                  onStatusFilterChange(
                    active ? statusFilter.filter((f) => f !== chip.key) : [...statusFilter, chip.key],
                  )
                }
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: chip.dot }} />
                {ts(chip.labelKey)}
              </button>
            );
          })}
          {metaChips.length > 0 && (
            <>
              <span className="h-4 w-px bg-divider" />
              {metaChips.map((chip) => (
                <span
                  key={chip.key}
                  className="rounded-md bg-default-100 px-1.5 py-0.5 font-mono text-[11px] text-default-600"
                >
                  {chip.label}
                </span>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-divider bg-content1 p-3.5 px-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[.1em] text-default-400">
            {t('verdict.passRateLast', { count: history.length || 1 })}
          </span>
          {delta !== null && Math.abs(delta) >= 0.1 && (
            <span
              className="rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold"
              style={
                delta >= 0
                  ? { color: STATUS_COLORS.passed, backgroundColor: passRateTint(100) }
                  : { color: STATUS_COLORS.failed, backgroundColor: passRateTint(0) }
              }
            >
              {delta >= 0 ? '+' : ''}
              {delta.toFixed(1)} pt
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-[30px] font-semibold">{passRate}</span>
          <span className="text-sm text-default-500">{t('verdict.percentPassed')}</span>
        </div>
        {sparkValues.length > 1 && (
          <Sparkline
            color={STATUS_COLORS.passed}
            height={60}
            lastColor={stats.unexpected > 0 ? STATUS_COLORS.failed : STATUS_COLORS.passed}
            values={sparkValues}
            width={268}
          />
        )}
        {report.project && (
          <Link
            className="mt-auto text-xs text-primary hover:underline"
            href={`/trends?project=${encodeURIComponent(report.project)}`}
          >
            {t('verdict.compare')}
          </Link>
        )}
      </div>
    </div>
  );
}
