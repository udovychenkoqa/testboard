'use client';

import type { ProjectSummary } from '@/app/lib/tm/projects';
import type { RunSummary } from '@/app/lib/tm/runs';

import { Suspense, useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Select, SelectItem } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { FolderKanban, Play, Plus } from 'lucide-react';

import { EmptyState } from '@/app/components/ui/empty-state';
import { GridSkeleton } from '@/app/components/ui/skeletons';
import { NewRunModal } from '@/app/components/tm/new-run-modal';
import { RunList } from '@/app/components/tm/run-list';
import useQuery from '@/app/hooks/useQuery';
import { useCanManageCases } from '@/app/hooks/useCanManageCases';
import { useTmProject } from '@/app/hooks/useTmProject';

const ManualRuns: React.FC = () => {
  const t = useTranslations('tm.runs');
  const router = useRouter();
  const params = useSearchParams();
  const canEdit = useCanManageCases();
  const [stored, setStored] = useTmProject();
  const [isOpen, setIsOpen] = useState(false);

  // ?project=KEY&cases=1,2,3 comes from the Test Cases bulk bar ("Create run").
  const queryProject = params?.get('project') ?? null;
  const presetCaseIds = useMemo(
    () =>
      (params?.get('cases') ?? '')
        .split(',')
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0),
    [params],
  );

  const { data: projects, isPending: projectsPending } = useQuery<ProjectSummary[]>('/api/tm/projects');
  const key = [queryProject, stored].find((k) => k && projects?.some((p) => p.key === k)) ?? projects?.[0]?.key ?? null;

  useEffect(() => {
    if (queryProject) setStored(queryProject);
  }, [queryProject, setStored]);

  useEffect(() => {
    if (presetCaseIds.length > 0 && canEdit) setIsOpen(true);
  }, [presetCaseIds, canEdit]);

  const { data: runs, isPending: runsPending } = useQuery<RunSummary[]>(`/api/tm/projects/${key}/runs`, {
    enabled: !!key,
    dependencies: [key],
  });

  const closeModal = () => {
    setIsOpen(false);
    if (presetCaseIds.length > 0) router.replace('/runs/manual');
  };

  if (projectsPending) return <GridSkeleton rows={4} />;

  if (!projects?.length || !key) {
    return (
      <EmptyState
        action={
          <Button as={NextLink} color="primary" href="/cases" size="sm">
            {t('goToCases')}
          </Button>
        }
        description={t('noProjectsDescription')}
        icon={FolderKanban}
        title={t('noProjectsTitle')}
      />
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          disallowEmptySelection
          aria-label={t('project')}
          className="w-64"
          selectedKeys={[key]}
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => setStored((Array.from(keys)[0] as string) ?? null)}
        >
          {projects.map((p) => (
            <SelectItem key={p.key} textValue={p.name}>
              <span className="font-mono text-[11.5px] text-default-400">{p.code}</span> {p.name}
            </SelectItem>
          ))}
        </Select>
        <div className="flex-1" />
        {canEdit && (
          <Button
            className="h-[30px] px-2.5 text-xs font-semibold"
            color="primary"
            size="sm"
            startContent={<Plus size={14} />}
            onPress={() => setIsOpen(true)}
          >
            {t('newRun')}
          </Button>
        )}
      </div>

      {runsPending ? (
        <GridSkeleton rows={4} />
      ) : !runs?.length ? (
        <EmptyState
          action={
            canEdit && (
              <Button color="primary" size="sm" onPress={() => setIsOpen(true)}>
                {t('newRun')}
              </Button>
            )
          }
          description={t('emptyDescription')}
          icon={Play}
          title={t('emptyTitle')}
        />
      ) : (
        <RunList runs={runs} />
      )}

      <NewRunModal
        isOpen={isOpen}
        presetCaseIds={presetCaseIds}
        projectKey={key}
        onClose={closeModal}
        onCreated={(run) => router.push(`/runs/manual/${run.id}`)}
      />
    </>
  );
};

export default function ManualRunsPage() {
  return (
    <div className="flex flex-col gap-4 p-5">
      <Suspense fallback={<GridSkeleton rows={4} />}>
        <ManualRuns />
      </Suspense>
    </div>
  );
}
