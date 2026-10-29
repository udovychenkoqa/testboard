'use client';

import { FC, useEffect, useState } from 'react';
import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal, ModalBody, ModalContent, Spinner, useDisclosure } from '@heroui/react';
import { useTranslations } from 'next-intl';

import FormattedDate from '../date-format';

import { parseMilliseconds } from '@/app/lib/time';
import { type TestHistory, type ReportHistory } from '@/app/lib/storage';
import { type ReportTest } from '@/app/lib/parser/types';
import { STATUS_KEYS, statusStyle } from '@/app/lib/tailwind';
import { StatusBadge } from '@/app/components/ui/status-badge';
import { SparkSquares } from '@/app/components/ui/sparkline';
import { withBase } from '@/app/lib/url';

interface TestInfoProps {
  history: ReportHistory[];
  test: ReportTest;
  reportUrl?: string;
}

interface Screenshot {
  name: string;
  url: string;
}

interface TextAttachment {
  name: string;
  url: string;
}

// Підтягує текстовий attachment (AI-аналіз, діагностика, статистика) і
// показує його читабельним блоком прямо в деталях тесту.
const TextAttachmentView: FC<{ attachment: TextAttachment }> = ({ attachment }) => {
  const t = useTranslations('report');
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(attachment.url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((text) => !cancelled && setContent(text))
      .catch(() => !cancelled && setError(true));

    return () => {
      cancelled = true;
    };
  }, [attachment.url]);

  if (error) {
    return <p className="text-xs text-danger">{t('test.loadFailed', { name: attachment.name })}</p>;
  }

  if (content === null) {
    return <Spinner size="sm" />;
  }

  return (
    <pre className="whitespace-pre-wrap break-words rounded-lg bg-default-100 p-3 font-mono text-[11.5px]">
      {content}
    </pre>
  );
};

const getTestHistory = (testId: string, history: ReportHistory[]) => {
  return history
    .map((report) => {
      const file = report?.files?.find((file) => file.tests.some((test) => test.testId === testId));

      if (!file) {
        return;
      }

      const test = file.tests.find((test) => test.testId === testId);

      if (!test) {
        return;
      }

      return {
        ...test,
        createdAt: report.createdAt,
        reportID: report.reportID,
        reportUrl: report.reportUrl,
      };
    })
    .filter(Boolean) as unknown as TestHistory[];
};

const getScreenshots = (test: ReportTest, reportUrl?: string): Screenshot[] => {
  if (!reportUrl) {
    return [];
  }

  // reportUrl: /api/serve/{project}/{id}/index.html → база для статичних файлів
  const base = reportUrl.replace(/index\.html$/, '');

  return (test.results ?? [])
    .flatMap((result) => result.attachments ?? [])
    .filter((attachment) => attachment.contentType?.startsWith('image/') && attachment.path)
    .map((attachment) => ({
      name: attachment.name,
      url: withBase(`${base}${attachment.path.replace(/^\//, '')}`),
    }));
};

const getTextAttachments = (test: ReportTest, reportUrl?: string): TextAttachment[] => {
  if (!reportUrl) {
    return [];
  }

  const base = reportUrl.replace(/index\.html$/, '');

  // Авто-attachment Playwright "error-context" (markdown з інструкцією для AI на
  // падінні) шумить у галереї — ховаємо його, лишаємо тільки наші нотатки/аналіз.
  const isNoise = (name: string) => /^error-context/i.test(name) || name === 'error-context.md';

  return (test.results ?? [])
    .flatMap((result) => result.attachments ?? [])
    .filter(
      (attachment) =>
        attachment.path &&
        !isNoise(attachment.name) &&
        (attachment.contentType?.startsWith('text/') || attachment.contentType === 'application/json'),
    )
    .map((attachment) => ({
      name: attachment.name,
      url: withBase(`${base}${attachment.path.replace(/^\//, '')}`),
    }));
};

const SectionLabel: FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[10px] uppercase tracking-[.12em] text-default-400">{children}</p>
);

export const TestInfo: FC<TestInfoProps> = ({ test, history, reportUrl }: TestInfoProps) => {
  const t = useTranslations('report');
  const ts = useTranslations('status');
  const testHistory = getTestHistory(test.testId, history);
  const screenshots = getScreenshots(test, reportUrl);
  const textAttachments = getTextAttachments(test, reportUrl);
  const attempts = test.results?.length ?? 0;

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const openScreenshot = (index: number) => {
    setActiveIndex(index);
    onOpen();
  };

  const showPrev = () => setActiveIndex((i) => (i === null ? i : (i - 1 + screenshots.length) % screenshots.length));
  const showNext = () => setActiveIndex((i) => (i === null ? i : (i + 1) % screenshots.length));

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') showPrev();
      else if (e.key === 'ArrowRight') showNext();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, screenshots.length]);

  const active = activeIndex !== null ? screenshots[activeIndex] : null;

  // Newest-first history → last 10 squares oldest→newest, colored by this
  // test's outcome in that run (grey if the test didn't run that time).
  const squareColors = [...testHistory]
    .reverse()
    .slice(-10)
    .map((h) => statusStyle(h.outcome).hex);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-divider bg-content1">
      <div className="flex flex-col gap-1.5 border-b border-divider p-3 px-4">
        <div className="flex items-center gap-2">
          <StatusBadge outcome={test.outcome} />
          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">{test.title}</p>
          <span className="shrink-0 font-mono text-[11px] text-default-400 tabular-nums">
            {attempts > 1 ? `${t('test.retry', { n: attempts - 1 })} · ` : ''}
            {parseMilliseconds(test.duration)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-default-500">
            {test.location.file}:{test.location.line}:{test.location.column}
          </span>
          <span className="rounded-md bg-default-100 px-1.5 py-0.5 font-mono text-[10.5px] text-default-600">
            {test.projectName}
          </span>
          {test.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-default-100 px-1.5 py-0.5 font-mono text-[10.5px] text-default-600"
            >
              {tag}
            </span>
          ))}
          {reportUrl && (
            <a
              className="ml-auto flex h-[26px] shrink-0 items-center gap-1 rounded-lg border border-default-200 px-2 text-[11.5px] text-default-600 hover:bg-default-100"
              href={`${withBase(reportUrl)}#?testId=${test.testId}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t('test.openTrace')}
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 px-4">
        <div className="flex flex-col gap-3.5">
          {textAttachments.length > 0 && (
            <div>
              <SectionLabel>{t('test.notes')}</SectionLabel>
              <div className="mt-1.5 flex flex-col gap-2">
                {textAttachments.map((attachment) => (
                  <div key={attachment.url}>
                    <p className="mb-1 text-[11.5px] text-default-500">{attachment.name}</p>
                    <TextAttachmentView attachment={attachment} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {screenshots.length > 0 && (
            <div>
              <SectionLabel>Attachments ({screenshots.length})</SectionLabel>
              <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {screenshots.map((shot, index) => (
                  <button
                    key={shot.url}
                    className="flex flex-col gap-1 text-left"
                    type="button"
                    onClick={() => openScreenshot(index)}
                  >
                    <img
                      alt={shot.name}
                      className="w-full rounded-lg border border-divider object-contain"
                      src={shot.url}
                    />
                    <span className="truncate text-[10.5px] text-default-400">{shot.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!!testHistory?.length && (
            <div>
              <div className="flex items-center justify-between">
                <SectionLabel>{t('test.history', { count: testHistory.length })}</SectionLabel>
                <SparkSquares colors={squareColors} />
              </div>
              <div className="mt-1.5 overflow-hidden rounded-lg border border-divider">
                {testHistory.map((item) => {
                  const itemStyle = statusStyle(item.outcome);

                  return (
                    <a
                      key={`${item.reportID}-${item.testId}`}
                      className="grid h-[29px] items-center gap-2 border-b border-divider px-2.5 text-[11.5px] last:border-0 hover:bg-default-50"
                      href={`${withBase(item.reportUrl)}#?testId=${item.testId}`}
                      rel="noopener noreferrer"
                      style={{ gridTemplateColumns: '1fr 90px 80px 28px' }}
                      target="_blank"
                    >
                      <span className="font-mono text-default-500">
                        <FormattedDate date={item.createdAt} />
                      </span>
                      <span className="font-medium" style={{ color: itemStyle.hex }}>
                        {ts(STATUS_KEYS[item.outcome])}
                      </span>
                      <span className="font-mono text-default-500">{parseMilliseconds(item.duration)}</span>
                      <ExternalLink className="text-default-400" size={13} />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isOpen} scrollBehavior="inside" size="4xl" onClose={onClose}>
        <ModalContent>
          <ModalBody className="p-2">
            {active && (
              <div className="flex items-center justify-center">
                <img alt={active.name} className="max-h-[75vh] w-auto object-contain" src={active.url} />
              </div>
            )}
            {active && screenshots.length > 1 && (
              <>
                <button
                  aria-label={t('test.prevScreenshot')}
                  className="fixed left-4 top-1/2 z-50 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-content1/90 text-default-600 shadow-md hover:bg-content1"
                  type="button"
                  onClick={showPrev}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  aria-label={t('test.nextScreenshot')}
                  className="fixed right-4 top-1/2 z-50 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-content1/90 text-default-600 shadow-md hover:bg-content1"
                  type="button"
                  onClick={showNext}
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}
            {active && (
              <p className="sticky bottom-0 -mx-2 -mb-2 bg-content1/95 py-2 text-center text-sm text-default-500">
                {active.name}
                {screenshots.length > 1 && (
                  <span className="ml-1.5 font-mono text-xs text-default-400">
                    {(activeIndex ?? 0) + 1} / {screenshots.length}
                  </span>
                )}
              </p>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default TestInfo;
