'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData } from '@tanstack/react-query';
import { Area, AreaChart, XAxis, YAxis } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { defaultProjectName } from '../lib/constants';
import { withBase } from '../lib/url';

import ProjectSelect from './project-select';

import { TrendChart } from '@/app/components/trend-chart';
import { useDateLabels } from '@/app/components/date-format';
import { PageHeader } from '@/app/components/page-header';
import { Segmented } from '@/app/components/ui/segmented';
import { TrendsSkeleton } from '@/app/components/ui/skeletons';
import { EmptyState } from '@/app/components/ui/empty-state';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/app/components/ui/chart';
import useQuery from '@/app/hooks/useQuery';
import { type ReportHistory } from '@/app/lib/storage';
import { withQueryParams } from '@/app/lib/network';

type WindowSize = '15' | '30' | '60';
const WINDOW_OPTIONS: { key: WindowSize; label: string }[] = [
  { key: '15', label: '15' },
  { key: '30', label: '30' },
  { key: '60', label: '60' },
];

// Known failure categories have translated labels; unknown ones show as-is.
const CATEGORY_KEYS = ['network', 'assertion', 'element', 'timeout', 'navigation', 'other'] as const;

type CategoryKey = (typeof CATEGORY_KEYS)[number];
const isCategoryKey = (c: string): c is CategoryKey => (CATEGORY_KEYS as readonly string[]).includes(c);

const useCategoryLabel = () => {
  const t = useTranslations('trends.categories');

  return (category: string) => (isCategoryKey(category) ? t(category) : category);
};

const CATEGORY_COLORS: Record<string, string> = {
  network: 'bg-purple-500',
  assertion: 'bg-blue-500',
  element: 'bg-amber-500',
  timeout: 'bg-red-500',
  navigation: 'bg-teal-500',
  other: 'bg-gray-400',
};

interface FailuresResponse {
  enabled: boolean;
  analyzedReports: number;
  categories: Record<string, number>;
  topFailures: Array<{
    title: string;
    location: string;
    count: number;
    lastReportId: string;
    category: string;
  }>;
}

interface WindowAggregate {
  runs: number;
  passRate: number;
  flakyTotal: number;
  failedTotal: number;
  avgDurationMs: number;
}

const aggregate = (reports: ReportHistory[]): WindowAggregate => {
  let executed = 0;
  let passed = 0;
  let flaky = 0;
  let failed = 0;
  let durationSum = 0;
  let durationCount = 0;

  for (const r of reports) {
    const s = r.stats;

    if (!s) continue;
    passed += s.expected;
    flaky += s.flaky;
    failed += s.unexpected;
    executed += s.expected + s.unexpected + s.flaky;
    if (typeof r.duration === 'number' && r.duration > 0) {
      durationSum += r.duration;
      durationCount += 1;
    }
  }

  return {
    runs: reports.length,
    passRate: executed > 0 ? (passed / executed) * 100 : 0,
    flakyTotal: flaky,
    failedTotal: failed,
    avgDurationMs: durationCount > 0 ? durationSum / durationCount : 0,
  };
};

const formatDuration = (
  ms: number,
  units: { minSec: (min: number, sec: number) => string; sec: (sec: number) => string },
): string => {
  if (!ms) return '—';
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;

  return min > 0 ? units.minSec(min, sec) : units.sec(sec);
};

// Delta arrow vs the previous window. `goodWhenUp` flips the coloring:
// pass rate rising is good (green), flaky count rising is bad (red).
const Delta: React.FC<{ current: number; previous: number; goodWhenUp: boolean; suffix?: string }> = ({
  current,
  previous,
  goodWhenUp,
  suffix = '%',
}) => {
  if (!previous) return null;
  const diff = current - previous;
  const percent = Math.abs((diff / previous) * 100);

  if (percent < 1) return <span className="font-mono text-[11px] text-default-400">≈</span>;
  const up = diff > 0;
  const good = up === goodWhenUp;

  return (
    <span className={`font-mono text-[11px] font-medium ${good ? 'text-success' : 'text-danger'}`}>
      {up ? '↑' : '↓'} {suffix === '%' ? `${Math.abs(diff).toFixed(1)}%` : `${percent.toFixed(0)}%`}
    </span>
  );
};

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`rounded-lg border border-divider bg-content1 p-4 ${className ?? ''}`}>{children}</div>
);

const StatCard: React.FC<{ label: string; value: string; delta?: React.ReactNode }> = ({ label, value, delta }) => (
  <Card>
    <p className="text-[11px] uppercase tracking-[.08em] text-default-400">{label}</p>
    <div className="flex items-baseline gap-2 mt-1">
      <p className="font-mono text-2xl font-semibold">{value}</p>
      {delta}
    </div>
  </Card>
);

// Same status hues as the logo and the pass-rate chart, so a red cell here is
// the same red as a failing point there.
const HEALTH_CLASSES = {
  good: 'bg-[#639922] dark:bg-[#97C459]',
  warn: 'bg-[#BA7517] dark:bg-[#EF9F27]',
  bad: 'bg-[#E24B4A] dark:bg-[#ef4444]',
  none: 'bg-default-300',
} as const;

const healthLevel = (r: ReportHistory): keyof typeof HEALTH_CLASSES => {
  const s = r.stats;

  if (!s) return 'none';
  const executed = s.expected + s.unexpected + s.flaky;

  if (executed === 0) return 'none';
  const rate = s.expected / executed;

  if (rate >= 0.99) return 'good';
  if (rate >= 0.9) return 'warn';

  return 'bad';
};

const HealthLegend: React.FC = () => (
  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-default-500">
    {(
      [
        ['good', '≥ 99%'],
        ['warn', '90–99%'],
        ['bad', '< 90%'],
      ] as const
    ).map(([level, label]) => (
      <span key={level} className="flex items-center gap-1.5">
        <span className={`inline-block h-2 w-2 rounded-[2px] ${HEALTH_CLASSES[level]}`} />
        {label}
      </span>
    ))}
  </div>
);

// Pill for the newest run — states the "right now" answer in words, so it
// doesn't rely on colour alone.
const LAST_RUN = {
  good: {
    className: 'bg-[#639922]/10 text-[#3B6D11] dark:bg-[#97C459]/15 dark:text-[#97C459]',
  },
  warn: {
    className: 'bg-[#BA7517]/10 text-[#854F0B] dark:bg-[#EF9F27]/15 dark:text-[#EF9F27]',
  },
  bad: {
    className: 'bg-[#E24B4A]/10 text-[#A32D2D] dark:bg-[#ef4444]/15 dark:text-[#F09595]',
  },
  none: { className: 'bg-default-100 text-default-500' },
} as const;

// Status-page style: headline share of healthy runs + the newest run's state
// on the left, one pill per run (oldest → newest) filling the rest.
const RunHealth: React.FC<{ reports: ReportHistory[] }> = ({ reports }) => {
  const t = useTranslations('trends.health');
  const { intl } = useDateLabels();
  const levels = reports.map(healthLevel);
  const scored = levels.filter((l) => l !== 'none');
  const healthy = scored.filter((l) => l === 'good').length;
  const share = scored.length ? Math.round((healthy / scored.length) * 100) : null;
  const lastLevel = levels[0] ?? 'none';
  const last = LAST_RUN[lastLevel];

  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
      <div className="min-w-[150px]">
        <p className="text-[11px] uppercase tracking-[.08em] text-default-400 mb-1.5">{t('title')}</p>
        <p className="font-mono text-[32px] font-semibold leading-none tabular-nums">
          {share === null ? '—' : `${share}%`}
        </p>
        <p className="text-[11px] text-default-400 mt-1">{t('healthyOf', { healthy, total: scored.length })}</p>
        <span
          className={`inline-flex items-center gap-1.5 mt-2.5 rounded-full px-2 py-0.5 text-[12px] font-semibold ${last.className}`}
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
          {t(`lastRun.${lastLevel}`)}
        </span>
      </div>

      <div className="flex-1 min-w-[260px]">
        <div className="flex gap-[3px]">
          {[...reports].reverse().map((r) => (
            <Link
              key={r.reportID}
              className="flex-1 min-w-[4px]"
              href={withBase(`/report/${r.reportID}`)}
              prefetch={false}
            >
              <span
                className={`block h-10 rounded-full ${HEALTH_CLASSES[healthLevel(r)]} transition-opacity hover:opacity-70`}
                title={t('runTitle', {
                  title: r.title || r.reportID,
                  date: new Date(r.createdAt).toLocaleString(intl),
                  passed: r.stats?.expected ?? 0,
                  failed: r.stats?.unexpected ?? 0,
                  flaky: r.stats?.flaky ?? 0,
                })}
              />
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-[11px] text-default-400">
          <span>{t('runsAgo', { count: reports.length })}</span>
          <HealthLegend />
          <span>{t('now')}</span>
        </div>
      </div>
    </div>
  );
};

const SPARK_COLORS = {
  duration: 'hsl(var(--chart-1))',
  failed: 'hsl(var(--chart-2))',
  flaky: 'hsl(var(--chart-4))',
} as const;

const Sparkline: React.FC<{ kind: keyof typeof SPARK_COLORS; data: Array<{ date: string; value: number }> }> = ({
  kind,
  data,
}) => {
  const t = useTranslations('trends.spark');
  const config: ChartConfig = { value: { label: t(kind), color: SPARK_COLORS[kind] } };

  return (
    <Card>
      <p className="text-[11px] uppercase tracking-[.08em] text-default-400 mb-1">{t(kind)}</p>
      <ChartContainer className="h-[80px] w-full" config={config}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <XAxis hide dataKey="date" />
          <YAxis hide domain={[0, 'auto']} />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Area
            dataKey="value"
            fill="var(--color-value)"
            fillOpacity={0.2}
            stroke="var(--color-value)"
            type="monotone"
          />
        </AreaChart>
      </ChartContainer>
    </Card>
  );
};

const FailureCategories: React.FC<{ categories: Record<string, number> }> = ({ categories }) => {
  const t = useTranslations('trends');
  const categoryLabel = useCategoryLabel();
  const entries = Object.entries(categories).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);

  if (!total) return <p className="text-[12.5px] text-default-400">{t('noFailures')}</p>;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex w-full h-2.5 rounded-full overflow-hidden">
        {entries.map(([category, count]) => (
          <div
            key={category}
            className={CATEGORY_COLORS[category] ?? 'bg-gray-400'}
            style={{ width: `${(count / total) * 100}%` }}
            title={`${categoryLabel(category)}: ${count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {entries.map(([category, count]) => (
          <span key={category} className="flex items-center gap-1.5 text-[12px] text-default-500">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${CATEGORY_COLORS[category] ?? 'bg-gray-400'}`} />
            {categoryLabel(category)} — {count} ({((count / total) * 100).toFixed(0)}%)
          </span>
        ))}
      </div>
    </div>
  );
};

const TopFailures: React.FC<{ failures: FailuresResponse['topFailures'] }> = ({ failures }) => {
  const t = useTranslations('trends');

  if (!failures.length) return <p className="text-[12.5px] text-default-400">{t('noFailures')}</p>;

  return (
    <div className="flex flex-col">
      {failures.map((f) => (
        <Link
          key={`${f.location}-${f.title}`}
          className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 border-b border-divider last:border-0 hover:bg-default-50"
          href={withBase(`/report/${f.lastReportId}`)}
          prefetch={false}
        >
          <div className="min-w-0">
            <p className="text-[12.5px] truncate">{f.title}</p>
            <p className="text-[11px] text-default-400 truncate">{f.location}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${CATEGORY_COLORS[f.category] ?? 'bg-gray-400'}`} />
            <span className="font-mono text-[12px] font-semibold">{f.count}×</span>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default function ReportAnalytics() {
  const t = useTranslations('trends');
  const router = useRouter();
  const { intl } = useDateLabels();
  const searchParams = useSearchParams();

  const [project, setProject] = useState(searchParams?.get('project') ?? defaultProjectName);
  const [windowSize, setWindowSize] = useState<WindowSize>(() => {
    const fromUrl = searchParams?.get('runs');

    return fromUrl === '15' || fromUrl === '30' || fromUrl === '60' ? fromUrl : '30';
  });

  const syncUrl = useCallback(
    (nextProject: string, nextWindow: WindowSize) => {
      const params = new URLSearchParams();

      if (nextProject && nextProject !== defaultProjectName) params.set('project', nextProject);
      if (nextWindow !== '30') params.set('runs', nextWindow);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  const {
    data: reports,
    isFetching,
    isPending,
  } = useQuery<ReportHistory[]>(
    withQueryParams('/api/report/trend', { project, limit: String(Number(windowSize) * 2) }),
    {
      dependencies: [project, windowSize],
      // Keep the previous window/project on screen while the next one loads,
      // so switching 15/30/60 dims the page instead of blanking it.
      placeholderData: keepPreviousData,
    },
  );

  const { data: failuresData } = useQuery<FailuresResponse>(
    withQueryParams('/api/report/failures', { project, limit: windowSize }),
    { dependencies: [project, windowSize] },
  );

  const onProjectChange = useCallback(
    (next: string) => {
      setProject(next);
      syncUrl(next, windowSize);
    },
    [syncUrl, windowSize],
  );

  const onWindowChange = useCallback(
    (next: WindowSize) => {
      setWindowSize(next);
      syncUrl(project, next);
    },
    [syncUrl, project],
  );

  // Reports come newest-first; current window is the head, previous window the tail.
  const { current, currentAgg, previousAgg, sparkData } = useMemo(() => {
    const list = reports ?? [];
    const size = Number(windowSize);
    const cur = list.slice(0, size);
    const prev = list.slice(size, size * 2);
    const chronological = [...cur].reverse();

    return {
      current: cur,
      currentAgg: aggregate(cur),
      previousAgg: aggregate(prev),
      sparkData: {
        duration: chronological.map((r) => ({
          date: new Date(r.createdAt).toLocaleDateString(intl),
          value: Math.round(((r.duration ?? 0) / 60000) * 10) / 10,
        })),
        failed: chronological.map((r) => ({
          date: new Date(r.createdAt).toLocaleDateString(intl),
          value: r.stats?.unexpected ?? 0,
        })),
        flaky: chronological.map((r) => ({
          date: new Date(r.createdAt).toLocaleDateString(intl),
          value: r.stats?.flaky ?? 0,
        })),
      },
    };
  }, [reports, windowSize, intl]);

  return (
    <div className="flex flex-col rr-enter">
      <PageHeader
        actions={
          <>
            <Segmented options={WINDOW_OPTIONS} value={windowSize} onChange={onWindowChange} />
            <ProjectSelect entity="report" value={project} onSelect={onProjectChange} />
          </>
        }
        subtitle={failuresData ? t('analyzed', { count: failuresData.analyzedReports }) : undefined}
        title={t('title')}
      />

      <div className={`flex flex-col gap-4 p-5 transition-opacity ${isFetching && !isPending ? 'opacity-60' : ''}`}>
        {isPending && <TrendsSkeleton />}

        {!isPending && !current.length && (
          <EmptyState description={t('empty.description')} icon={TrendingUp} title={t('empty.title')} />
        )}

        {!!current.length && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                delta={<Delta goodWhenUp current={currentAgg.passRate} previous={previousAgg.passRate} />}
                label={t('stats.passRate')}
                value={`${currentAgg.passRate.toFixed(1)}%`}
              />
              <StatCard
                delta={
                  <Delta
                    current={currentAgg.failedTotal}
                    goodWhenUp={false}
                    previous={previousAgg.failedTotal}
                    suffix=""
                  />
                }
                label={t('stats.failedTests')}
                value={String(currentAgg.failedTotal)}
              />
              <StatCard
                delta={
                  <Delta
                    current={currentAgg.flakyTotal}
                    goodWhenUp={false}
                    previous={previousAgg.flakyTotal}
                    suffix=""
                  />
                }
                label={t('stats.flakyTests')}
                value={String(currentAgg.flakyTotal)}
              />
              <StatCard
                delta={
                  <Delta
                    current={currentAgg.avgDurationMs}
                    goodWhenUp={false}
                    previous={previousAgg.avgDurationMs}
                    suffix=""
                  />
                }
                label={t('stats.avgDuration')}
                value={formatDuration(currentAgg.avgDurationMs, {
                  minSec: (min, sec) => t('duration.minSec', { min, sec }),
                  sec: (sec) => t('duration.sec', { sec }),
                })}
              />
            </div>

            <Card>
              <RunHealth reports={current} />
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Sparkline data={sparkData.duration} kind="duration" />
              <Sparkline data={sparkData.failed} kind="failed" />
              <Sparkline data={sparkData.flaky} kind="flaky" />
            </div>

            {failuresData?.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Card>
                  <p className="text-[11px] uppercase tracking-[.08em] text-default-400 mb-2">
                    {t('categories.title', { count: failuresData.analyzedReports })}
                  </p>
                  <FailureCategories categories={failuresData.categories} />
                </Card>
                <Card>
                  <p className="text-[11px] uppercase tracking-[.08em] text-default-400 mb-2">{t('topFailures')}</p>
                  <TopFailures failures={failuresData.topFailures} />
                </Card>
              </div>
            )}

            <TrendChart reportHistory={current} />
          </>
        )}
      </div>
    </div>
  );
}
