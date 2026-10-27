import { type ChangeEvent } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import ProjectSelect from '@/app/components/project-select';
import TagSelect from '@/app/components/tag-select';
import DateRangePicker from '@/app/components/date-range-picker';
import { Segmented } from '@/app/components/ui/segmented';
import { FilterChip } from '@/app/components/ui/filter-chip';

export type StatusFilter = 'all' | 'failing';

interface TablePaginationRowProps {
  rowsPerPage: number;
  setRowsPerPage: (rows: number) => void;
  setPage: (page: number) => void;
  project: string;
  onProjectChange: (project: string) => void;
  search: string;
  onSearchChange?: (search: string) => void;
  tags?: string[];
  onTagsChange?: (tags: string[]) => void;
  onDateFromChange?: (date: string) => void;
  onDateToChange?: (date: string) => void;
  dateFrom?: string;
  dateTo?: string;
  rowPerPageOptions?: number[];
  entity: 'report' | 'result';
  statusFilter?: StatusFilter;
  onStatusFilterChange?: (filter: StatusFilter) => void;
}

const defaultRowPerPageOptions = [10, 20, 40];

const STATUS_OPTIONS: { key: StatusFilter; labelKey: 'statusAll' | 'statusFailing' }[] = [
  { key: 'all', labelKey: 'statusAll' },
  { key: 'failing', labelKey: 'statusFailing' },
];

export default function TablePaginationOptions({
  rowsPerPage,
  entity,
  rowPerPageOptions,
  setRowsPerPage,
  setPage,
  project,
  onProjectChange,
  search,
  onSearchChange,
  tags,
  onTagsChange,
  onDateFromChange,
  onDateToChange,
  dateFrom,
  dateTo,
  statusFilter,
  onStatusFilterChange,
}: TablePaginationRowProps) {
  const t = useTranslations('filters');
  const rowPerPageItems = rowPerPageOptions ?? defaultRowPerPageOptions;

  const onRowsPerPageChange = (rows: number) => {
    setRowsPerPage(rows);
    setPage(1);
  };

  return (
    <div className="flex h-[50px] items-center justify-between gap-2 border-b border-divider px-3">
      <div className="flex flex-1 items-center gap-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-default-400"
            size={13}
          />
          <input
            className="h-[30px] w-44 rounded-lg border border-default-200 bg-content1 pl-8 pr-2.5 text-xs text-foreground placeholder:text-default-400 outline-none transition-colors focus:border-primary"
            defaultValue={search}
            placeholder={t('search')}
            type="text"
            onChange={(e: ChangeEvent<HTMLInputElement>) => onSearchChange?.(e.target.value)}
          />
        </div>
        <ProjectSelect entity={entity} value={project} onSelect={onProjectChange} />
        {entity === 'result' && <TagSelect entity={entity} value={tags ?? []} onSelect={onTagsChange} />}
        {(onDateFromChange || onDateToChange) && (
          <DateRangePicker
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={onDateFromChange}
            onDateToChange={onDateToChange}
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        {statusFilter && onStatusFilterChange && (
          <Segmented
            options={STATUS_OPTIONS.map(({ key, labelKey }) => ({ key, label: t(labelKey) }))}
            value={statusFilter}
            onChange={onStatusFilterChange}
          />
        )}
        <FilterChip label={t('rows')} value={rowsPerPage}>
          <div className="flex w-20 flex-col gap-0.5 p-1">
            {rowPerPageItems.map((rows) => (
              <button
                key={rows}
                className={`rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-default-100 ${
                  rows === rowsPerPage ? 'font-semibold text-primary' : 'text-foreground'
                }`}
                type="button"
                onClick={() => onRowsPerPageChange(rows)}
              >
                {rows}
              </button>
            ))}
          </div>
        </FilterChip>
      </div>
    </div>
  );
}
