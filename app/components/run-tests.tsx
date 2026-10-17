'use client';

import { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Input, Link, Pagination, Select, SelectItem, Spinner, Switch } from '@heroui/react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { ChevronDown, Play, RotateCw, CirclePlay, SearchX, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';

import useQuery from '@/app/hooks/useQuery';
import useMutation from '@/app/hooks/useMutation';
import { STATUS_COLORS } from '@/app/lib/tailwind';
import { PageHeader } from '@/app/components/page-header';
import { Segmented } from '@/app/components/ui/segmented';
import { FilterChip } from '@/app/components/ui/filter-chip';
import { DataGrid, GridRow, type GridColumn } from '@/app/components/ui/data-grid';
import { GridSkeleton } from '@/app/components/ui/skeletons';
import { EmptyState } from '@/app/components/ui/empty-state';
import { useDateLabels } from '@/app/components/date-format';
import { formatAgo } from '@/i18n/dates';

const ENVIRONMENTS = ['test', 'dev', 'ft1', 'ft2', 'ft3', 'ft4', 'ft5', 'prod'];
const TAG_PRESETS = ['@smoke', '@api'];
// Country/locale codes = the autotests' proxy countryCodes (config/proxies.ts).
// value is passed as LOCALE; '' = per-device default (no override).
// Region codes render via Intl.DisplayNames in the UI language; US states
// aren't regions there, so they have their own message keys.
const COUNTRIES = [
  '',
  'US-CA',
  'US-NV',
  'GB',
  'FR',
  'DE',
  'IT',
  'ES',
  'JP',
  'PT',
  'CY',
  'UA',
  'NL',
  'CH',
  'SE',
  'NO',
  'DK',
  'BR',
  'MX',
  'CL',
  'AR',
  'CR',
];
const DEFAULTS = { environment: 'test', funnel: 'Hw1Vs5W', tag: '@smoke', abTest: '', abVariation: '', locale: '' };
const PREFS_KEY = 'run-tests-prefs';

interface BuildItem {
  number: number;
  status: string;
  event: string;
  message?: string;
  sender?: string;
  startedBy?: string;
  viaCi?: boolean;
  environment?: string;
  funnel?: string;
  tag?: string;
  abTest?: string;
  abVariation?: string;
  locale?: string;
  created: number;
  started: number;
  finished: number;
  link: string;
}

interface BuildsResponse {
  enabled: boolean;
  builds: BuildItem[];
  total?: number;
  perPage?: number;
  error?: string;
}

interface TriggerResponse {
  build: BuildItem;
  link: string;
}

type StatusFilter = 'all' | 'running' | 'failure' | 'success';
const STATUS_FILTERS: StatusFilter[] = ['all', 'running', 'failure', 'success'];

const HISTORY_TEMPLATE = '80px 110px minmax(0,1fr) 190px 100px 80px 90px';

const statusColor = (status: string): 'success' | 'danger' | 'warning' | 'default' => {
  if (status === 'success') return 'success';
  if (status === 'failure' || status === 'error' || status === 'killed') return 'danger';
  if (status === 'running' || status === 'pending') return 'warning';

  return 'default';
};

const statusHex = (color: ReturnType<typeof statusColor>) =>
  color === 'success'
    ? STATUS_COLORS.passed
    : color === 'danger'
      ? STATUS_COLORS.failed
      : color === 'warning'
        ? STATUS_COLORS.flaky
        : undefined;

const isActive = (status: string) => status === 'running' || status === 'pending';
const hasActiveBuilds = (builds?: BuildItem[]) => !!builds?.some((b) => isActive(b.status));

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;

  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

// Params triggered via our UI arrive as ENVIRONMENT/FUNNEL/TAG. Render only
// the ones present so old/CI builds without params don't show empty chips.
const ParamChips: React.FC<{ build: BuildItem }> = ({ build }) => {
  const ab = build.abTest ? `${build.abTest}${build.abVariation ? `:${build.abVariation}` : ''}` : undefined;
  const parts = [build.environment, build.funnel, build.tag, build.locale, ab].filter(Boolean) as string[];

  if (parts.length === 0) return <span className="text-default-400">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((part, i) => (
        <span key={i} className="rounded-md bg-default-100 px-1.5 py-0.5 font-mono text-[10.5px] text-default-600">
          {part}
        </span>
      ))}
    </div>
  );
};

// Calmer than a chip for a long list: a colored dot + label, no glyph.
const StatusCell: React.FC<{ status: string }> = ({ status }) => {
  const color = statusColor(status);
  const dot =
    color === 'success'
      ? 'bg-success'
      : color === 'danger'
        ? 'bg-danger'
        : color === 'warning'
          ? 'bg-warning'
          : 'bg-default-400';

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block h-2 w-2 rounded-full ${dot} ${isActive(status) ? 'animate-pulse' : ''}`} />
      <span className="text-[12.5px] text-default-600">{status}</span>
    </div>
  );
};

const StartedBy: React.FC<{ build: BuildItem }> = ({ build }) => {
  // System/CI runs (triggered by the service token, no human) get a neutral
  // badge instead of a person avatar — the token username is only a tooltip.
  if (build.viaCi) {
    return (
      <div className="flex items-center gap-2 min-w-0" title={build.sender}>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-default-100 text-default-500">
          <Settings size={12} />
        </span>
        <span className="truncate text-[12.5px]">CI</span>
      </div>
    );
  }

  const name = build.startedBy ?? build.sender ?? '—';

  return (
    <div className="flex items-center gap-2 min-w-0">
      <Avatar className="w-5 h-5 text-tiny shrink-0" name={name} />
      <span className="truncate text-[12.5px]">{name}</span>
    </div>
  );
};

// `embedded`: rendered inside the Test Runs layout, which owns the page header.
export default function RunTests({ embedded = false }: { embedded?: boolean } = {}) {
  const t = useTranslations('runTests');
  const tc = useTranslations('common');
  const session = useSession();
  const currentUser = session.data?.user?.name ?? session.data?.user?.email ?? null;

  const [environment, setEnvironment] = useState(DEFAULTS.environment);
  const [funnel, setFunnel] = useState(DEFAULTS.funnel);
  const [tag, setTag] = useState(DEFAULTS.tag);
  const [abTest, setAbTest] = useState(DEFAULTS.abTest);
  const [abVariation, setAbVariation] = useState(DEFAULTS.abVariation);
  const [locale, setLocale] = useState(DEFAULTS.locale);
  // A/B + country are used rarely — hidden behind a toggle to keep the form clean.
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [page, setPage] = useState(1);

  // Filters (client-side over the current page).
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [envFilter, setEnvFilter] = useState<string>('all');
  const [mineOnly, setMineOnly] = useState(false);

  // Restore last-used run parameters.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');

      if (saved.environment) setEnvironment(saved.environment);
      if (saved.funnel) setFunnel(saved.funnel);
      // Tag intentionally NOT restored — always opens on the @smoke default.
      if (saved.abTest) setAbTest(saved.abTest);
      if (saved.abVariation) setAbVariation(saved.abVariation);
      if (saved.locale) setLocale(saved.locale);
      // Auto-expand the advanced block if any advanced param was last used.
      if (saved.abTest || saved.abVariation || saved.locale) setShowAdvanced(true);
    } catch {
      /* ignore malformed prefs */
    }
  }, []);

  const { data, isPending, refetch } = useQuery<BuildsResponse>(`/api/autotests/builds?page=${page}`, {
    dependencies: [page],
    refetchInterval: (query) => (page === 1 && hasActiveBuilds(query.state.data?.builds) ? 10_000 : false),
  });

  const builds = useMemo(() => data?.builds ?? [], [data]);
  const activeBuilds = useMemo(() => builds.filter((b) => isActive(b.status)), [builds]);

  // Live clock: ticks every second only while something is running, so the
  // active-run timer and relative times stay fresh without constant re-render.
  const [now, setNow] = useState(() => Date.now());
  const { intl, ago } = useDateLabels();
  const regionNames = useMemo(() => new Intl.DisplayNames([intl], { type: 'region' }), [intl]);
  const countryName = (code: string): string => {
    if (!code) return t('countryDefault');
    if (code === 'US-CA') return t('usCa');
    if (code === 'US-NV') return t('usNv');

    return regionNames.of(code) ?? code;
  };

  useEffect(() => {
    if (activeBuilds.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);

    return () => clearInterval(id);
  }, [activeBuilds.length]);

  const runWith = (params: {
    environment: string;
    funnel: string;
    tag: string;
    abTest?: string;
    abVariation?: string;
    locale?: string;
  }) => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(params));
    } catch {
      /* ignore */
    }
    trigger({ body: params });
  };

  const { mutate: trigger, isPending: isTriggering } = useMutation<TriggerResponse>('/api/autotests/trigger', {
    onSuccess: (result) => {
      setPage(1);
      toast.success(t('buildStarted', { number: result.build.number }), {
        action: { label: t('openInDrone'), onClick: () => window.open(result.link, '_blank') },
        duration: 10_000,
      });
      refetch();
    },
  });

  const [cancelling, setCancelling] = useState<number | null>(null);
  const { mutate: cancel } = useMutation('/api/autotests/cancel', {
    onSuccess: () => {
      toast.success(t('cancelled'));
      setCancelling(null);
      refetch();
    },
    onError: () => setCancelling(null),
  });

  const cancelBuild = (number: number) => {
    setCancelling(number);
    cancel({ body: { number } });
  };

  const duration = (build: BuildItem): string => {
    if (isActive(build.status) && build.started > 0) return formatDuration(Math.floor(now / 1000 - build.started));
    // Killed/errored before actually running has finished === started (0s) —
    // show a dash rather than a misleading "0s".
    if (build.finished > 0 && build.started > 0 && build.finished > build.started) {
      return formatDuration(build.finished - build.started);
    }

    return '—';
  };

  // Apply filters to the current page.
  const filtered = builds.filter((b) => {
    if (statusFilter === 'running' && !isActive(b.status)) return false;
    if (statusFilter === 'failure' && statusColor(b.status) !== 'danger') return false;
    if (statusFilter === 'success' && b.status !== 'success') return false;
    if (envFilter !== 'all' && b.environment !== envFilter) return false;
    if (mineOnly && currentUser && (b.startedBy ?? b.sender) !== currentUser) return false;

    return true;
  });

  const successCount = builds.filter((b) => b.status === 'success').length;

  // Live "what will run" summary for the footer.
  const countryLabel = locale ? countryName(locale) : null;
  const abSummary = abTest ? `${abTest}${abVariation ? `:${abVariation}` : ''}` : null;
  const summaryParts = [environment, funnel || '—', tag || '—', locale ? countryLabel : null, abSummary].filter(
    Boolean,
  ) as string[];

  const gridColumns: GridColumn[] = [
    { key: 'build', label: t('columns.build') },
    { key: 'status', label: t('columns.status') },
    { key: 'params', label: t('columns.params') },
    { key: 'startedBy', label: t('columns.startedBy') },
    { key: 'started', label: t('columns.started') },
    { key: 'duration', label: t('columns.duration'), align: 'end' },
    { key: 'actions', label: '' },
  ];

  if (data && !data.enabled) {
    return (
      <div className="flex flex-col rr-enter">
        {!embedded && <PageHeader title={t('title')} />}
        <div className="p-5">
          <EmptyState description={t('notConfiguredDescription')} icon={CirclePlay} title={t('notConfiguredTitle')} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col rr-enter">
      {!embedded && <PageHeader title={t('title')} />}

      <div className="flex flex-col gap-4 p-5">
        {/* Run parameters — one row: env / funnel / tag / run */}
        <div className="rounded-lg border border-divider bg-content1">
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-[150px_1fr_1fr_auto] gap-3 items-end">
              <Select
                classNames={{ trigger: 'h-8 min-h-8' }}
                label={t('environment')}
                labelPlacement="outside"
                selectedKeys={[environment]}
                size="sm"
                variant="bordered"
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0];

                  if (typeof value === 'string') setEnvironment(value);
                }}
              >
                {ENVIRONMENTS.map((envName) => (
                  <SelectItem key={envName}>{envName}</SelectItem>
                ))}
              </Select>
              <Input
                classNames={{ inputWrapper: 'h-8 min-h-8' }}
                label={t('funnel')}
                labelPlacement="outside"
                size="sm"
                value={funnel}
                variant="bordered"
                onValueChange={setFunnel}
              />
              <Input
                classNames={{ inputWrapper: 'h-8 min-h-8' }}
                endContent={
                  <div className="flex gap-1">
                    {TAG_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        className={`rounded-md px-1.5 py-0.5 font-mono text-[10.5px] transition-colors ${
                          tag === preset
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-default-100 text-default-500 hover:bg-default-200'
                        }`}
                        type="button"
                        onClick={() => setTag(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                }
                label={t('tag')}
                labelPlacement="outside"
                size="sm"
                value={tag}
                variant="bordered"
                onValueChange={setTag}
              />
              <Button
                className="h-8 px-5"
                color="primary"
                isLoading={isTriggering}
                startContent={!isTriggering && <Play size={13} />}
                onPress={() => runWith({ environment, funnel, tag, abTest, abVariation, locale })}
              >
                {t('run')}
              </Button>
            </div>

            {showAdvanced && (
              <div className="mt-3 rounded-lg border border-dashed border-default-300 bg-default-50 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                  <Input
                    classNames={{ inputWrapper: 'h-8 min-h-8' }}
                    description={t('abTestDescription')}
                    label={t('abTest')}
                    labelPlacement="outside"
                    placeholder={t('abTestPlaceholder')}
                    size="sm"
                    value={abTest}
                    variant="bordered"
                    onValueChange={setAbTest}
                  />
                  <Input
                    classNames={{ inputWrapper: 'h-8 min-h-8' }}
                    description={t('variationDescription')}
                    label={t('variation')}
                    labelPlacement="outside"
                    placeholder="v0,v1" // i18n-ignore — example value
                    size="sm"
                    value={abVariation}
                    variant="bordered"
                    onValueChange={setAbVariation}
                  />
                  <Select
                    classNames={{ trigger: 'h-8 min-h-8' }}
                    description={t('countryDescription')}
                    label={t('country')}
                    labelPlacement="outside"
                    selectedKeys={[locale]}
                    size="sm"
                    variant="bordered"
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0];

                      if (typeof value === 'string') setLocale(value);
                    }}
                  >
                    {COUNTRIES.map((code) => (
                      <SelectItem key={code}>{countryName(code)}</SelectItem>
                    ))}
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Footer: advanced trigger + live "what will run" summary */}
          <div className="flex items-center justify-between gap-4 flex-wrap border-t border-divider px-4 py-2.5">
            <button
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary"
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {t('advanced')}
              <ChevronDown className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} size={13} />
            </button>
            <div className="flex items-center gap-1.5 flex-wrap text-[11.5px] text-default-400">
              {t('willRun')}
              {summaryParts.map((part, i) => (
                <span
                  key={i}
                  className="rounded-md border border-divider bg-default-100 px-1.5 py-0.5 font-mono text-[11px] text-foreground tabular-nums"
                >
                  {part}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Active run — slim strip per build */}
        {activeBuilds.map((build) => (
          <div
            key={build.number}
            className="rr-enter flex h-11 items-center gap-3 rounded-lg border border-warning-300 bg-warning-50 px-4 dark:bg-warning-50/10"
          >
            <Spinner color="warning" size="sm" />
            <Link isExternal showAnchorIcon className="font-mono text-[12.5px]" href={build.link} size="sm">
              #{build.number}
            </Link>
            <span className="text-[12.5px] text-warning-700 dark:text-warning-400">{build.status}</span>
            <span className="font-mono text-[11.5px] text-default-500 tabular-nums">{duration(build)}</span>
            <div className="min-w-0 flex-1 truncate">
              <ParamChips build={build} />
            </div>
            <Button
              color="danger"
              isLoading={cancelling === build.number}
              size="sm"
              variant="flat"
              onPress={() => cancelBuild(build.number)}
            >
              {t('cancel')}
            </Button>
          </div>
        ))}

        {/* History */}
        <div className="rounded-lg border border-divider bg-content1">
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-divider px-4 py-2.5">
            <span className="text-[12.5px] font-medium">{t('recentRuns')}</span>
            <div className="flex items-center gap-2 flex-wrap">
              <Segmented
                options={STATUS_FILTERS.map((key) => ({ key, label: t(`status.${key}`) }))}
                value={statusFilter}
                onChange={setStatusFilter}
              />
              <FilterChip label={t('env')} value={envFilter === 'all' ? 'all' : envFilter}>
                <div className="flex w-32 flex-col gap-0.5 p-1">
                  {['all', ...ENVIRONMENTS].map((envName) => (
                    <button
                      key={envName}
                      className={`rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-default-100 ${
                        envName === envFilter ? 'font-semibold text-primary' : 'text-foreground'
                      }`}
                      type="button"
                      onClick={() => setEnvFilter(envName)}
                    >
                      {envName === 'all' ? t('allEnvs') : envName}
                    </button>
                  ))}
                </div>
              </FilterChip>
              {currentUser && (
                <Switch isSelected={mineOnly} size="sm" onValueChange={setMineOnly}>
                  <span className="text-[12.5px]">{t('onlyMine')}</span>
                </Switch>
              )}
            </div>
          </div>

          <div className="px-4 py-2 text-[11.5px] text-default-400">
            {data?.error && <p className="mb-1 text-danger">{data.error}</p>}
            {activeBuilds.length > 0 && t('active', { count: activeBuilds.length })}
            {t('successfulOnPage', { ok: successCount, total: builds.length })}
          </div>

          {isPending ? (
            <GridSkeleton rowHeight={44} rows={8} />
          ) : builds.length === 0 ? (
            <EmptyState
              action={
                <Button
                  color="primary"
                  isLoading={isTriggering}
                  size="sm"
                  onPress={() => runWith({ environment, funnel, tag, abTest, abVariation, locale })}
                >
                  {t('empty.startFirst')}
                </Button>
              }
              description={t('empty.noRunsDescription')}
              icon={CirclePlay}
              title={t('empty.noRunsTitle')}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              action={
                <Button
                  size="sm"
                  variant="bordered"
                  onPress={() => {
                    setStatusFilter('all');
                    setEnvFilter('all');
                    setMineOnly(false);
                  }}
                >
                  {tc('clearFilters')}
                </Button>
              }
              description={t('empty.noMatchDescription')}
              icon={SearchX}
              title={t('empty.noMatchTitle')}
            />
          ) : (
            <DataGrid columns={gridColumns} template={HISTORY_TEMPLATE}>
              {filtered.map((build) => (
                <GridRow
                  key={build.number}
                  accent={statusHex(statusColor(build.status))}
                  className="h-11"
                  template={HISTORY_TEMPLATE}
                >
                  <Link isExternal showAnchorIcon className="font-mono text-[12px]" href={build.link} size="sm">
                    #{build.number}
                  </Link>
                  <StatusCell status={build.status} />
                  <div className="min-w-0 pr-2">
                    <ParamChips build={build} />
                  </div>
                  <StartedBy build={build} />
                  <span
                    className="truncate text-[11.5px] text-default-500"
                    title={new Date(build.created * 1000).toLocaleString(intl)}
                  >
                    {formatAgo(new Date(build.created * 1000), ago, new Date(now))}
                  </span>
                  <span className="text-right font-mono text-[11.5px] text-default-500 tabular-nums">
                    {duration(build)}
                  </span>
                  <div className="flex justify-end">
                    {isActive(build.status) ? (
                      <Button
                        color="danger"
                        isLoading={cancelling === build.number}
                        size="sm"
                        variant="flat"
                        onPress={() => cancelBuild(build.number)}
                      >
                        {t('cancel')}
                      </Button>
                    ) : build.environment || build.funnel || build.tag ? (
                      <Button
                        isIconOnly
                        aria-label="Re-run"
                        size="sm"
                        title={t('rerun')}
                        variant="flat"
                        onPress={() =>
                          runWith({
                            environment: build.environment ?? DEFAULTS.environment,
                            funnel: build.funnel ?? DEFAULTS.funnel,
                            tag: build.tag ?? DEFAULTS.tag,
                            abTest: build.abTest,
                            abVariation: build.abVariation,
                            locale: build.locale,
                          })
                        }
                      >
                        <RotateCw size={14} />
                      </Button>
                    ) : null}
                  </div>
                </GridRow>
              ))}
            </DataGrid>
          )}

          {(data?.total ?? 0) > (data?.perPage ?? 10) && (
            <div className="flex w-full justify-center border-t border-divider py-3">
              <Pagination
                isCompact
                showControls
                color="primary"
                page={page}
                total={Math.ceil((data?.total ?? 0) / (data?.perPage ?? 10))}
                onChange={setPage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
