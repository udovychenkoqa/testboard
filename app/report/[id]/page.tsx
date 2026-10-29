'use client';

import { useEffect, useMemo } from 'react';
import { Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { ChevronDown, Share2, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { PageLoader } from '@/app/components/ui/page-loader';
import {
  VerdictStrip,
  parseStatusFilters,
  serializeStatusFilters,
} from '@/app/components/report-details/verdict-strip';
import { TestList } from '@/app/components/report-details/test-list';
import TestInfo from '@/app/components/report-details/test-info';
import AiReportSummary from '@/app/components/report-details/ai-summary';
import { StatusBadge, outcomeFromStats } from '@/app/components/ui/status-badge';
import useQuery from '@/app/hooks/useQuery';
import { type ReportHistory } from '@/app/lib/storage';
import { withBase } from '@/app/lib/url';

interface ReportDetailProps {
  params: { id: string };
}

function ReportDetail({ params }: Readonly<ReportDetailProps>) {
  const t = useTranslations('report');
  const session = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: report, isLoading: isReportLoading } = useQuery<ReportHistory>(`/api/report/${params.id}`, {
    callback: `/report/${params.id}`,
  });

  const { data: history } = useQuery<ReportHistory[]>(`/api/report/trend?limit=10&project=${report?.project ?? ''}`, {
    dependencies: [report?.reportID],
  });

  const statusFilter = parseStatusFilters(searchParams?.get('status'));
  const selectedTestId = searchParams?.get('test') ?? undefined;

  const setSearchParam = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams?.toString());

    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`?${next.toString()}`, { scroll: false });
  };

  const allTests = useMemo(() => report?.files.flatMap((f) => f.tests) ?? [], [report]);
  const selectedTest = allTests.find((t) => t.testId === selectedTestId) ?? allTests[0];

  // Default to the first failing/flaky test once the report loads, if none picked yet.
  useEffect(() => {
    if (!report || selectedTestId) return;
    const firstFailing = allTests.find((t) => t.outcome === 'unexpected' || t.outcome === 'flaky');

    if (firstFailing) setSearchParam('test', firstFailing.testId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.reportID]);

  if (session.status === 'loading') {
    return <PageLoader />;
  }

  if (!report && isReportLoading) {
    return <PageLoader label={t('loading')} />;
  }

  if (!report) {
    return null;
  }

  const verdict = outcomeFromStats(report.stats);
  const shareUrl = () => {
    navigator.clipboard.writeText(window.location.href).then(() => toast.success(t('linkCopied')));
  };

  return (
    <div className="flex flex-col rr-enter">
      <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-divider px-5">
        <Link className="text-[13px] text-default-400 hover:text-foreground" href="/reports">
          {t('breadcrumb')}
        </Link>
        <span className="text-default-300">/</span>
        <span className="truncate font-mono text-[13px] font-medium">{report.title || report.reportID}</span>
        <StatusBadge outcome={verdict} />

        <div className="ml-auto flex items-center gap-2">
          <Button
            className="h-[30px] min-w-0 px-2.5 text-xs"
            size="sm"
            startContent={<Share2 size={13} />}
            variant="bordered"
            onPress={shareUrl}
          >
            {t('share')}
          </Button>
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button
                className="h-[30px] min-w-0 px-2.5 text-xs"
                endContent={<ChevronDown size={13} />}
                size="sm"
                variant="bordered"
              >
                {t('download')}
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label={t('download')}>
              <DropdownItem key="zip" as="a" href={withBase(`/api/download/${report.reportID}?format=zip`)}>
                HTML (ZIP)
              </DropdownItem>
              <DropdownItem key="pdf" as="a" href={withBase(`/api/download/${report.reportID}?format=pdf`)}>
                PDF
              </DropdownItem>
              <DropdownItem key="evidence" as="a" href={withBase(`/api/download/${report.reportID}?format=evidence`)}>
                {t('evidencePdf')}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
          <Button
            as={Link}
            className="h-[30px] min-w-0 px-2.5 text-xs"
            color="primary"
            endContent={<ExternalLink size={12} />}
            href={withBase(report.reportUrl)}
            size="sm"
            target="_blank"
          >
            {t('openPlaywright')}
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-3 p-5">
        <VerdictStrip
          history={history ?? [report]}
          report={report}
          statusFilter={statusFilter}
          onStatusFilterChange={(f) => setSearchParam('status', serializeStatusFilters(f))}
        />

        <AiReportSummary
          hasFailures={report.stats.unexpected > 0 || report.stats.flaky > 0}
          reportId={report.reportID}
          reportUrl={report.reportUrl}
        />

        <div className="grid h-[640px] grid-cols-1 gap-3 md:grid-cols-[392px_1fr]">
          <TestList
            report={report}
            reportUrl={report.reportUrl}
            selectedTestId={selectedTest?.testId}
            statusFilter={statusFilter}
            onSelectTest={(id) => setSearchParam('test', id)}
          />
          {selectedTest ? (
            <TestInfo history={history ?? []} reportUrl={report.reportUrl} test={selectedTest} />
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-divider bg-content1 text-[12.5px] text-default-400">
              {t('noTestSelected')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReportDetail;
