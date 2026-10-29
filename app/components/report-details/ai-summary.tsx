'use client';

import { FC, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button, Link } from '@heroui/react';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { withBase } from '@/app/lib/url';
import { aiFailureKind } from '@/app/lib/ai/failure-kind';
import useMutation from '@/app/hooks/useMutation';
import { type AiSummaryResult } from '@/app/lib/ai/reportSummary';
import { BlockSkeleton } from '@/app/components/ui/skeletons';

interface AiReportSummaryProps {
  reportId?: string;
  reportUrl?: string;
  hasFailures: boolean;
}

// Matches the 3 markup shapes our own prompt instructs the model to use —
// see app/lib/ai/reportSummary.ts SYSTEM_PROMPT. Not a general markdown
// parser: we fully control the model's output format, so a hand-rolled
// inline replacer for exactly these 3 patterns is enough (no new dependency).
const INLINE_PATTERN = /\*\*(.+?)\*\*|`([^`]+)`|\[([^[\]]+)\]\(testref:([^)]+)\)/g;

const renderInline = (text: string, reportUrl: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  INLINE_PATTERN.lastIndex = 0;

  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const [, bold, code, linkTitle, testId] = match;

    if (bold !== undefined) {
      nodes.push(<strong key={key++}>{bold}</strong>);
    } else if (code !== undefined) {
      nodes.push(
        <code key={key++} className="rounded bg-default-200 px-1.25 py-0.5 font-mono text-xs">
          {code}
        </code>,
      );
    } else if (linkTitle !== undefined && testId !== undefined) {
      // Same "jump to test" convention as the history table below —
      // opens the native Playwright report anchored at that test.
      nodes.push(
        <Link key={key++} href={`${withBase(reportUrl)}#?testId=${testId}`} size="sm" target="_blank">
          {linkTitle}
        </Link>,
      );
    }

    lastIndex = INLINE_PATTERN.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};

const renderMarkdownish = (text: string, reportUrl: string): ReactNode => {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## ')) {
      return (
        <h4 key={i} className="mb-1 mt-3 text-[13px] font-semibold">
          {renderInline(line.slice(3), reportUrl)}
        </h4>
      );
    }

    if (!line.trim()) {
      return <div key={i} className="h-2" />;
    }

    return (
      <p key={i} className="text-[14px] leading-[1.55]" style={{ textWrap: 'pretty' }}>
        {renderInline(line, reportUrl)}
      </p>
    );
  });
};

type AiT = ReturnType<typeof useTranslations<'report.ai'>>;

const statusMessage = (status: AiSummaryResult | null, t: AiT): string | null => {
  if (!status) {
    return t('none');
  }

  switch (status.status) {
    case 'failed':
      return t(`failure.${aiFailureKind(status.reason)}`);
    case 'circuit_open':
      return t('rateLimited', { seconds: Math.ceil(status.retryInMs / 1000) });
    case 'skipped_disabled':
      return t('notConfigured');
    case 'skipped_unsupported_storage':
      return t('unsupportedStorage');
    default:
      return t('none');
  }
};

/**
 * Fetches `ai-summary.md` (and, if missing, `ai-summary-status.json`) next to
 * the report's index.html — both written by app/lib/ai/reportSummary.ts.
 * Only shown at all when the report actually has failures: a clean pass never
 * gets a summary by design, and that's not something worth explaining to the
 * user with a status card — see app/lib/ai/reportSummary.ts's skipped_clean.
 *
 * When there ARE failures but no summary (disabled, failed, rate-limited, or
 * simply never triggered), shows why and a button to (re)try — POSTs
 * /api/report/[id]/ai-summary, which awaits generateReportAiSummary directly
 * instead of the fire-and-forget call service.generateReport() already made.
 */
// After a report is generated, service.generateReport() fires the AI summary
// fire-and-forget in the background — it can still be running (LLM calls take
// several seconds, more with retries) by the time the user opens the report
// page. Without polling, neither ai-summary.md nor ai-summary-status.json
// exist yet, and the UI would flash "No AI summary yet." + a Generate button
// as if nothing ever happened, indistinguishable from a report that will
// never get one. Poll for a bounded window so a still-forming summary just
// shows "in progress" instead of looking broken until a manual refresh.
const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 15; // ~60s — comfortably covers deep-analysis + report-summary calls with retries

const AiReportSummary: FC<AiReportSummaryProps> = ({ reportId, reportUrl, hasFailures }) => {
  const t = useTranslations('report.ai');
  const [summary, setSummary] = useState<string | null>(null);
  const [status, setStatus] = useState<AiSummaryResult | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pollAttempts, setPollAttempts] = useState(0);

  const fetchState = useCallback(() => {
    if (!reportUrl) {
      return;
    }

    let cancelled = false;
    const base = reportUrl.replace(/index\.html$/, '');
    // Cache-bust: polling hits the exact same URL repeatedly while the
    // fire-and-forget summary is still being written, and without this the
    // browser was replaying an early 404 forever instead of re-fetching —
    // the loader would spin until a full page reload broke the cache.
    const bust = `?t=${Date.now()}`;

    Promise.all([
      fetch(withBase(`${base}ai-summary.md${bust}`), { cache: 'no-store' }).then((r) => (r.ok ? r.text() : null)),
      fetch(withBase(`${base}ai-summary-status.json${bust}`), { cache: 'no-store' }).then((r) =>
        r.ok ? r.json() : null,
      ),
    ])
      .then(([summaryText, statusJson]) => {
        if (cancelled) {
          return;
        }

        setSummary(summaryText);
        setStatus(statusJson);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reportUrl]);

  useEffect(() => fetchState(), [fetchState]);

  const isPolling = loaded && !summary && !status && pollAttempts < MAX_POLL_ATTEMPTS;

  useEffect(() => {
    if (!isPolling) {
      return;
    }

    const timer = setTimeout(() => {
      fetchState();
      setPollAttempts((n) => n + 1);
    }, POLL_INTERVAL_MS);

    return () => clearTimeout(timer);
    // `pollAttempts` is in the deps so this effect re-fires on every tick —
    // `isPolling` alone doesn't change value between ticks (stays `true`),
    // so React saw no dependency change and never rescheduled a new timer
    // after the first one fired: polling looked "stuck" until a full reload.
  }, [isPolling, pollAttempts, fetchState]);

  const { mutate: regenerate, isPending } = useMutation<AiSummaryResult>(`/api/report/${reportId}/ai-summary`, {
    method: 'POST',
    onSuccess: (data) => {
      if (data.status === 'generated') {
        fetchState();
      } else {
        setStatus(data);
      }
    },
  });

  if (!hasFailures || !reportUrl) {
    return null;
  }

  return (
    <div className="rounded-xl border border-divider bg-content1">
      <div className="flex h-10 items-center gap-2 border-b border-divider px-4">
        <Sparkles className="text-primary" size={15} />
        <span className="text-[13px] font-semibold">{t('title')}</span>
        {reportId && loaded && !isPolling && (
          <Button
            className="ml-auto h-[26px] min-w-0 px-2.5 text-xs"
            isLoading={isPending}
            size="sm"
            variant="flat"
            onPress={() => regenerate({})}
          >
            {summary ? t('regenerate') : t('generate')}
          </Button>
        )}
      </div>

      <div className="p-3.5 px-4">
        {!loaded ? (
          <BlockSkeleton lines={3} />
        ) : summary ? (
          <div className="flex flex-col gap-1">{renderMarkdownish(summary, reportUrl)}</div>
        ) : isPolling ? (
          <div className="flex flex-col gap-2">
            <BlockSkeleton lines={3} />
            <p className="text-[12.5px] text-default-500">{t('pending')}</p>
          </div>
        ) : status?.status === 'failed' ? (
          // A plain-words explanation; the raw API error stays one click away for whoever fixes it.
          <div className="flex flex-col gap-1.5">
            <p className="text-[12.5px] text-default-600">{statusMessage(status, t)}</p>
            <details className="text-[11.5px] text-default-400">
              <summary className="cursor-pointer select-none">{t('technicalDetails')}</summary>
              <p className="mt-1 break-all font-mono">{status.reason}</p>
            </details>
          </div>
        ) : (
          <p className="text-[12.5px] text-default-500">{statusMessage(status, t)}</p>
        )}
      </div>
    </div>
  );
};

export default AiReportSummary;
