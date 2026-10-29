'use client';

import {} from 'react';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

import useQuery from '../hooks/useQuery';

import { FilterChip } from '@/app/components/ui/filter-chip';

interface TagSelectProps {
  value: string[];
  onSelect?: (tags: string[]) => void;
  refreshId?: string;
  entity: 'result' | 'report';
  project?: string;
}

export default function TagSelect({ value, refreshId, onSelect, entity, project }: Readonly<TagSelectProps>) {
  const t = useTranslations('filters');
  const tc = useTranslations('common');
  const { data: tags, isLoading } = useQuery<string[]>(
    `/api/${entity}/tags${project ? `?project=${encodeURIComponent(project)}` : ''}`,
    {
      dependencies: [refreshId, project],
    },
  );

  const toggle = (tag: string) => {
    onSelect?.(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);
  };

  return (
    <FilterChip label={t('tags')} value={value.length ? `${value.length}` : t('allTags')}>
      <div className="flex w-44 flex-col gap-0.5 p-1">
        {isLoading && <span className="px-2 py-1 text-xs text-default-400">{tc('loading')}</span>}
        {!isLoading && !tags?.length && <span className="px-2 py-1 text-xs text-default-400">{t('noTags')}</span>}
        {tags?.map((tag) => {
          const active = value.includes(tag);

          return (
            <button
              key={tag}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-default-100"
              type="button"
              onClick={() => toggle(tag)}
            >
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${active ? 'border-primary bg-primary' : 'border-default-300'}`}
              >
                {active && <Check className="text-primary-foreground" size={10} />}
              </span>
              {tag}
            </button>
          );
        })}
      </div>
    </FilterChip>
  );
}
