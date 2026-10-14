'use client';

import { useCallback, useState, useMemo } from 'react';
import { Button, Checkbox, Pagination, type SortDescriptor } from '@heroui/react';
import { keepPreviousData } from '@tanstack/react-query';
import { FileBarChart, SearchX } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { withQueryParams } from '@/app/lib/network';
import { defaultProjectName } from '@/app/lib/constants';
import TablePaginationOptions from '@/app/components/table-pagination-options';
import useQuery from '@/app/hooks/useQuery';
import FormattedDate from '@/app/components/date-format';
import { ReadResultsOutput, type Result } from '@/app/lib/storage';
import { useDeleteResults } from '@/app/components/delete-results-button';
import { DataGrid, GridRow, type GridColumn } from '@/app/components/ui/data-grid';
import { GridSkeleton } from '@/app/components/ui/skeletons';
import { EmptyState } from '@/app/components/ui/empty-state';
import { DeleteIcon } from '@/app/components/icons';

const notMetadataKeys = ['resultID', 'title', 'createdAt', 'size', 'sizeBytes', 'project'];

// resultDetails values are typed as strings, but some upstream sender (most
// likely Playwright's own blob-report metadata for parallel workers, not
// anything our reporter config sets — e.g. "machines") can hand us a
// JSON-stringified array/object instead of a plain value. Rendered verbatim
// as a chip that's an unreadable wall of text — just hide those rather than
// try to pretty-print structured data inside a tag pill.
const looksLikeJsonBlob = (value: unknown): boolean => {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();

  return trimmed.startsWith('[') || trimmed.startsWith('{');
};

const getTags = (item: Result) =>
  Object.entries(item).filter(([key, value]) => !notMetadataKeys.includes(key) && !looksLikeJsonBlob(value));

const RESULTS_TEMPLATE = '36px minmax(0,1fr) 120px 130px minmax(0,1.3fr) 78px 44px';

interface ResultRowProps {
  item: Result;
  isSelected: boolean;
  onToggle: () => void;
  onDeleted: () => void;
}

function ResultRow({ item, isSelected, onToggle, onDeleted }: Readonly<ResultRowProps>) {
  const t = useTranslations('results');
  const {
    open: openDelete,
    isPending: isDeleting,
    modal: deleteModal,
  } = useDeleteResults({ resultIds: [item.resultID], onDeletedResult: onDeleted });

  return (
    <GridRow className="h-[46px]" template={RESULTS_TEMPLATE}>
      <Checkbox isSelected={isSelected} size="sm" onValueChange={onToggle} />
      <p className="min-w-0 truncate font-mono text-[12.5px] pr-3">{item.title ?? item.resultID}</p>
      <div className="truncate text-[12.5px] text-default-600 pr-3">{item.project || '—'}</div>
      <div className="font-mono text-[11.5px] text-default-500 tabular-nums pr-3">
        <FormattedDate date={new Date(item.createdAt)} />
      </div>
      <div className="flex flex-wrap gap-1 py-1 pr-3">
        {getTags(item).map(([key, value], index) => (
          <span
            key={`${key}-${index}`}
            className="rounded-md bg-default-100 px-1.5 py-0.5 font-mono text-[10.5px] text-default-600"
          >
            {key}: {value}
          </span>
        ))}
      </div>
      <div className="font-mono text-[11.5px] text-default-500 tabular-nums text-right pr-3">{item.size}</div>
      <button
        aria-label={t('deleteOne')}
        className="flex h-[26px] w-[26px] items-center justify-center rounded-lg text-default-400 transition-colors hover:bg-danger-50 hover:text-danger"
        disabled={isDeleting}
        type="button"
        onClick={openDelete}
      >
        <DeleteIcon size={16} />
      </button>
      {deleteModal}
    </GridRow>
  );
}

interface ResultsTableProps {
  selected?: string[];
  onSelect?: (results: Result[]) => void;
  onDeleted?: () => void;
}

export default function ResultsTable({ onSelect, onDeleted, selected }: Readonly<ResultsTableProps>) {
  const t = useTranslations('results');
  const tc = useTranslations('common');
  const resultListEndpoint = '/api/result/list';
  const [project, setProject] = useState(defaultProjectName);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'createdAt',
    direction: 'descending',
  });

  const getQueryParams = () => ({
    limit: rowsPerPage.toString(),
    offset: ((page - 1) * rowsPerPage).toString(),
    project,
    order: sortDescriptor.direction === 'ascending' ? 'asc' : 'desc',
    sortBy: String(sortDescriptor.column ?? 'createdAt'),
    ...(selectedTags.length > 0 && { tags: selectedTags.join(',') }),
    ...(search.trim() && { search: search.trim() }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  });

  const {
    data: resultsResponse,
    isPending,
    refetch,
  } = useQuery<ReadResultsOutput>(withQueryParams(resultListEndpoint, getQueryParams()), {
    dependencies: [
      project,
      selectedTags,
      search,
      dateFrom,
      dateTo,
      rowsPerPage,
      page,
      sortDescriptor.direction,
      sortDescriptor.column,
    ],
    placeholderData: keepPreviousData,
  });

  const { results, total } = resultsResponse ?? {};

  const handleDeleted = () => {
    onDeleted?.();
    refetch();
  };

  const onPageChange = useCallback((page: number) => {
    setPage(page);
  }, []);

  const onProjectChange = useCallback((project: string) => {
    setProject(project);
    setPage(1);
  }, []);

  const onTagsChange = useCallback((tags: string[]) => {
    setSelectedTags(tags);
    setPage(1);
  }, []);

  const onSearchChange = useCallback((searchTerm: string) => {
    setSearch(searchTerm);
    setPage(1);
  }, []);

  const onDateFromChange = useCallback((date: string) => {
    setDateFrom(date);
    setPage(1);
  }, []);

  const onDateToChange = useCallback((date: string) => {
    setDateTo(date);
    setPage(1);
  }, []);

  const onSortChange = useCallback((descriptor: SortDescriptor) => {
    setSortDescriptor(descriptor);
    setPage(1);
  }, []);

  // The search box is uncontrolled (defaultValue), so clearing remounts the
  // filter bar via this key to empty it too.
  const [filtersKey, setFiltersKey] = useState(0);
  const hasFilters =
    project !== defaultProjectName || selectedTags.length > 0 || !!search.trim() || !!dateFrom || !!dateTo;

  const clearFilters = useCallback(() => {
    setProject(defaultProjectName);
    setSelectedTags([]);
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    setFiltersKey((k) => k + 1);
  }, []);

  const handleSort = (key: string) => {
    const direction =
      sortDescriptor.column === key && sortDescriptor.direction === 'descending' ? 'ascending' : 'descending';

    onSortChange({ column: key, direction });
  };

  const pages = useMemo(() => (total ? Math.ceil(total / rowsPerPage) : 0), [total, rowsPerPage]);

  const list = results ?? [];
  const selectedSet = new Set(selected ?? []);
  const allSelected = list.length > 0 && list.every((r) => selectedSet.has(r.resultID));

  const toggleRow = (result: Result) => {
    const next = new Set(selectedSet);

    next.has(result.resultID) ? next.delete(result.resultID) : next.add(result.resultID);
    onSelect?.(list.filter((r) => next.has(r.resultID)));
  };

  const toggleAll = () => onSelect?.(allSelected ? [] : list);

  const gridColumns: GridColumn[] = [
    { key: 'select', label: <Checkbox isSelected={allSelected} size="sm" onValueChange={toggleAll} /> },
    { key: 'title', label: t('columns.result'), sortable: true },
    { key: 'project', label: t('columns.project'), sortable: true },
    { key: 'createdAt', label: t('columns.created'), sortable: true },
    { key: 'tags', label: t('columns.tags') },
    { key: 'size', label: t('columns.size'), sortable: true, align: 'end' },
    { key: 'actions', label: '' },
  ];

  return (
    <>
      <TablePaginationOptions
        key={filtersKey}
        dateFrom={dateFrom}
        dateTo={dateTo}
        entity="result"
        project={project}
        rowPerPageOptions={[10, 20, 40, 80, 120]}
        rowsPerPage={rowsPerPage}
        search={search}
        setPage={setPage}
        setRowsPerPage={setRowsPerPage}
        tags={selectedTags}
        onDateFromChange={onDateFromChange}
        onDateToChange={onDateToChange}
        onProjectChange={onProjectChange}
        onSearchChange={onSearchChange}
        onTagsChange={onTagsChange}
      />

      {isPending ? (
        <GridSkeleton rowHeight={46} rows={rowsPerPage > 10 ? 10 : rowsPerPage} />
      ) : list.length === 0 ? (
        hasFilters ? (
          <EmptyState
            action={
              <Button size="sm" variant="bordered" onPress={clearFilters}>
                {tc('clearFilters')}
              </Button>
            }
            description={t('empty.noMatchDescription')}
            icon={SearchX}
            title={t('empty.noMatchTitle')}
          />
        ) : (
          <EmptyState
            description={t('empty.noResultsDescription')}
            icon={FileBarChart}
            title={t('empty.noResultsTitle')}
          />
        )
      ) : (
        <DataGrid
          columns={gridColumns}
          sortColumn={String(sortDescriptor.column ?? '')}
          sortDirection={sortDescriptor.direction}
          template={RESULTS_TEMPLATE}
          onSort={handleSort}
        >
          {list.map((item) => (
            <ResultRow
              key={item.resultID}
              isSelected={selectedSet.has(item.resultID)}
              item={item}
              onDeleted={handleDeleted}
              onToggle={() => toggleRow(item)}
            />
          ))}
        </DataGrid>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-divider">
          <span className="font-mono text-[11.5px] text-default-500 tabular-nums">
            {(page - 1) * rowsPerPage + 1}–{Math.min(page * rowsPerPage, total ?? 0)} of {total}
          </span>
          <Pagination isCompact showControls color="primary" page={page} total={pages} onChange={onPageChange} />
        </div>
      )}
    </>
  );
}
