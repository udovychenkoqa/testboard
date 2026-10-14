'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { type StatusFilter } from './verdict-strip';

import { type ReportHistory } from '@/app/lib/storage';
import { type ReportFile, type ReportTest } from '@/app/lib/parser';
import { filterReportHistory } from '@/app/lib/transformers';
import { statusStyle } from '@/app/lib/tailwind';
import { Segmented } from '@/app/components/ui/segmented';
import { parseMilliseconds } from '@/app/lib/time';
import { withBase } from '@/app/lib/url';

type ViewMode = 'list' | 'file';

const VIEW_OPTIONS: { key: ViewMode; labelKey: 'list' | 'byFile' }[] = [
  { key: 'list', labelKey: 'list' },
  { key: 'file', labelKey: 'byFile' },
];

interface FlatTest {
  test: ReportTest;
  fileName: string;
}

const flatten = (files: ReportFile[]): FlatTest[] =>
  files.flatMap((file) => file.tests.map((test) => ({ test, fileName: file.fileName })));

interface TestRowProps {
  entry: FlatTest;
  isSelected: boolean;
  onSelect: () => void;
}

function TestRow({ entry, isSelected, onSelect }: Readonly<TestRowProps>) {
  const t = useTranslations('report');
  const { test, fileName } = entry;
  const style = statusStyle(test.outcome);
  const attempts = test.results?.length ?? 0;
  const fullTitle = [...test.path, test.title].filter(Boolean).join(' › ');
  const pathLine = [fileName, fullTitle].filter(Boolean).join(' › ');
  const meta = [
    `${test.location.line}:${test.location.column}`,
    test.projectName,
    attempts > 1 ? t('test.retry', { n: attempts - 1 }) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      className={`flex w-full items-start gap-2 border-b border-divider px-3 py-[9px] text-left transition-colors ${
        isSelected
          ? 'border-l-2 border-l-primary bg-default-100'
          : 'border-l-2 border-l-transparent hover:bg-default-50'
      }`}
      title={pathLine}
      type="button"
      onClick={onSelect}
    >
      <span className="mt-1.25 h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: style.hex }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium">{fullTitle}</p>
        <p className="truncate font-mono text-[10.5px] text-default-400">{meta}</p>
      </div>
      <span className="shrink-0 font-mono text-[10.5px] text-default-400 tabular-nums">
        {parseMilliseconds(test.duration)}
      </span>
    </button>
  );
}

interface TestListProps {
  report: ReportHistory;
  reportUrl?: string;
  statusFilter: StatusFilter[];
  selectedTestId?: string;
  onSelectTest: (testId: string) => void;
}

export function TestList({ report, reportUrl, statusFilter, selectedTestId, onSelectTest }: Readonly<TestListProps>) {
  const t = useTranslations('report');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const filtered = useMemo(
    () => filterReportHistory(report, { name: search, outcomes: statusFilter.length ? statusFilter : undefined }),
    [report, search, statusFilter],
  );

  const flatTests = useMemo(() => flatten(filtered.files), [filtered.files]);

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (!flatTests.length) return;
    const currentIndex = flatTests.findIndex((f) => f.test.testId === selectedTestId);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      onSelectTest(
        flatTests[Math.min(currentIndex + 1, flatTests.length - 1)]?.test.testId ?? flatTests[0].test.testId,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onSelectTest(flatTests[Math.max(currentIndex - 1, 0)]?.test.testId ?? flatTests[0].test.testId);
    } else if (e.key === 'Enter' && reportUrl) {
      e.preventDefault();
      const testId = selectedTestId ?? flatTests[0]?.test.testId;

      if (testId) window.open(`${withBase(reportUrl)}#?testId=${testId}`, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-xl border border-divider bg-content1"
      role="listbox"
      tabIndex={0}
      onKeyDown={onListKeyDown}
    >
      <div className="flex flex-col gap-2 border-b border-divider p-2.5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-default-400"
            size={13}
          />
          <input
            ref={inputRef}
            className="h-[30px] w-full rounded-lg border border-default-200 bg-content2 pl-8 pr-8 text-[12.5px] outline-none focus:border-primary"
            placeholder={t('list.filter')}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-default-200 px-1 font-mono text-[10px] text-default-400">
            /
          </kbd>
        </div>
        <div className="flex items-center justify-between">
          <Segmented
            options={VIEW_OPTIONS.map(({ key, labelKey }) => ({ key, label: t(`list.${labelKey}`) }))}
            value={viewMode}
            onChange={setViewMode}
          />
          <span className="font-mono text-[11px] text-default-400">
            {filtered.testCount} / {filtered.totalTestCount}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {flatTests.length === 0 && (
          <p className="p-4 text-center text-[12.5px] text-default-400">
            {search ? t('list.noMatchSearch', { search }) : t('list.noMatch')}
          </p>
        )}

        {viewMode === 'list'
          ? flatTests.map((entry) => (
              <TestRow
                key={entry.test.testId}
                entry={entry}
                isSelected={entry.test.testId === selectedTestId}
                onSelect={() => onSelectTest(entry.test.testId)}
              />
            ))
          : filtered.files.map((file) => (
              <div key={file.fileId}>
                <div className="sticky top-0 flex items-center justify-between border-b border-divider bg-content2 px-3 py-1.5">
                  <span className="truncate font-mono text-[11px] text-default-500">{file.fileName}</span>
                  <span className="font-mono text-[11px] text-default-500">{file.tests.length}</span>
                </div>
                {file.tests.map((test) => (
                  <TestRow
                    key={test.testId}
                    entry={{ test, fileName: file.fileName }}
                    isSelected={test.testId === selectedTestId}
                    onSelect={() => onSelectTest(test.testId)}
                  />
                ))}
              </div>
            ))}
      </div>
    </div>
  );
}
