'use client';

import { useState } from 'react';
import { Button } from '@heroui/react';
import Link from 'next/link';
import { Play } from 'lucide-react';
import { useTranslations } from 'next-intl';

import ReportsTable from '@/app/components/reports-table';
import { PageHeader } from '@/app/components/page-header';
import DeleteReportButton from '@/app/components/delete-report-button';
import { type ReportHistory, type ServerDataInfo } from '@/app/lib/storage';

interface ReportsProps {
  onChange: () => void;
  info?: ServerDataInfo;
}

export default function Reports({ onChange, info }: ReportsProps) {
  const t = useTranslations('reports');
  const [selectedReports, setSelectedReports] = useState<ReportHistory[]>([]);

  const selectedReportIds = selectedReports.map((r) => r.reportID);

  const onListUpdate = () => {
    setSelectedReports([]);
    onChange?.();
  };

  return (
    <div className="flex flex-col rr-enter">
      <PageHeader
        actions={
          <Button
            as={Link}
            className="h-[30px] px-2.5 text-xs font-semibold"
            color="primary"
            href="/run-tests"
            size="sm"
            startContent={<Play size={14} />}
          >
            {t('runTests')}
          </Button>
        }
        subtitle={info ? t('total', { count: info.numOfReports, size: info.reportsFolderSizeinMB }) : undefined}
        title={t('title')}
      />

      {selectedReports.length > 0 && (
        <div className="flex items-center gap-3 px-5 py-2 border-b border-divider bg-content2">
          <span className="text-sm font-medium text-primary tabular-nums">
            {t('selected', { count: selectedReports.length })}
          </span>
          <Button size="sm" variant="light" onPress={() => setSelectedReports([])}>
            {t('deselect')}
          </Button>
          <DeleteReportButton label={t('actions.delete')} reportIds={selectedReportIds} onDeleted={onListUpdate} />
        </div>
      )}

      <ReportsTable
        selected={selectedReportIds}
        onChange={onChange}
        onDeleted={onListUpdate}
        onSelect={setSelectedReports}
      />
    </div>
  );
}
