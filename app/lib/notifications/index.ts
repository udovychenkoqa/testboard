import { promises as fs } from 'node:fs';
import path from 'node:path';

import { resolveInside } from '../safePath';
import { withError } from '../withError';
import { type ReportHistory } from '../storage';
import { DATA_FOLDER, REPORTS_FOLDER } from '../storage/constants';

import { service } from '@/app/lib/service';
import { env } from '@/app/config/env';

// Lean Slack/webhook notifications, adapted from upstream v6's notification
// system: channels + per-channel condition live in config.json (no SQLite
// delivery log / circuit breaker — fire-and-forget with a console warn).

export type ChannelType = 'slack' | 'webhook';

export type NotifyCondition = 'always' | 'has_failures' | 'has_failures_or_recovered';

export interface NotificationChannel {
  id: string;
  name: string;
  type: ChannelType;
  url: string;
  condition: NotifyCondition;
  // '' or undefined = all projects
  project?: string;
  // undefined = enabled (backward compat with channels saved before the flag)
  enabled?: boolean;
  // Slack only: append the report's AI summary (ai-summary.md) to the message.
  // undefined/false = off (backward compat with channels saved before the flag)
  includeAiSummary?: boolean;
}

export interface NotificationsConfig {
  enabled: boolean;
  // absolute URL of this server (e.g. https://testboard.example.com) —
  // Slack rejects buttons with relative URLs, so links need a base
  baseUrl?: string;
  channels: NotificationChannel[];
}

interface ReportFacts {
  title: string;
  project: string;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  total: number;
  passRate: number;
  duration: string;
  reportLink?: string;
  recovered: boolean;
}

// ms → HH:MM:SS (matches the CTRF-style "00:00:25" duration label).
const formatDuration = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
};

const buildFacts = async (report: ReportHistory, baseUrl?: string): Promise<ReportFacts> => {
  const s = report.stats;
  const executed = s.expected + s.unexpected + s.flaky;
  const hasFailures = s.unexpected > 0 || s.flaky > 0;

  // "recovered" = previous report of the same project had failures, this one is clean
  let recovered = false;

  if (!hasFailures) {
    const { result } = await withError(
      service.getReports({ project: report.project, pagination: { offset: 1, limit: 1 } }),
    );
    const previous = result?.reports?.[0];

    if (previous && (previous.stats.unexpected > 0 || previous.stats.flaky > 0)) recovered = true;
  }

  // Our reporter doesn't set project, but always labels runs with `job`
  // (resultDetails.job) — show that instead of a dash.
  const jobLabel = (report as ReportHistory & { job?: string }).job;

  return {
    title: report.title || report.reportID,
    project: report.project || jobLabel || '—',
    passed: s.expected,
    failed: s.unexpected,
    flaky: s.flaky,
    skipped: s.skipped,
    total: s.total,
    passRate: executed > 0 ? (s.expected / executed) * 100 : 0,
    duration: formatDuration((report as ReportHistory & { duration?: number }).duration ?? 0),
    reportLink: baseUrl ? `${baseUrl.replace(/\/$/, '')}/report/${report.reportID}` : undefined,
    recovered,
  };
};

const shouldNotify = (channel: NotificationChannel, report: ReportHistory, facts: ReportFacts): boolean => {
  if (channel.enabled === false) return false;
  // The filter matches either the report's project or its `job` label
  // (resultDetails.job from the reporter, e.g. REPORT_JOB=log-sentinel in CI) —
  // our reporter doesn't set distinct projects, but does label cron jobs.
  const jobLabel = (report as ReportHistory & { job?: string }).job;
  // trim guards against filters saved with stray whitespace from the UI
  const filter = channel.project?.trim();

  if (filter && filter !== report.project && filter !== jobLabel) return false;
  const hasFailures = report.stats.unexpected > 0 || report.stats.flaky > 0;

  switch (channel.condition) {
    case 'always':
      return true;
    case 'has_failures':
      return hasFailures;
    case 'has_failures_or_recovered':
      return hasFailures || facts.recovered;
    default:
      return false;
  }
};

// Slack's `section` block hard-caps text at 3000 chars — exceed it and the
// WHOLE payload is rejected (invalid_blocks), so we must stay under it
// ourselves; Slack's "See more" only collapses an already-posted message and
// never lifts this limit. 2900 leaves headroom for the ellipsis + emoji.
// Verdict + any realistic Failure Patterns fit comfortably; only a long tail
// (usually Recommendations) gets trimmed — the "Open report" button then
// invites reading the full analysis in the report.
const SLACK_SECTION_LIMIT = 2900;

// Status bar down the left edge of the summary attachment: red on failures,
// yellow when only flaky, green when clean/recovered. Same `attachment.color`
// mechanism as the purple AI block.
const STATUS_RED = '#E01E5A';
const STATUS_YELLOW = '#ECB22E';
const STATUS_GREEN = '#2EB67D';

const statusColor = (facts: ReportFacts): string =>
  facts.failed > 0 ? STATUS_RED : facts.flaky > 0 ? STATUS_YELLOW : STATUS_GREEN;

// A doughnut chart rendered by QuickChart.io (the same public service the CTRF
// Slack reporter uses) — Slack can't draw charts, so it fetches this URL as an
// image. Only the pass/fail/flaky/skip counts travel to quickchart.io. Center
// label shows the pass rate. Slices with a zero count are dropped so the ring
// only shows outcomes that actually occurred.
const chartImageUrl = (facts: ReportFacts): string => {
  const slices = [
    { value: facts.passed, color: '#36c96d' },
    { value: facts.failed, color: '#e74c3c' },
    { value: facts.flaky, color: '#f1c40f' },
    { value: facts.skipped, color: '#d3d3d3' },
  ].filter((slice) => slice.value > 0);

  const config = {
    type: 'doughnut',
    data: {
      datasets: [
        {
          data: slices.map((slice) => slice.value),
          backgroundColor: slices.map((slice) => slice.color),
          borderWidth: 0,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        doughnutlabel: {
          labels: [{ text: `${facts.passRate.toFixed(0)}%`, font: { size: 22, weight: 'bold' } }],
        },
      },
    },
  };

  return `https://quickchart.io/chart?w=140&h=140&c=${encodeURIComponent(JSON.stringify(config))}`;
};

// Slack alerts carry only the diagnosis — the Verdict line plus the first
// section (Failure Patterns): what's broken. Recommendations and anything
// after are dropped and read in the full report behind the button. We cut at
// the SECOND `## ` heading, keying on structure not text — older summaries
// were written with Ukrainian headings, and matching a literal heading would
// break on those. No second heading → nothing to
// drop (e.g. a summary with only Failure Patterns).
const trimToDiagnosis = (markdown: string): string => {
  const headings = [...markdown.matchAll(/^##\s+/gm)];

  if (headings.length < 2) return markdown;

  const cut = headings[1].index ?? markdown.length;

  return `${markdown.slice(0, cut).trimEnd()}\n…`;
};

// The AI summary is our own markdown (see app/lib/ai/reportSummary.ts prompt) —
// convert only the 4 shapes it emits to Slack mrkdwn: `## heading` → *bold*,
// `**bold**` → *bold*, `[title](testref:id)` → title (testref isn't a URL),
// `- ` bullets → •. Backticks/`code` already render in Slack mrkdwn as-is.
const aiSummaryToMrkdwn = (markdown: string): string =>
  markdown
    .replace(/\[([^[\]]+)\]\(testref:[^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/^\s*-\s+/gm, '• ')
    .trim();

// Reads ai-summary.md next to the report's index.html (written by
// generateReportAiSummary). Returns null when there's no summary yet — a clean
// run never gets one, and on failures the caller chains this AFTER generation
// so the file exists by the time we read it.
const readAiSummaryMrkdwn = async (report: ReportHistory): Promise<string | null> => {
  const projectPath = report.project ? `${encodeURI(report.project)}/` : '';
  const { result } = await withError(
    (async () => fs.readFile(resolveInside(REPORTS_FOLDER, projectPath, report.reportID, 'ai-summary.md'), 'utf-8'))(),
  );

  if (!result?.trim()) return null;

  return aiSummaryToMrkdwn(trimToDiagnosis(result));
};

// Trims to fit one Slack section, cutting at the last line/word boundary
// before the limit (so we never end mid-word) and marking the cut with "…".
// Reserves room for the ellipsis so the result always stays under the limit.
const ELLIPSIS = '\n…';

const truncateForSlack = (text: string): string => {
  if (text.length <= SLACK_SECTION_LIMIT) return text;

  const budget = SLACK_SECTION_LIMIT - ELLIPSIS.length;
  const slice = text.slice(0, budget);
  // Prefer a newline boundary, then a space; fall back to a hard cut only if
  // neither is reasonably close to the end (avoids trimming most of the text).
  const newlineCut = slice.lastIndexOf('\n');
  const spaceCut = slice.lastIndexOf(' ');
  const boundary = Math.max(newlineCut, spaceCut);
  const cut = boundary > budget * 0.8 ? boundary : budget;

  return slice.slice(0, cut).trimEnd() + ELLIPSIS;
};

const slackPayload = (facts: ReportFacts, aiSummaryMrkdwn?: string | null) => {
  const failed = facts.failed > 0;
  const emoji = failed ? '🔴' : facts.recovered ? '🟢' : facts.flaky > 0 ? '🟡' : '✅';
  const headline = facts.recovered ? 'Tests recovered' : failed ? 'Failures' : 'Run passed';

  const actionBlock = facts.reportLink
    ? {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open report' },
            url: facts.reportLink,
            style: failed ? 'danger' : 'primary',
          },
        ],
      }
    : null;

  // `text` is only the notification/preview fallback — because we also send
  // top-level `blocks` (the header), Slack does NOT render it inline, so it no
  // longer shows as a duplicate line above the card.
  const text = `${headline}: ${facts.title} — pass rate ${facts.passRate.toFixed(1)}%`;

  // Header lives in a top-level block (colorless) — that's what suppresses the
  // fallback `text` line. Everything else goes into ONE status-colored
  // attachment (single "Added by" footer): the left bar spans the whole card —
  // red on failures, yellow when only flaky, green when clean. The doughnut
  // chart hangs off the stats section as an image accessory (QuickChart renders
  // it; Slack just fetches the URL). The AI summary follows a divider under the
  // same bar so the message reads as a single block; the button sits last.
  const blocks: unknown[] = [
    { type: 'header', text: { type: 'plain_text', text: `${emoji} ${headline}: ${facts.title}`, emoji: true } },
  ];

  const attachmentBlocks: unknown[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Project:* ${facts.project}\n*Duration:* ${facts.duration}\n✅ ${facts.passed}  ·  ❌ ${facts.failed}  ·  ⚠️ flaky ${facts.flaky}  ·  ⏭ skipped ${facts.skipped}`,
      },
      accessory: {
        type: 'image',
        image_url: chartImageUrl(facts),
        alt_text: `Pass rate ${facts.passRate.toFixed(0)}%`,
      },
    },
  ];

  if (aiSummaryMrkdwn) {
    attachmentBlocks.push(
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: '✨ *AI Summary*' } },
      { type: 'section', text: { type: 'mrkdwn', text: truncateForSlack(aiSummaryMrkdwn) } },
    );
  }

  if (actionBlock) attachmentBlocks.push(actionBlock);

  return { blocks, text, attachments: [{ color: statusColor(facts), blocks: attachmentBlocks }] };
};

const webhookPayload = (facts: ReportFacts, reportId: string) => ({
  event: 'report_uploaded',
  reportId,
  ...facts,
});

const sendToChannel = async (channel: NotificationChannel, payload: unknown): Promise<void> => {
  // Only web hooks: file:, ftp: and friends have no business in a notification channel.
  if (!/^https?:\/\//i.test(channel.url)) throw new Error('Channel URL must start with http:// or https://');

  const response = await fetch(channel.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    // Status only: the body of an internal service must not end up in the log that viewers can read.
    throw new Error(`HTTP ${response.status}`);
  }
};

// --- Delivery log: last N dispatch outcomes, shown in Settings for
// debugging "why didn't Slack get a message" without SSH-ing into the host.
const DELIVERY_LOG_FILE = path.join(DATA_FOLDER, 'notifications-log.json');
const DELIVERY_LOG_MAX = 50;

export interface DeliveryLogEntry {
  at: string;
  reportId: string;
  channel: string;
  outcome: 'sent' | 'skipped' | 'error';
  detail: string;
}

const appendDeliveryLog = async (entries: DeliveryLogEntry[]): Promise<void> => {
  if (entries.length === 0) return;
  const { result: raw } = await withError(fs.readFile(DELIVERY_LOG_FILE, 'utf-8'));
  let log: DeliveryLogEntry[] = [];

  if (raw) {
    try {
      log = JSON.parse(raw);
    } catch {
      log = [];
    }
  }
  log = [...entries, ...log].slice(0, DELIVERY_LOG_MAX);
  const { error } = await withError(fs.writeFile(DELIVERY_LOG_FILE, JSON.stringify(log), 'utf-8'));

  if (error) console.warn(`[notifications] failed to write delivery log: ${error.message}`);
};

export const readDeliveryLog = async (): Promise<DeliveryLogEntry[]> => {
  const { result: raw } = await withError(fs.readFile(DELIVERY_LOG_FILE, 'utf-8'));

  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const getNotificationsConfig = async (): Promise<NotificationsConfig> => {
  const config = await service.getConfig();
  const notifications = (config as { notifications?: NotificationsConfig }).notifications;
  const resolved = notifications ?? { enabled: false, channels: [] };

  // Base URL comes from env (deploy-time constant), with any legacy
  // config.json value as fallback for configs saved before the switch.
  return { ...resolved, baseUrl: env.BASE_URL ?? resolved.baseUrl };
};

/** Fire-and-forget dispatch after report generation. Never throws. */
export const dispatchReportNotifications = async (reportId: string): Promise<void> => {
  const now = () => new Date().toISOString();
  const config = await getNotificationsConfig();

  if (!config.enabled) {
    await appendDeliveryLog([
      { at: now(), reportId, channel: '—', outcome: 'skipped', detail: 'notifications disabled' },
    ]);

    return;
  }
  if (config.channels.length === 0) {
    await appendDeliveryLog([{ at: now(), reportId, channel: '—', outcome: 'skipped', detail: 'no channels' }]);

    return;
  }

  const { result: report, error: reportError } = await withError(service.getReport(reportId));

  if (!report) {
    await appendDeliveryLog([
      {
        at: now(),
        reportId,
        channel: '—',
        outcome: 'error',
        detail: `couldn't read report: ${reportError?.message}`,
      },
    ]);

    return;
  }

  const facts = await buildFacts(report, config.baseUrl);
  const entries: DeliveryLogEntry[] = [];

  // Read ai-summary.md once (not per channel) if any enabled Slack channel
  // wants it. null when there's no summary — the block is simply omitted.
  const wantsAiSummary = config.channels.some((c) => c.type === 'slack' && c.includeAiSummary && c.enabled !== false);
  const aiSummaryMrkdwn = wantsAiSummary ? await readAiSummaryMrkdwn(report) : null;

  for (const channel of config.channels) {
    if (!shouldNotify(channel, report, facts)) {
      const jobLabel = (report as ReportHistory & { job?: string }).job;

      entries.push({
        at: now(),
        reportId,
        channel: channel.name,
        outcome: 'skipped',
        detail:
          channel.enabled === false
            ? 'channel disabled'
            : channel.project && channel.project !== report.project && channel.project !== jobLabel
              ? `filter "${channel.project}" didn't match (project="${report.project}", job="${jobLabel ?? ''}")`
              : `condition "${channel.condition}" not met (failed=${report.stats.unexpected}, flaky=${report.stats.flaky}, recovered=${facts.recovered})`,
      });
      continue;
    }

    const payload =
      channel.type === 'slack'
        ? slackPayload(facts, channel.includeAiSummary ? aiSummaryMrkdwn : undefined)
        : webhookPayload(facts, reportId);
    const { error } = await withError(sendToChannel(channel, payload));

    if (error) {
      console.warn(`[notifications] failed to send to "${channel.name}": ${error.message}`);
      entries.push({
        at: now(),
        reportId,
        channel: channel.name,
        outcome: 'error',
        detail: error.message.slice(0, 300),
      });
    } else {
      console.log(`[notifications] sent report ${reportId} to "${channel.name}"`);
      entries.push({ at: now(), reportId, channel: channel.name, outcome: 'sent', detail: 'delivered' });
    }
  }

  await appendDeliveryLog(entries);
};
