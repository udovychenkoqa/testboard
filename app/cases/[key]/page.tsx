'use client';

import type { CaseListItem } from '@/app/lib/tm/cases';
import type { Project } from '@/app/lib/tm/projects';
import type { SuiteNode } from '@/app/lib/tm/suites';

import { useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input, SelectItem } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { FolderPlus, ListChecks, Play, Plus, Search, SearchX, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Select } from '@/app/components/ui/select';
import { PageHeader } from '@/app/components/page-header';
import { EmptyState } from '@/app/components/ui/empty-state';
import { GridSkeleton } from '@/app/components/ui/skeletons';
import { CaseList } from '@/app/components/tm/case-list';
import { CasePanel } from '@/app/components/tm/case-panel';
import { ConfirmModal } from '@/app/components/tm/confirm-modal';
import { NameModal } from '@/app/components/tm/name-modal';
import { SuiteTree } from '@/app/components/tm/suite-tree';
import useQuery from '@/app/hooks/useQuery';
import { useCanManageCases } from '@/app/hooks/useCanManageCases';
import { useTmMutation } from '@/app/hooks/useTmMutation';
import { useTmProject } from '@/app/hooks/useTmProject';
import { AUTOMATION, CASE_STATUSES, PRIORITIES } from '@/app/lib/tm/constants';

type FilterKey = 'priority' | 'status' | 'automation';
type NameDialog = { kind: 'create'; parentId: number | null } | { kind: 'rename'; suite: SuiteNode } | null;
type PanelMode = { kind: 'new'; suiteId: number } | { kind: 'edit'; caseId: number } | null;

export default function ProjectCasesPage({ params }: Readonly<{ params: { key: string } }>) {
  const { key } = params;
  const t = useTranslations('tm');
  const router = useRouter();
  const canEdit = useCanManageCases();
  const [, setProject] = useTmProject();

  const [suiteId, setSuiteId] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Partial<Record<FilterKey, string>>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [panel, setPanel] = useState<PanelMode>(null);
  const [nameDialog, setNameDialog] = useState<NameDialog>(null);
  const [confirm, setConfirm] = useState<{ kind: 'suite'; suite: SuiteNode } | { kind: 'cases' } | null>(null);

  useEffect(() => setProject(key), [key, setProject]);

  const { data: project } = useQuery<Project>(`/api/tm/projects/${key}`, { dependencies: [key] });
  const { data: suites = [] } = useQuery<SuiteNode[]>(`/api/tm/projects/${key}/suites`, { dependencies: [key] });
  const query = new URLSearchParams(
    Object.entries({ suiteId: suiteId ?? '', q, ...filters }).filter(([, v]) => v !== '') as [string, string][],
  ).toString();
  const { data: cases = [], isPending } = useQuery<CaseListItem[]>(`/api/tm/projects/${key}/cases?${query}`, {
    dependencies: [key, query],
  });
  const totalCount = useMemo(() => suites.reduce((n, s) => n + s.caseCount, 0), [suites]);

  useEffect(() => setSelected(new Set()), [query]);

  const createSuite = useTmMutation<SuiteNode>(`/api/tm/projects/${key}/suites`, 'POST', (s) => {
    setNameDialog(null);
    setSuiteId(s.id);
  });
  const updateSuite = useTmMutation(`/api/tm/suites`, 'PATCH', () => setNameDialog(null));
  const deleteSuite = useTmMutation(`/api/tm/suites`, 'DELETE', () => {
    setConfirm(null);
    setSuiteId(null);
    toast.success(t('common.deleted'));
  });
  const bulk = useTmMutation(`/api/tm/projects/${key}/cases/bulk`, 'POST', () => {
    setSelected(new Set());
    setConfirm(null);
  });

  const defaultSuite = suiteId ?? suites[0]?.id;

  const filterSelect = (k: FilterKey, options: readonly string[]) => (
    <Select
      aria-label={t(`fields.${k}.label`)}
      className="w-40"
      placeholder={t(`fields.${k}.label`)}
      selectedKeys={filters[k] ? [filters[k]!] : []}
      size="sm"
      variant="bordered"
      onSelectionChange={(keys) => setFilters((f) => ({ ...f, [k]: (Array.from(keys)[0] as string) ?? undefined }))}
    >
      {options.map((o) => (
        <SelectItem key={o}>{t(`fields.${k}.${o}` as 'fields.priority.high')}</SelectItem>
      ))}
    </Select>
  );

  const hasFilters = !!q || Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-col rr-enter">
      <PageHeader
        actions={
          canEdit && (
            <div className="flex items-center gap-2">
              <Button
                className="h-[30px] px-2.5 text-xs"
                size="sm"
                startContent={<FolderPlus size={14} />}
                variant="bordered"
                onPress={() => setNameDialog({ kind: 'create', parentId: null })}
              >
                {t('cases.newSuite')}
              </Button>
              <Button
                className="h-[30px] px-2.5 text-xs font-semibold"
                color="primary"
                isDisabled={!defaultSuite}
                size="sm"
                startContent={<Plus size={14} />}
                onPress={() => defaultSuite && setPanel({ kind: 'new', suiteId: defaultSuite })}
              >
                {t('cases.newCase')}
              </Button>
            </div>
          )
        }
        subtitle={
          <NextLink className="hover:text-foreground" href="/cases">
            {t('cases.back')} / {project?.code}
          </NextLink>
        }
        title={project?.name ?? key}
      />

      {!canEdit && (
        <p className="border-b border-divider bg-content2 px-5 py-2 text-[12px] text-default-500">
          {t('cases.readOnly')}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-[280px]">
          <SuiteTree
            canEdit={canEdit}
            selectedId={suiteId}
            suites={suites}
            totalCount={totalCount}
            onAddChild={(parentId) => setNameDialog({ kind: 'create', parentId })}
            onDelete={(suite) => setConfirm({ kind: 'suite', suite })}
            onDropCases={
              canEdit
                ? (target, ids) => {
                    bulk.mutate({ body: { action: 'move', ids, suiteId: target } });
                    toast.success(t('cases.moved'));
                  }
                : undefined
            }
            onRename={(suite) => setNameDialog({ kind: 'rename', suite })}
            onSelect={setSuiteId}
          />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={t('cases.search')}
              className="w-64"
              placeholder={t('cases.search')}
              size="sm"
              startContent={<Search className="text-default-400" size={14} />}
              value={q}
              variant="bordered"
              onValueChange={setQ}
            />
            {filterSelect('priority', PRIORITIES)}
            {filterSelect('status', CASE_STATUSES)}
            {filterSelect('automation', AUTOMATION)}
          </div>

          {canEdit && selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
              <span className="text-[12.5px] font-medium text-primary">
                {t('cases.selected', { count: selected.size })}
              </span>
              <Select
                aria-label={t('cases.move')}
                className="w-48"
                placeholder={t('cases.move')}
                selectedKeys={[]}
                size="sm"
                variant="bordered"
                onSelectionChange={(keys) => {
                  const target = Number(Array.from(keys)[0]);

                  if (target) {
                    bulk.mutate({ body: { action: 'move', ids: [...selected], suiteId: target } });
                    toast.success(t('cases.moved'));
                  }
                }}
              >
                {suites.map((s) => (
                  <SelectItem key={String(s.id)}>{s.name}</SelectItem>
                ))}
              </Select>
              <Button
                size="sm"
                startContent={<Play size={13} />}
                variant="flat"
                onPress={() => router.push(`/runs/manual?project=${key}&cases=${[...selected].join(',')}`)}
              >
                {t('cases.createRun')}
              </Button>
              <Button
                color="danger"
                size="sm"
                startContent={<Trash2 size={13} />}
                variant="light"
                onPress={() => setConfirm({ kind: 'cases' })}
              >
                {t('cases.deleteSelected')}
              </Button>
            </div>
          )}

          {isPending ? (
            <GridSkeleton rows={6} />
          ) : suites.length === 0 ? (
            <EmptyState
              action={
                canEdit && (
                  <Button color="primary" size="sm" onPress={() => setNameDialog({ kind: 'create', parentId: null })}>
                    {t('cases.newSuite')}
                  </Button>
                )
              }
              description={t('cases.noSuitesDescription')}
              icon={FolderPlus}
              title={t('cases.noSuitesTitle')}
            />
          ) : cases.length === 0 ? (
            <EmptyState
              action={
                canEdit &&
                defaultSuite &&
                !hasFilters && (
                  <Button color="primary" size="sm" onPress={() => setPanel({ kind: 'new', suiteId: defaultSuite })}>
                    {t('cases.newCase')}
                  </Button>
                )
              }
              description={t('cases.emptyDescription')}
              icon={hasFilters ? SearchX : ListChecks}
              title={t('cases.emptyTitle')}
            />
          ) : (
            <CaseList
              activeId={panel?.kind === 'edit' ? panel.caseId : null}
              canEdit={canEdit}
              cases={cases}
              selected={selected}
              selectedSuiteId={suiteId}
              suites={suites}
              onOpen={(caseId) => setPanel({ kind: 'edit', caseId })}
              onToggle={(id) =>
                setSelected((prev) => {
                  const next = new Set(prev);

                  next.has(id) ? next.delete(id) : next.add(id);

                  return next;
                })
              }
              onToggleAll={() =>
                setSelected((prev) => (prev.size === cases.length ? new Set() : new Set(cases.map((c) => c.id))))
              }
            />
          )}
        </section>
      </div>

      <CasePanel canEdit={canEdit} mode={panel} projectKey={key} suites={suites} onClose={() => setPanel(null)} />

      <NameModal
        initial={nameDialog?.kind === 'rename' ? nameDialog.suite.name : ''}
        isOpen={nameDialog !== null}
        isPending={createSuite.isPending || updateSuite.isPending}
        title={
          nameDialog?.kind === 'rename'
            ? t('common.rename')
            : nameDialog?.parentId
              ? t('cases.subSuite')
              : t('cases.newSuite')
        }
        onClose={() => setNameDialog(null)}
        onSubmit={(name) => {
          if (nameDialog?.kind === 'rename') {
            updateSuite.mutate({ path: `/api/tm/suites/${nameDialog.suite.id}`, body: { name } });
          } else if (nameDialog) {
            createSuite.mutate({ body: { name, parentId: nameDialog.parentId } });
          }
        }}
      />

      <ConfirmModal
        isOpen={confirm !== null}
        isPending={deleteSuite.isPending || bulk.isPending}
        message={confirm?.kind === 'suite' ? t('cases.suiteDeleteConfirm') : t('cases.caseDeleteConfirm')}
        title={confirm?.kind === 'suite' ? confirm.suite.name : t('cases.deleteSelected')}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === 'suite') deleteSuite.mutate({ path: `/api/tm/suites/${confirm.suite.id}` });
          else bulk.mutate({ body: { action: 'delete', ids: [...selected] } });
        }}
      />
    </div>
  );
}
