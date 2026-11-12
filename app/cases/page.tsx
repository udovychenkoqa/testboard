'use client';

import type { ProjectSummary } from '@/app/lib/tm/projects';

import { useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { FolderKanban, Pencil, Plus, Trash2 } from 'lucide-react';

import { PageHeader } from '@/app/components/page-header';
import { EmptyState } from '@/app/components/ui/empty-state';
import { GridSkeleton } from '@/app/components/ui/skeletons';
import { AutomationBar } from '@/app/components/tm/automation-bar';
import { DeleteProjectModal } from '@/app/components/tm/delete-project-modal';
import { EditProjectModal } from '@/app/components/tm/edit-project-modal';
import { NewProjectModal } from '@/app/components/tm/new-project-modal';
import { ProjectAvatar } from '@/app/components/tm/project-avatar';
import useQuery from '@/app/hooks/useQuery';
import { useCan } from '@/app/hooks/useCan';
import { useCanManageCases } from '@/app/hooks/useCanManageCases';
import { CAPABILITIES } from '@/app/lib/access';
import { useTmProject } from '@/app/hooks/useTmProject';

export default function TestCasesProjectsPage() {
  const t = useTranslations('tm.projects');
  const router = useRouter();
  const canEdit = useCanManageCases();
  // Creating and deleting a project is for administrators; members still rename it and set its logo.
  const canManageProjects = useCan(CAPABILITIES.manageProjects);
  const [, setProject] = useTmProject();
  const [isOpen, setIsOpen] = useState(false);
  const [toDelete, setToDelete] = useState<ProjectSummary | null>(null);
  // A key, not a snapshot: the edit dialog reads the live project so a new logo shows up in it at once.
  const [toEdit, setToEdit] = useState<string | null>(null);
  const tc = useTranslations('tm.common');
  const { data: projects, isPending } = useQuery<ProjectSummary[]>('/api/tm/projects');

  const open = (key: string) => {
    setProject(key);
    router.push(`/cases/${key}`);
  };

  return (
    <div className="flex flex-col rr-enter">
      <PageHeader
        actions={
          canManageProjects && (
            <Button
              className="h-[30px] px-2.5 text-xs font-semibold"
              color="primary"
              size="sm"
              startContent={<Plus size={14} />}
              onPress={() => setIsOpen(true)}
            >
              {t('newProject')}
            </Button>
          )
        }
        subtitle={t('subtitle')}
        title={t('title')}
      />
      <div className="p-5">
        {isPending ? (
          <GridSkeleton rows={3} />
        ) : !projects?.length ? (
          <EmptyState
            action={
              canManageProjects && (
                <Button color="primary" size="sm" onPress={() => setIsOpen(true)}>
                  {t('newProject')}
                </Button>
              )
            }
            description={t('emptyDescription')}
            icon={FolderKanban}
            title={t('emptyTitle')}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => (
              // The delete button sits beside the card link, not inside it: a button can't live in an <a>.
              <div key={p.id} className="group relative">
                <NextLink
                  className="flex h-full flex-col gap-2 rounded-lg border border-divider bg-content1 p-4 transition-colors hover:border-primary/40"
                  href={`/cases/${p.key}`}
                  onClick={() => setProject(p.key)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <ProjectAvatar project={p} />
                      <span className="truncate text-[14px] font-semibold group-hover:text-primary">{p.name}</span>
                    </div>
                    <span className="shrink-0 rounded-md bg-default-100 px-1.5 py-0.5 font-mono text-[11px] text-default-500">
                      {p.code}
                    </span>
                  </div>
                  <span className="font-mono text-[11.5px] text-default-400">{p.key}</span>
                  <span className="text-[12px] text-default-500">{t('cases', { count: p.caseCount })}</span>
                  {p.caseCount > 0 && (
                    <div className="flex flex-col gap-2 pt-1">
                      <AutomationBar label={t('overall')} stats={p} />
                      {p.smoke.caseCount > 0 ? (
                        <AutomationBar label={t('smoke')} stats={p.smoke} />
                      ) : (
                        <span className="text-[11.5px] text-default-400">{t('noSmoke')}</span>
                      )}
                      <div className="flex flex-wrap gap-x-2.5 gap-y-1 pr-16 text-[10.5px] text-default-400">
                        <span className="flex items-center gap-1">
                          <i className="h-2 w-2 rounded-sm bg-primary" />
                          {t('legendAutomated')}
                        </span>
                        <span className="flex items-center gap-1">
                          <i className="h-2 w-2 rounded-sm bg-primary/30" />
                          {t('legendPlanned')}
                        </span>
                        <span className="flex items-center gap-1">
                          <i className="h-2 w-2 rounded-sm bg-default-200" />
                          {t('legendManual')}
                        </span>
                      </div>
                    </div>
                  )}
                </NextLink>
                {canEdit && (
                  <div className="absolute bottom-3 right-3 flex gap-0.5">
                    <Button
                      isIconOnly
                      aria-label={tc('edit')}
                      className="text-default-400 hover:text-foreground"
                      size="sm"
                      title={tc('edit')}
                      variant="light"
                      onPress={() => setToEdit(p.key)}
                    >
                      <Pencil size={14} />
                    </Button>
                    {canManageProjects && (
                      <Button
                        isIconOnly
                        aria-label={t('delete')}
                        className="text-default-400 hover:text-danger"
                        size="sm"
                        title={t('delete')}
                        variant="light"
                        onPress={() => setToDelete(p)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <DeleteProjectModal project={toDelete} onClose={() => setToDelete(null)} />
      <EditProjectModal project={projects?.find((p) => p.key === toEdit) ?? null} onClose={() => setToEdit(null)} />
      <NewProjectModal isOpen={isOpen} onClose={() => setIsOpen(false)} onCreated={(p) => open(p.key)} />
    </div>
  );
}
