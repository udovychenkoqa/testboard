'use client';

import {} from 'react';
import { useTranslations } from 'next-intl';

import useQuery from '../hooks/useQuery';
import { defaultProjectName } from '../lib/constants';

import { FilterChip } from '@/app/components/ui/filter-chip';

interface ProjectSelectProps {
  value: string;
  onSelect: (project: string) => void;
  refreshId?: string;
  entity: 'result' | 'report';
}

export default function ProjectSelect({ value, refreshId, onSelect, entity }: Readonly<ProjectSelectProps>) {
  const t = useTranslations('filters');
  const tc = useTranslations('common');
  const { data: projects, isLoading } = useQuery<string[]>(`/api/${entity}/projects`, {
    dependencies: [refreshId],
  });

  const items = [defaultProjectName, ...(projects ?? [])];

  return (
    <FilterChip label={t('project')} value={value}>
      <div className="flex w-40 flex-col gap-0.5 p-1">
        {isLoading && <span className="px-2 py-1 text-xs text-default-400">{tc('loading')}</span>}
        {!isLoading &&
          items.map((project) => (
            <button
              key={project}
              className={`rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-default-100 ${
                project === value ? 'font-semibold text-primary' : 'text-foreground'
              }`}
              type="button"
              onClick={() => onSelect(project)}
            >
              {project}
            </button>
          ))}
      </div>
    </FilterChip>
  );
}
