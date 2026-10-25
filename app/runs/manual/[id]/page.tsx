'use client';

import type { RunCaseView, RunSummary } from '@/app/lib/tm/runs';

import { useMemo, useState } from 'react';
import NextLink from 'next/link';
import { Button, Select, SelectItem } from '@heroui/react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, CheckCheck, SearchX, User } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/app/components/ui/empty-state';
import { GridSkeleton } from '@/app/components/ui/skeletons';
import { ConfirmModal } from '@/app/components/tm/confirm-modal';
import { ResultBadge, RunProgress } from '@/app/components/tm/result';
import { RunCasePanel } from '@/app/components/tm/run-case-panel';
import useQuery from '@/app/hooks/useQuery';
import { useCanManageCases } from '@/app/hooks/useCanManageCases';
import { useTmMutation } from '@/app/hooks/useTmMutation';
import { RESULTS, type Result } from '@/app/lib/tm/constants';

type RunDetail = { run: RunSummary; projectId: number; cases: RunCaseView[] };

const ALL = '__all';

export default function RunPage({ params }: Readonly<{ params: { id: string } }>) {
  const runId = Number(params.id);
  const t = useTranslations('tm.runs');
  const canEdit = useCanManageCases();
  const { data: session } = useSession();
  const me = session?.user?.email?.toLowerCase() ?? null;

  const [mine, setMine] = useState(false);
  const [resultFilter, setResultFilter] = useState<Result | typeof ALL>(ALL);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isPending, isError } = useQuery<RunDetail>(`/api/tm/runs/${runId}`, {
    dependencies: [runId],
    // A missing run stays missing; show it right away.
    retry: false,
  });
  const { data: assignees = [] } = useQuery<string[]>('/api/tm/assignees');

  const complete = useTmMutation(`/api/tm/runs/${runId}`, 'PATCH', () => {
    setConfirmOpen(false);
    toast.success(t('completed'));
  });

  const cases = useMemo(
    () =>
      (data?.cases ?? []).filter(
        (c) => (!mine || c.assignee?.toLowerCase() === me) && (resultFilter === ALL || c.result === resultFilter),
      ),
    [data, mine, me, resultFilter],
  );

  // Run cases come pre-sorted by suite path, so consecutive grouping is enough.
  const groups = useMemo(() => {
    const out: { path: string; items: RunCaseView[] }[] = [];

    for (const c of cases) {
      const path = c.snapshot.suitePath.join(' / ');

      if (out.at(-1)?.path === path) out.at(-1)!.items.push(c);
      else out.push({ path, items: [c] });
    }

    return out;
  }, [cases]);

  const active = data?.cases.find((c) => c.id === activeId) ?? null;
  const readOnly = !canEdit || data?.run.status === 'completed';

  // Next untested case after `fromId` in the visible order, wrapping around; null when none are left.
  const nextUntested = (fromId: number) => {
    const i = cases.findIndex((c) => c.id === fromId);
    const ordered = [...cases.slice(i + 1), ...cases.slice(0, Math.max(i, 0))];

    return ordered.find((c) => c.result === 'untested' && c.id !== fromId)?.id ?? null;
  };

  const nextInList = (fromId: number) => {
    const i = cases.findIndex((c) => c.id === fromId);

    return cases[(i + 1) % cases.length]?.id ?? null;
  };

  if (isError) {
    return (
      <EmptyState
        action={
          <Button as={NextLink} href="/runs/manual" size="sm" startContent={<ArrowLeft size={13} />} variant="flat">
            {t('backToRuns')}
          </Button>
        }
        description={t('notFoundDescription')}
        icon={SearchX}
        title={t('notFoundTitle')}
      />
    );
  }

  if (isPending || !data) {
    return (
      <div className="p-5">
        <GridSkeleton rows={6} />
      </div>
    );
  }

  const { run } = data;

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-3 rounded-lg border border-divider bg-content1 p-4 md:flex-row md:items-center md:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <NextLink
            className="flex items-center gap-1 text-[12px] text-default-400 hover:text-foreground"
            href="/runs/manual"
          >
            <ArrowLeft size={12} /> {t('backToRuns')}
          </NextLink>
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[16px] font-semibold">{run.name}</h2>
            <span
              className={`shrink-0 rounded-md px-1.5 py-px text-[11px] font-medium ${
                run.status === 'completed' ? 'bg-default-100 text-default-500' : 'bg-primary/10 text-primary'
              }`}
            >
              {t(`status.${run.status}`)}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-default-500">
            {RESULTS.map((r) => (
              <span key={r}>
                {t(`result.${r}`)}: <span className="font-medium text-foreground">{run.counts[r]}</span>
              </span>
            ))}
          </div>
        </div>
        <RunProgress className="w-full md:w-72" counts={run.counts} total={run.total} />
        {canEdit && run.status === 'in_progress' && (
          <Button
            className="shrink-0"
            color="primary"
            size="sm"
            startContent={<CheckCheck size={14} />}
            variant="flat"
            onPress={() => setConfirmOpen(true)}
          >
            {t('complete')}
          </Button>
        )}
      </div>

      {run.status === 'completed' && (
        <p className="rounded-lg bg-content2 px-3 py-2 text-[12px] text-default-500">{t('readOnly')}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {me && (
          <Button
            color={mine ? 'primary' : 'default'}
            size="sm"
            startContent={<User size={13} />}
            variant={mine ? 'flat' : 'bordered'}
            onPress={() => setMine((v) => !v)}
          >
            {t('myCases')}
          </Button>
        )}
        <Select
          disallowEmptySelection
          aria-label={t('resultFilter')}
          className="w-44"
          selectedKeys={[resultFilter]}
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => setResultFilter(Array.from(keys)[0] as Result | typeof ALL)}
        >
          {[
            <SelectItem key={ALL}>{t('allResults')}</SelectItem>,
            ...RESULTS.map((r) => <SelectItem key={r}>{t(`result.${r}`)}</SelectItem>),
          ]}
        </Select>
      </div>

      {cases.length === 0 ? (
        <EmptyState description={t('noMatchDescription')} icon={SearchX} title={t('noMatchTitle')} />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <section key={g.path} className="flex flex-col gap-1.5">
              {g.path && <h3 className="px-1 text-[12px] font-medium text-default-500">{g.path}</h3>}
              <ul className="flex flex-col divide-y divide-divider rounded-lg border border-divider bg-content1">
                {g.items.map((c) => (
                  <li key={c.id}>
                    <button
                      className={`flex min-h-[44px] w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-default-50 ${
                        activeId === c.id ? 'bg-primary/5' : ''
                      }`}
                      type="button"
                      onClick={() => setActiveId(c.id)}
                    >
                      <span className="w-16 shrink-0 font-mono text-[11.5px] text-default-400">{c.snapshot.label}</span>
                      <span className="min-w-[96px] flex-1 truncate text-[13px]">{c.snapshot.title}</span>
                      <span className="hidden max-w-[200px] shrink-0 truncate text-[11.5px] text-default-400 md:block">
                        {c.assignee ?? t('unassigned')}
                      </span>
                      <span className="flex w-[104px] shrink-0 justify-end">
                        <ResultBadge value={c.result} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <RunCasePanel
        assignees={assignees}
        readOnly={readOnly}
        runCase={active}
        runId={runId}
        onClose={() => setActiveId(null)}
        onNext={() => activeId && setActiveId(nextInList(activeId))}
        onResult={(id) => setActiveId(nextUntested(id))}
      />

      <ConfirmModal
        color="primary"
        confirmLabel={t('complete')}
        isOpen={confirmOpen}
        isPending={complete.isPending}
        message={t('completeConfirm')}
        title={run.name}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => complete.mutate({ body: { status: 'completed' } })}
      />
    </div>
  );
}
