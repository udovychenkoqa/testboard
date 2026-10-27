'use client';

import { Fragment, useCallback, useState, useMemo } from 'react';
import {
  Button,
  Pagination,
  Checkbox,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  type SortDescriptor,
} from '@heroui/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData } from '@tanstack/react-query';
import { MoreHorizontal, FileText, SearchX, CircleCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { withBase } from '../lib/url';

import TablePaginationOptions, { type StatusFilter } from './table-pagination-options';

import { withQueryParams } from '@/app/lib/network';
import { defaultProjectName } from '@/app/lib/constants';
import { dayKey, formatDayHeading } from '@/i18n/dates';
import { passRateColor, STATUS_COLORS } from '@/app/lib/tailwind';
import useQuery from '@/app/hooks/useQuery';
import { useDeleteReport } from '@/app/components/delete-report-button';
import FormattedDate, { useDateLabels } from '@/app/components/date-format';
import { DataGrid, GridRow, type GridColumn } from '@/app/components/ui/data-grid';
import { StatBar } from '@/app/components/ui/stat-bar';
import { GridSkeleton } from '@/app/components/ui/skeletons';
import { EmptyState } from '@/app/components/ui/empty-state';
import { ReadReportsHistory, ReportHistory } from '@/app/lib/storage';
import { getReportMetaChips } from '@/app/lib/transformers';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

interface RowMeta {
  title: string;
  // true when nothing better than the report ID was available
  isIdTitle: boolean;
  env?: string;
  user?: string;
  workers?: number;
  chips: string[];
}

// What a row shows: a human title (CI title → "funnel · env" → report ID),
// env and author pulled out for their own chips, then duration, workers and
// whatever other custom CI fields remain. Playwright version is left to the
// report page — identical on every row, it's just noise here.
const reportRowMeta = (item: ReportHistory): RowMeta => {
  const extra = item as ReportHistory & Record<string, unknown>;
  const env = str(extra.environment) ?? str(extra.env);
  const funnel = str(extra.funnel);
  const user = str(extra.username) ?? str(extra.user) ?? str(extra.author);
  const ciTitle = str(item.title);
  const hasCiTitle = !!ciTitle && ciTitle !== item.reportID && !UUID_RE.test(ciTitle);
  const title = hasCiTitle ? ciTitle : [funnel, env].filter(Boolean).join(' · ') || item.reportID;

  const shownElsewhere = new Set(['environment', 'env', 'username', 'user', 'author', 'playwright', 'workers']);

  if (!hasCiTitle && funnel) shownElsewhere.add('funnel');

  return {
    title,
    isIdTitle: title === item.reportID,
    env,
    user,
    workers: item.metadata?.actualWorkers || undefined,
    chips: [
      item.duration ? `${(item.duration / 1000).toFixed(1)}s` : '',
      ...getReportMetaChips(item)
        .filter((c) => !shownElsewhere.has(c.key))
        .map((c) => c.label),
    ].filter(Boolean),
  };
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

// "Anton Udovychenko" → "Anton U."
const shortName = (name: string) => {
  const [first, ...rest] = name.split(/\s+/);

  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
};

const MetaChip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-default-100 px-1.5 py-px text-[11px] text-default-500">
    {children}
  </span>
);

// Day separator inside the grid; counts cover the rows on this page only.
const DayHeader: React.FC<{ date: Date | string; runs: ReportHistory[] }> = ({ date, runs }) => {
  const failed = runs.filter((r) => r.stats.unexpected > 0).length;
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const { intl, heading } = useDateLabels();

  return (
    <div className="flex items-center justify-between border-b border-divider bg-background px-4 py-1.5 text-[11.5px]">
      <span className="font-semibold text-default-600">{formatDayHeading(new Date(date), intl, heading)}</span>
      <span className="text-default-500">
        {tc('runs', { count: runs.length })} ·{' '}
        {failed ? (
          <span className="text-danger">{t('dayFailed', { count: failed })}</span>
        ) : (
          <span className="text-success">{t('allPassed')}</span>
        )}
      </span>
    </div>
  );
};

interface ReportRowProps {
  item: ReportHistory;
  isSelected: boolean;
  onToggle: () => void;
  onDeleted: () => void;
  template: string;
  showProject: boolean;
}

function ReportRow({ item, isSelected, onToggle, onDeleted, template, showProject }: Readonly<ReportRowProps>) {
  const t = useTranslations('reports');
  const router = useRouter();
  const {
    open: openDelete,
    isPending: isDeleting,
    modal: deleteModal,
  } = useDeleteReport({
    reportId: item.reportID,
    onDeleted,
  });

  const executed = item.stats.expected + item.stats.unexpected + item.stats.flaky;
  const passRate = executed > 0 ? Math.round((item.stats.expected / executed) * 100) : 0;
  const meta = reportRowMeta(item);
  const counts = [
    t('counts.passed', { count: item.stats.expected }),
    item.stats.unexpected ? (
      <span className="text-danger">{t('counts.failed', { count: item.stats.unexpected })}</span>
    ) : null,
    item.stats.flaky ? <span className="text-warning">{t('counts.flaky', { count: item.stats.flaky })}</span> : null,
    item.stats.skipped ? t('counts.skipped', { count: item.stats.skipped }) : null,
  ].filter(Boolean);

  return (
    <GridRow
      accent={executed > 0 ? passRateColor(passRate) : STATUS_COLORS.skipped}
      className="rr-row group min-h-[56px] py-2"
      template={template}
      onClick={() => router.push(withBase(`/report/${item.reportID}`))}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div role="presentation" onClick={(e) => e.stopPropagation()}>
        <Checkbox isSelected={isSelected} size="sm" onValueChange={onToggle} />
      </div>
      <div className="min-w-0 pr-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <p
            className={`truncate text-[13px] ${meta.isIdTitle ? 'font-mono font-medium' : 'font-semibold'}`}
            title={meta.title}
          >
            {meta.title}
          </p>
          {!meta.isIdTitle && (
            <span className="shrink-0 font-mono text-[11px] text-default-400" title={item.reportID}>
              {item.reportID.slice(0, 8)}
            </span>
          )}
        </div>
        {(meta.env || meta.user || meta.workers || meta.chips.length > 0) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {meta.env && (
              <MetaChip>
                {t('env')} <b className="font-semibold text-foreground">{meta.env}</b>
              </MetaChip>
            )}
            {meta.chips.map((chip) => (
              <MetaChip key={chip}>{chip}</MetaChip>
            ))}
            {meta.workers && <MetaChip>{t('workers', { count: meta.workers })}</MetaChip>}
            {meta.user && (
              <MetaChip>
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                  {initials(meta.user)}
                </span>
                <span title={meta.user}>{shortName(meta.user)}</span>
              </MetaChip>
            )}
          </div>
        )}
      </div>
      <div className="flex min-w-0 max-w-[440px] flex-col gap-1.5 pr-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 font-mono text-[13px] font-semibold" style={{ color: passRateColor(passRate) }}>
            {executed > 0 ? `${passRate}%` : '—'}
          </span>
          <span className="truncate text-[11px] text-default-500">
            {executed > 0
              ? counts.map((c, i) => (
                  <span key={i}>
                    {i > 0 && ' · '}
                    {c}
                  </span>
                ))
              : t('allSkipped')}
          </span>
        </div>
        <StatBar executedOnly height={5} stats={item.stats} />
      </div>
      {showProject && <div className="text-[12.5px] text-default-600 truncate pr-3">{item.project || '—'}</div>}
      <div className="font-mono text-[12px] text-default-500 tabular-nums pr-3">
        <FormattedDate relativeDay date={item.createdAt} />
      </div>
      <div className="font-mono text-[11.5px] text-default-400 tabular-nums text-right">{item.size}</div>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        className="flex items-center justify-end text-default-400 transition-colors group-hover:text-foreground"
        role="presentation"
        onClick={(e) => e.stopPropagation()}
      >
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <Button
              isIconOnly
              aria-label={t('actions.more')}
              className="h-[26px] w-[26px] min-w-0 text-inherit"
              size="sm"
              variant="light"
            >
              <MoreHorizontal size={16} />
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label={t('actions.menu')} disabledKeys={isDeleting ? ['delete'] : []}>
            <DropdownItem key="pw" as={Link} href={withBase(item.reportUrl)} target="_blank">
              {t('actions.openPlaywright')}
            </DropdownItem>
            <DropdownItem key="zip" as="a" href={withBase(`/api/download/${item.reportID}?format=zip`)}>
              {t('actions.downloadZip')}
            </DropdownItem>
            <DropdownItem key="pdf" as="a" href={withBase(`/api/download/${item.reportID}?format=pdf`)}>
              {t('actions.exportPdf')}
            </DropdownItem>
            <DropdownItem key="evidence" as="a" href={withBase(`/api/download/${item.reportID}?format=evidence`)}>
              {t('actions.evidencePdf')}
            </DropdownItem>
            <DropdownItem key="delete" className="text-danger" color="danger" onPress={openDelete}>
              {t('actions.delete')}
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
      {deleteModal}
    </GridRow>
  );
}

// Run column is capped so Outcome sits right next to it; spare width goes to
// Outcome (whose content is itself capped) rather than opening a gap between them.
const REPORTS_TEMPLATE = '36px minmax(280px,560px) minmax(240px,1fr) 150px 132px 78px 44px';
const REPORTS_TEMPLATE_NO_PROJECT = '36px minmax(280px,560px) minmax(240px,1fr) 132px 78px 44px';

interface ReportsTableProps {
  onChange: () => void;
  selected?: string[];
  onSelect?: (reports: ReportHistory[]) => void;
  onDeleted?: () => void;
}

export default function ReportsTable({ onChange, selected, onSelect, onDeleted }: Readonly<ReportsTableProps>) {
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const reportListEndpoint = '/api/report/list';
  const [project, setProject] = useState(defaultProjectName);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
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
    ...(search.trim() && { search: search.trim() }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  });

  const {
    data: reportResponse,
    isPending,
    refetch,
  } = useQuery<ReadReportsHistory>(withQueryParams(reportListEndpoint, getQueryParams()), {
    dependencies: [
      project,
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

  const { reports, total } = reportResponse ?? {};

  const handleDeleted = () => {
    onDeleted?.();
    onChange?.();
    refetch();
  };

  const onPageChange = useCallback(
    (page: number) => {
      setPage(page);
    },
    [page, rowsPerPage],
  );

  const onProjectChange = useCallback(
    (project: string) => {
      setProject(project);
      setPage(1);
    },
    [page, rowsPerPage],
  );

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
  const hasFilters = project !== defaultProjectName || !!search.trim() || !!dateFrom || !!dateTo;

  const clearFilters = useCallback(() => {
    setProject(defaultProjectName);
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('all');
    setPage(1);
    setFiltersKey((k) => k + 1);
  }, []);

  const pages = useMemo(() => {
    return total ? Math.ceil(total / rowsPerPage) : 0;
  }, [project, total, rowsPerPage]);

  const fetchedList = reports ?? [];
  // No backend field for "failing" — client-side filter over the current page.
  const list = statusFilter === 'failing' ? fetchedList.filter((r) => r.stats.unexpected > 0) : fetchedList;
  const selectedSet = new Set(selected ?? []);
  const allSelected = list.length > 0 && list.every((r) => selectedSet.has(r.reportID));

  const toggleRow = (report: ReportHistory) => {
    const next = new Set(selectedSet);

    next.has(report.reportID) ? next.delete(report.reportID) : next.add(report.reportID);
    onSelect?.(list.filter((r) => next.has(r.reportID)));
  };

  const toggleAll = () => onSelect?.(allSelected ? [] : list);

  const handleSort = (key: string) => {
    const direction =
      sortDescriptor.column === key && sortDescriptor.direction === 'descending' ? 'ascending' : 'descending';

    onSortChange({ column: key, direction });
  };

  // Hide the Project column when no report on the page has one.
  const showProject = list.some((r) => !!r.project);
  const template = showProject ? REPORTS_TEMPLATE : REPORTS_TEMPLATE_NO_PROJECT;
  // Day separators only make sense while rows are in date order.
  const grouped = sortDescriptor.column === 'createdAt';

  const gridColumns: GridColumn[] = [
    { key: 'select', label: <Checkbox isSelected={allSelected} size="sm" onValueChange={toggleAll} /> },
    { key: 'title', label: t('columns.run'), sortable: true },
    { key: 'passRate', label: t('columns.outcome'), sortable: true },
    ...(showProject ? [{ key: 'project', label: t('columns.project'), sortable: true }] : []),
    { key: 'createdAt', label: t('columns.created'), sortable: true },
    { key: 'size', label: t('columns.size'), sortable: true, align: 'end' },
    { key: 'actions', label: '', align: 'end' },
  ];

  return (
    <div className="flex flex-col">
      <TablePaginationOptions
        key={filtersKey}
        dateFrom={dateFrom}
        dateTo={dateTo}
        entity="report"
        project={project}
        rowPerPageOptions={undefined}
        rowsPerPage={rowsPerPage}
        search={search}
        setPage={setPage}
        setRowsPerPage={setRowsPerPage}
        statusFilter={statusFilter}
        onDateFromChange={onDateFromChange}
        onDateToChange={onDateToChange}
        onProjectChange={onProjectChange}
        onSearchChange={onSearchChange}
        onStatusFilterChange={setStatusFilter}
      />

      {isPending ? (
        <GridSkeleton rowHeight={52} rows={rowsPerPage > 10 ? 10 : rowsPerPage} />
      ) : list.length === 0 ? (
        statusFilter === 'failing' && fetchedList.length > 0 ? (
          <EmptyState
            action={
              <Button size="sm" variant="bordered" onPress={() => setStatusFilter('all')}>
                {t('empty.showAll')}
              </Button>
            }
            description={t('empty.noFailingDescription')}
            icon={CircleCheck}
            title={t('empty.noFailingTitle')}
            tone="success"
          />
        ) : hasFilters || statusFilter === 'failing' ? (
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
            action={
              <Button as={Link} color="primary" href={withBase('/results')} size="sm">
                {t('empty.goToResults')}
              </Button>
            }
            description={t('empty.noReportsDescription')}
            icon={FileText}
            title={t('empty.noReportsTitle')}
          />
        )
      ) : (
        <DataGrid
          columns={gridColumns}
          sortColumn={String(sortDescriptor.column ?? '')}
          sortDirection={sortDescriptor.direction}
          template={template}
          onSort={handleSort}
        >
          {list.map((item, index) => {
            const startsDay = grouped && (index === 0 || dayKey(list[index - 1].createdAt) !== dayKey(item.createdAt));

            return (
              <Fragment key={item.reportID}>
                {startsDay && (
                  <DayHeader
                    date={item.createdAt}
                    runs={list.filter((r) => dayKey(r.createdAt) === dayKey(item.createdAt))}
                  />
                )}
                <ReportRow
                  isSelected={selectedSet.has(item.reportID)}
                  item={item}
                  showProject={showProject}
                  template={template}
                  onDeleted={handleDeleted}
                  onToggle={() => toggleRow(item)}
                />
              </Fragment>
            );
          })}
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
    </div>
  );
}
