'use client';

import type { ProjectSummary } from '@/app/lib/tm/projects';

import { useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { FolderKanban, Plus, Trash2 } from 'lucide-react';

import { PageHeader } from '@/app/components/page-header';
import { EmptyState } from '@/app/components/ui/empty-state';
import { GridSkeleton } from '@/app/components/ui/skeletons';
import { DeleteProjectModal } from '@/app/components/tm/delete-project-modal';
import { NewProjectModal } from '@/app/components/tm/new-project-modal';
import useQuery from '@/app/hooks/useQuery';
import { useCanManageCases } from '@/app/hooks/useCanManageCases';
import { useTmProject } from '@/app/hooks/useTmProject';

export default function TestCasesProjectsPage() {
  const t = useTranslations('tm.projects');
  const router = useRouter();
  const canEdit = useCanManageCases();
  const [, setProject] = useTmProject();
  const [isOpen, setIsOpen] = useState(false);
  const [toDelete, setToDelete] = useState<ProjectSummary | null>(null);
  const { data: projects, isPending } = useQuery<ProjectSummary[]>('/api/tm/projects');

  const open = (key: string) => {
    setProject(key);
    router.push(`/cases/${key}`);
  };

  return (
    <div className="flex flex-col rr-enter">
      <PageHeader
        actions={
          canEdit && (
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
              canEdit && (
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
                    <span className="truncate text-[14px] font-semibold group-hover:text-primary">{p.name}</span>
                    <span className="shrink-0 rounded-md bg-default-100 px-1.5 py-0.5 font-mono text-[11px] text-default-500">
                      {p.code}
                    </span>
                  </div>
                  <span className="font-mono text-[11.5px] text-default-400">{p.key}</span>
                  <div className="flex items-center gap-3 text-[12px] text-default-500">
                    <span>{t('cases', { count: p.caseCount })}</span>
                    {p.caseCount > 0 && (
                      <span className="text-primary">
                        {t('automated', { percent: Math.round((p.automatedCount / p.caseCount) * 100) })}
                      </span>
                    )}
                  </div>
                </NextLink>
                {canEdit && (
                  <Button
                    isIconOnly
                    aria-label={t('delete')}
                    className="absolute bottom-3 right-3 text-default-400 hover:text-danger"
                    size="sm"
                    title={t('delete')}
                    variant="light"
                    onPress={() => setToDelete(p)}
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <DeleteProjectModal project={toDelete} onClose={() => setToDelete(null)} />
      <NewProjectModal isOpen={isOpen} onClose={() => setIsOpen(false)} onCreated={(p) => open(p.key)} />
    </div>
  );
}
