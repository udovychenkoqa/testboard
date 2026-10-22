'use client';

import { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Input, Link, Pagination, SelectItem, Spinner, Switch } from '@heroui/react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { ChevronDown, Play, RotateCw, CirclePlay, SearchX, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Select } from '@/app/components/ui/select';
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
import {
  DEFAULT_INPUTS,
  ENVIRONMENTS,
  MODES,
  TAG_PRESETS,
  type Mode,
  type TriggerInputs,
} from '@/app/lib/autotests/inputs';

const PREFS_KEY = 'run-tests-prefs';

// Message keys can't contain spaces, so the "by tag" mode gets a camelCase key.
const MODE_KEY: Record<Mode, 'byTag' | 'smoke' | 'regression'> = {
  'by tag': 'byTag',
  smoke: 'smoke',
  regression: 'regression',
};

interface BuildItem {
  id: number;
  iid: number;
  status: string;
  user?: string;
  startedBy?: string;
  viaCi?: boolean;
  inputs?: Partial<TriggerInputs>;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  duration?: number;
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
  if (status === 'failure' || status === 'killed') return 'danger';
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

// Inputs are known only for pipelines started from Testboard. Show env · mode · tag (the tag only when the
// mode uses it) and nothing for pipelines started elsewhere.
const ParamChips: React.FC<{ build: BuildItem; modeLabel: (mode: Mode) => string }> = ({ build, modeLabel }) => {
  const inputs = build.inputs;
  const parts = inputs
    ? ([inputs.env, inputs.mode && modeLabel(inputs.mode), inputs.mode === 'by tag' ? inputs.tag : undefined].filter(
        Boolean,
      ) as string[])
    : [];

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
  // Pipelines started outside Testboard (schedules, pushes, the GitLab UI) get a neutral badge; who started
  // them in GitLab is only a tooltip.
  if (build.viaCi) {
    return (
      <div className="flex min-w-0 items-center gap-2" title={build.user}>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-default-100 text-default-500">
          <Settings size={12} />
        </span>
        <span className="truncate text-[12.5px]">CI</span>
      </div>
    );
  }

  const name = build.startedBy ?? build.user ?? '—';

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="h-5 w-5 shrink-0 text-tiny" name={name} />
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
  const modeLabel = (mode: Mode) => t(`modes.${MODE_KEY[mode]}`);

  const [inputs, setInputs] = useState<TriggerInputs>(DEFAULT_INPUTS);
  const set = <K extends keyof TriggerInputs>(key: K, value: TriggerInputs[K]) =>
    setInputs((prev) => ({ ...prev, [key]: value }));
  // The Qase and snapshot inputs are used rarely — hidden behind a toggle to keep the form clean.
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [page, setPage] = useState(1);

  // Filters (client-side over the current page).
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [envFilter, setEnvFilter] = useState<string>('all');
  const [mineOnly, setMineOnly] = useState(false);

  // Restore the last-used environment and mode. The tag and Qase ids are per-run, so they start fresh.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');

      if (ENVIRONMENTS.includes(saved.env)) setInputs((prev) => ({ ...prev, env: saved.env }));
      if (MODES.includes(saved.mode)) setInputs((prev) => ({ ...prev, mode: saved.mode }));
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

  useEffect(() => {
    if (activeBuilds.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);

    return () => clearInterval(id);
  }, [activeBuilds.length]);

  const onStarted = (messageKey: 'buildStarted' | 'rerunStarted') => (result: TriggerResponse) => {
    setPage(1);
    toast.success(t(messageKey, { number: result.build.iid }), {
      action: { label: t('openInGitlab'), onClick: () => window.open(result.link, '_blank') },
      duration: 10_000,
    });
    refetch();
  };

  const { mutate: trigger, isPending: isTriggering } = useMutation<TriggerResponse>('/api/autotests/trigger', {
    onSuccess: onStarted('buildStarted'),
  });
  const { mutate: rerun } = useMutation<TriggerResponse>('/api/autotests/rerun', {
    onSuccess: onStarted('rerunStarted'),
  });

  const run = () => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ env: inputs.env, mode: inputs.mode }));
    } catch {
      /* ignore */
    }
    trigger({ body: inputs });
  };

  const [cancelling, setCancelling] = useState<number | null>(null);
  const { mutate: cancel } = useMutation('/api/autotests/cancel', {
    onSuccess: () => {
      toast.success(t('cancelled'));
      setCancelling(null);
      refetch();
    },
    onError: () => setCancelling(null),
  });

  const cancelBuild = (id: number) => {
    setCancelling(id);
    cancel({ body: { id } });
  };

  const duration = (build: BuildItem): string => {
    if (isActive(build.status) && build.startedAt) {
      return formatDuration(Math.max(0, Math.floor((now - Date.parse(build.startedAt)) / 1000)));
    }

    return build.duration ? formatDuration(Math.round(build.duration)) : '—';
  };

  // Apply filters to the current page.
  const filtered = builds.filter((b) => {
    if (statusFilter === 'running' && !isActive(b.status)) return false;
    if (statusFilter === 'failure' && statusColor(b.status) !== 'danger') return false;
    if (statusFilter === 'success' && b.status !== 'success') return false;
    if (envFilter !== 'all' && b.inputs?.env !== envFilter) return false;
    if (mineOnly && currentUser && b.startedBy !== currentUser) return false;

    return true;
  });

  const successCount = builds.filter((b) => b.status === 'success').length;

  // Live "what will run" summary for the footer.
  const summaryParts = [
    inputs.env,
    modeLabel(inputs.mode),
    inputs.mode === 'by tag' ? inputs.tag || '—' : null,
    inputs.qase_run_id ? `Qase #${inputs.qase_run_id}` : null, // i18n-ignore — Qase is a product name
  ].filter(Boolean) as string[];

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
        {/* Run inputs — one row: env / mode / tag / run */}
        <div className="rounded-lg border border-divider bg-content1">
          <div className="p-4">
            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[150px_170px_1fr_auto]">
              <Select
                disallowEmptySelection
                classNames={{ trigger: 'h-8 min-h-8' }}
                label={t('environment')}
                labelPlacement="outside"
                selectedKeys={[inputs.env]}
                size="sm"
                variant="bordered"
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as TriggerInputs['env'] | undefined;

                  if (value) set('env', value);
                }}
              >
                {ENVIRONMENTS.map((envName) => (
                  <SelectItem key={envName}>{envName}</SelectItem>
                ))}
              </Select>
              <Select
                disallowEmptySelection
                classNames={{ trigger: 'h-8 min-h-8' }}
                label={t('mode')}
                labelPlacement="outside"
                selectedKeys={[inputs.mode]}
                size="sm"
                variant="bordered"
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as Mode | undefined;

                  if (value) set('mode', value);
                }}
              >
                {MODES.map((mode) => (
                  <SelectItem key={mode}>{modeLabel(mode)}</SelectItem>
                ))}
              </Select>
              <Input
                classNames={{ inputWrapper: 'h-8 min-h-8' }}
                description={
                  <span className="flex flex-wrap items-center gap-1">
                    {TAG_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        className={`rounded-md px-1.5 py-0.5 font-mono text-[10.5px] transition-colors disabled:opacity-50 ${
                          inputs.tag === preset
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-default-100 text-default-500 hover:bg-default-200'
                        }`}
                        disabled={inputs.mode !== 'by tag'}
                        type="button"
                        onClick={() => set('tag', preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </span>
                }
                isDisabled={inputs.mode !== 'by tag'}
                label={t('tag')}
                labelPlacement="outside"
                size="sm"
                value={inputs.tag}
                variant="bordered"
                onValueChange={(value) => set('tag', value)}
              />
              <Button
                className="h-8 px-5 md:mt-6"
                color="primary"
                isLoading={isTriggering}
                startContent={!isTriggering && <Play size={13} />}
                onPress={run}
              >
                {t('run')}
              </Button>
            </div>

            {showAdvanced && (
              <div className="mt-3 rounded-lg border border-dashed border-default-300 bg-default-50 p-4">
                <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
                  <Input
                    classNames={{ inputWrapper: 'h-8 min-h-8' }}
                    description={t('qaseRunIdDescription')}
                    inputMode="numeric"
                    label={t('qaseRunId')}
                    labelPlacement="outside"
                    placeholder="1234" // i18n-ignore — example value
                    size="sm"
                    value={inputs.qase_run_id}
                    variant="bordered"
                    onValueChange={(value) => set('qase_run_id', value.replace(/\D/g, ''))}
                  />
                  <Input
                    classNames={{ inputWrapper: 'h-8 min-h-8' }}
                    description={t('qaseIdDescription')}
                    label={t('qaseId')}
                    labelPlacement="outside"
                    placeholder="356, 357" // i18n-ignore — example value
                    size="sm"
                    value={inputs.qase_id}
                    variant="bordered"
                    onValueChange={(value) => set('qase_id', value.replace(/[^\d,\s]/g, ''))}
                  />
                  <Switch
                    isSelected={inputs.skip_visual_checks}
                    size="sm"
                    onValueChange={(value) => set('skip_visual_checks', value)}
                  >
                    <span className="text-[12.5px]">{t('skipVisual')}</span>
                  </Switch>
                  <Switch
                    isSelected={inputs.force_snapshots_recollection}
                    size="sm"
                    onValueChange={(value) => set('force_snapshots_recollection', value)}
                  >
                    <span className="text-[12.5px]">{t('forceSnapshots')}</span>
                  </Switch>
                </div>
              </div>
            )}
          </div>

          {/* Footer: advanced trigger + live "what will run" summary */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-divider px-4 py-2.5">
            <button
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary"
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {t('advanced')}
              <ChevronDown className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} size={13} />
            </button>
            <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-default-400">
              {t('willRun')}
              {summaryParts.map((part, i) => (
                <span
                  key={i}
                  className="rounded-md border border-divider bg-default-100 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-foreground"
                >
                  {part}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Active run — slim strip per pipeline */}
        {activeBuilds.map((build) => (
          <div
            key={build.id}
            className="rr-enter flex h-11 items-center gap-3 rounded-lg border border-warning-300 bg-warning-50 px-4 dark:bg-warning-50/10"
          >
            <Spinner color="warning" size="sm" />
            <Link isExternal showAnchorIcon className="font-mono text-[12.5px]" href={build.link} size="sm">
              #{build.iid}
            </Link>
            <span className="text-[12.5px] text-warning-700 dark:text-warning-400">{build.status}</span>
            <span className="font-mono text-[11.5px] tabular-nums text-default-500">{duration(build)}</span>
            <div className="min-w-0 flex-1 truncate">
              <ParamChips build={build} modeLabel={modeLabel} />
            </div>
            <Button
              color="danger"
              isLoading={cancelling === build.id}
              size="sm"
              variant="flat"
              onPress={() => cancelBuild(build.id)}
            >
              {t('cancel')}
            </Button>
          </div>
        ))}

        {/* History */}
        <div className="rounded-lg border border-divider bg-content1">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider px-4 py-2.5">
            <span className="text-[12.5px] font-medium">{t('recentRuns')}</span>
            <div className="flex flex-wrap items-center gap-2">
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
                <Button color="primary" isLoading={isTriggering} size="sm" onPress={run}>
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
                  key={build.id}
                  accent={statusHex(statusColor(build.status))}
                  className="h-11"
                  template={HISTORY_TEMPLATE}
                >
                  <Link isExternal showAnchorIcon className="font-mono text-[12px]" href={build.link} size="sm">
                    #{build.iid}
                  </Link>
                  <StatusCell status={build.status} />
                  <div className="min-w-0 pr-2">
                    <ParamChips build={build} modeLabel={modeLabel} />
                  </div>
                  <StartedBy build={build} />
                  <span
                    className="truncate text-[11.5px] text-default-500"
                    title={new Date(build.createdAt).toLocaleString(intl)}
                  >
                    {formatAgo(new Date(build.createdAt), ago, new Date(now))}
                  </span>
                  <span className="text-right font-mono text-[11.5px] tabular-nums text-default-500">
                    {duration(build)}
                  </span>
                  <div className="flex justify-end">
                    {isActive(build.status) ? (
                      <Button
                        color="danger"
                        isLoading={cancelling === build.id}
                        size="sm"
                        variant="flat"
                        onPress={() => cancelBuild(build.id)}
                      >
                        {t('cancel')}
                      </Button>
                    ) : (
                      <Button
                        isIconOnly
                        aria-label={t('rerun')}
                        size="sm"
                        title={t('rerun')}
                        variant="flat"
                        onPress={() => rerun({ body: { id: build.id } })}
                      >
                        <RotateCw size={14} />
                      </Button>
                    )}
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
