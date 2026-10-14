'use client';
import { CartesianGrid, Line, LineChart, XAxis, YAxis, type TooltipProps } from 'recharts';
import { useTranslations } from 'next-intl';

import { type ReportHistory } from '@/app/lib/storage';
import { withBase } from '@/app/lib/url';
import { type ChartConfig, ChartContainer, ChartTooltip } from '@/app/components/ui/chart';
import { useDateLabels } from '@/app/components/date-format';
import { dayKey } from '@/i18n/dates';

// One series — pass rate per run — in the app's indigo accent. Runs with
// failures get a red point; flaky-only runs get a hollow ring, so the two
// states differ by shape as well as colour (red/amber collapse under CVD).
// Both pairs validated (light #4f46e5/#E24B4A, dark #6366f1/#ef4444).
const chartConfig = {
  // Colours only — labels come from the custom tooltip/legend (translated).
  rate: { theme: { light: '#4f46e5', dark: '#6366f1' } },
  failed: { theme: { light: '#E24B4A', dark: '#ef4444' } },
} satisfies ChartConfig;

interface Point {
  idx: number;
  date: number;
  // null when every test was skipped — the line breaks there instead of
  // dropping to 0%.
  rate: number | null;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  total: number;
  reportUrl: string;
}

const formatDay = (ts: number, intl: string) =>
  new Date(ts).toLocaleDateString(intl, { day: 'numeric', month: 'short' });

// Same definition as the Run health grid: flaky counts against the rate.
const toPoint = (r: ReportHistory, idx: number): Point => {
  const s = r.stats ?? { expected: 0, unexpected: 0, flaky: 0, skipped: 0, total: 0 };
  const executed = s.expected + s.unexpected + s.flaky;

  return {
    idx,
    date: new Date(r.createdAt).getTime(),
    rate: executed > 0 ? Math.round((s.expected / executed) * 1000) / 10 : null,
    passed: s.expected,
    failed: s.unexpected,
    flaky: s.flaky,
    skipped: s.skipped,
    total: s.total,
    reportUrl: withBase(`/report/${r.reportID}`),
  };
};

const RunDot: React.FC<{ cx?: number; cy?: number; payload?: Point; active?: boolean }> = ({
  cx,
  cy,
  payload,
  active,
}) => {
  if (cx === undefined || cy === undefined || !payload || payload.rate === null) return null;
  const r = active ? 6 : 4;

  if (payload.failed > 0) {
    return <circle className="stroke-content1" cx={cx} cy={cy} fill="var(--color-failed)" r={r} strokeWidth={2} />;
  }
  if (payload.flaky > 0) {
    return <circle className="fill-content1" cx={cx} cy={cy} r={r} stroke="var(--color-rate)" strokeWidth={2} />;
  }

  return <circle className="stroke-content1" cx={cx} cy={cy} fill="var(--color-rate)" r={r} strokeWidth={2} />;
};

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-default-500">{label}</span>
    <span className="font-mono tabular-nums">{value}</span>
  </div>
);

const RunTooltip: React.FC<TooltipProps<number, string>> = ({ active, payload }) => {
  const p = payload?.[0]?.payload as Point | undefined;
  const { intl } = useDateLabels();
  const t = useTranslations('trends.chart');

  if (!active || !p) return null;

  return (
    <div className="min-w-[200px] rounded-lg border border-divider bg-content1 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-medium">{new Date(p.date).toLocaleString(intl)}</p>
      <div className="flex items-baseline justify-between gap-4 border-b border-divider pb-1.5 mb-1.5">
        <span className="text-default-500">{t('passRate')}</span>
        <span className="font-mono text-sm font-semibold tabular-nums">{p.rate === null ? '—' : `${p.rate}%`}</span>
      </div>
      <Row label={t('passed')} value={p.passed} />
      <Row label={t('failed')} value={p.failed} />
      <Row label={t('flaky')} value={p.flaky} />
      <Row label={t('skipped')} value={p.skipped} />
      <div className="mt-1.5 border-t border-divider pt-1.5">
        <Row label={t('total')} value={p.total} />
      </div>
    </div>
  );
};

const LegendItem: React.FC<{ children: React.ReactNode; label: string }> = ({ children, label }) => (
  <span className="flex items-center gap-1.5">
    <svg aria-hidden height="10" viewBox="0 0 10 10" width="10">
      {children}
    </svg>
    {label}
  </span>
);

interface TrendChartProps {
  reportHistory: ReportHistory[];
}

export function TrendChart({ reportHistory }: Readonly<TrendChartProps>) {
  const t = useTranslations('trends.chart');
  // History arrives newest-first; the chart reads left (older) to right.
  const data = [...reportHistory].reverse().map(toPoint);
  const { intl } = useDateLabels();

  // One tick per calendar day, on that day's first run — several runs a day
  // otherwise repeat the same date along the axis.
  const dayTicks = data.filter((p, i) => i === 0 || dayKey(p.date) !== dayKey(data[i - 1].date)).map((p) => p.idx);

  const openReport = (url?: string) => {
    url && typeof window !== 'undefined' && window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="rounded-lg border border-divider bg-content1 p-4">
      <p className="text-[11px] uppercase tracking-[.08em] text-default-400 mb-3">
        {t('title', { count: data.length })}
      </p>
      {data.length <= 1 ? (
        <p className="py-10 text-center text-sm text-default-400">{t('notEnough')}</p>
      ) : (
        <>
          <ChartContainer className="aspect-auto h-[240px] w-full" config={chartConfig}>
            <LineChart
              accessibilityLayer
              data={data}
              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
              onClick={(e) => openReport((e?.activePayload?.[0]?.payload as Point | undefined)?.reportUrl)}
            >
              <CartesianGrid className="stroke-divider" vertical={false} />
              <YAxis
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tickLine={false}
                ticks={[0, 50, 100]}
                width={40}
              />
              <XAxis
                axisLine={false}
                dataKey="idx"
                domain={[0, data.length - 1]}
                padding={{ left: 8, right: 8 }}
                tickFormatter={(i: number) => formatDay(data[i]?.date ?? 0, intl)}
                tickLine={false}
                tickMargin={8}
                ticks={dayTicks}
                type="number"
              />
              <ChartTooltip content={<RunTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <Line
                activeDot={<RunDot active />}
                className="cursor-pointer"
                connectNulls={false}
                dataKey="rate"
                dot={<RunDot />}
                isAnimationActive={false}
                stroke="var(--color-rate)"
                strokeWidth={2}
                type="linear"
              />
            </LineChart>
          </ChartContainer>
          <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-default-500">
            {/* Outside ChartContainer, so --color-* vars aren't in scope here. */}
            <LegendItem label={t('passRate')}>
              <circle className="fill-[#4f46e5] dark:fill-[#6366f1]" cx="5" cy="5" r="4" />
            </LegendItem>
            <LegendItem label={t('hasFlaky')}>
              <circle
                className="fill-content1 stroke-[#4f46e5] dark:stroke-[#6366f1]"
                cx="5"
                cy="5"
                r="3.5"
                strokeWidth="1.5"
              />
            </LegendItem>
            <LegendItem label={t('hasFailures')}>
              <circle className="fill-[#E24B4A] dark:fill-[#ef4444]" cx="5" cy="5" r="4" />
            </LegendItem>
          </div>
        </>
      )}
    </div>
  );
}
