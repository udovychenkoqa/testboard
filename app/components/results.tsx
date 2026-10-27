'use client';

import { useState } from 'react';
import { Button } from '@heroui/react';
import { useTranslations } from 'next-intl';

import { type Result, type ServerDataInfo } from '@/app/lib/storage';
import ResultsTable from '@/app/components/results-table';
import { PageHeader } from '@/app/components/page-header';
import GenerateReportButton from '@/app/components/generate-report-button';
import DeleteResultsButton from '@/app/components/delete-results-button';
import UploadResultsButton from '@/app/components/upload-results-button';
import { getUniqueProjectsList } from '@/app/lib/storage/format';

interface ResultsProps {
  onChange: () => void;
  info?: ServerDataInfo;
}

export default function Results({ onChange, info }: Readonly<ResultsProps>) {
  const t = useTranslations('results');
  const [selectedResults, setSelectedResults] = useState<Result[]>([]);

  const selectedResultIds = selectedResults.map((r) => r.resultID);
  const projects = getUniqueProjectsList(selectedResults);

  const onListUpdate = () => {
    setSelectedResults([]);
    onChange?.();
  };

  return (
    <div className="flex flex-col rr-enter">
      <PageHeader
        actions={<UploadResultsButton onUploadedResult={onListUpdate} />}
        subtitle={info ? t('total', { count: info.numOfResults, size: info.resultsFolderSizeinMB }) : undefined}
        title={t('title')}
      />

      {selectedResults.length > 0 && (
        <div className="flex items-center gap-3 px-5 py-2 border-b border-divider bg-content2">
          <span className="text-sm font-medium text-primary tabular-nums">
            {t('selected', { count: selectedResults.length })}
          </span>
          <Button size="sm" variant="light" onPress={() => setSelectedResults([])}>
            {t('deselect')}
          </Button>
          <GenerateReportButton projects={projects} results={selectedResults} onGeneratedReport={onListUpdate} />
          <DeleteResultsButton label={t('delete')} resultIds={selectedResultIds} onDeletedResult={onListUpdate} />
        </div>
      )}

      <ResultsTable selected={selectedResultIds} onDeleted={onListUpdate} onSelect={setSelectedResults} />
    </div>
  );
}
