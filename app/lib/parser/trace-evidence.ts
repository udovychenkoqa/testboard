import JSZip from 'jszip';

import { type ReportTest, type ReportTestAttachment } from './types';

/**
 * Reads network/console/action evidence out of a test's `trace.zip`
 * attachment, adapted from upstream playwright-reports-server v6's
 * failure-extraction.ts. Confirmed zero playwright-core/@playwright/test
 * dependency there — pure zip + JSONL parsing — so we replicate it with
 * `jszip` (already a dependency here) instead of adding `unzipper`.
 *
 * Deliberately NOT ported: git commit / CI build metadata (would require
 * changing what the CI reporter sends, a different scope) and browser/
 * viewport environment context (low diagnostic value vs. network/console/actions).
 */

const CONSOLE_MAX_TEXT_CHARS = 500;
const CONSOLE_RECENT_LOGS_KEEP = 5;
const CONSOLE_MAX_TOTAL = 25;
const NETWORK_BODY_MAX_CHARS = 1024;
const NETWORK_PRE_FAILURE_KEEP = 5;
const NETWORK_MAX_TOTAL = 20;
const ACTION_LOG_KEEP = 10;

// Our addition, not in upstream: they run trace parsing in an isolated
// worker process with its own memory ceiling. We run this inline in the
// same Node process already tuned for merge-reports' memory budget — skip
// rather than risk repeating the OOM issues a 100+MB trace caused earlier.
const MAX_TRACE_ZIP_BYTES = 20 * 1024 * 1024;

const SENSITIVE_HEADER_PATTERNS: RegExp[] = [
  /^authorization$/i,
  /^proxy-authorization$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /^x-auth/i,
  /^x-api-key$/i,
  /^x-api-token$/i,
];

export interface NetworkEvent {
  method: string;
  url: string;
  status?: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  failureText?: string;
  timestamp?: number;
}

export interface ConsoleEvent {
  level: string;
  text: string;
  timestamp?: number;
}

export interface ActionEvent {
  action: string;
  target?: string;
  error?: string;
}

export interface TraceEvidence {
  networkEvents: NetworkEvent[];
  consoleEvents: ConsoleEvent[];
  actionLog: ActionEvent[];
}

export const findTraceAttachment = (test: ReportTest): ReportTestAttachment | undefined =>
  test.results.flatMap((result) => result.attachments ?? []).find((att) => att.name === 'trace' && att.path);

type RawHeader = { name?: string; value?: string };

/**
 * Redacts sensitive header VALUES (key stays visible — the model should
 * know auth was present without seeing the secret). Applied to both
 * request and response headers, matching upstream exactly.
 */
export const sanitizeHeaders = (headers: RawHeader[] | Record<string, string> | undefined): Record<string, string> => {
  const entries: Array<[string, string]> = Array.isArray(headers)
    ? headers.map((h) => [h.name ?? '', h.value ?? ''])
    : Object.entries(headers ?? {});

  const result: Record<string, string> = {};

  for (const [name, value] of entries) {
    if (!name) {
      continue;
    }

    result[name] = SENSITIVE_HEADER_PATTERNS.some((pattern) => pattern.test(name)) ? '[redacted]' : value;
  }

  return result;
};

const truncate = (text: string | undefined, maxChars: number): string | undefined => {
  if (!text) {
    return text;
  }

  return text.length > maxChars ? `${text.slice(0, maxChars)}…[truncated]` : text;
};

/** Picks the highest-numbered `{n}-trace.{ext}` entry — the final attempt
 * when a test retried, matching the "last attachment" convention already
 * used for screenshots elsewhere in this codebase. */
const pickLatestTraceFile = (zip: JSZip, extension: 'trace' | 'network'): string | undefined => {
  const candidates = Object.keys(zip.files).filter((name) => name.endsWith(`.${extension}`));

  return candidates.sort().at(-1);
};

interface RawTraceEntry {
  type?: string;
  method?: string;
  method_?: string;
  url?: string;
  status?: number;
  requestHeaders?: RawHeader[];
  responseHeaders?: RawHeader[];
  postData?: string;
  responseBody?: string;
  failureText?: string;
  wallTime?: number;
  timestamp?: number;
  level?: string;
  text?: string;
  apiName?: string;
  selector?: string;
  error?: { message?: string };
}

const parseJsonLines = (raw: string): RawTraceEntry[] => {
  const entries: RawTraceEntry[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      // Malformed line — skip it, never let one bad line abort the whole trace.
    }
  }

  return entries;
};

const collectNetworkEvents = (entries: RawTraceEntry[]): NetworkEvent[] => {
  const events = entries
    .filter((entry) => entry.type === 'resource-snapshot' || (entry.method && entry.url))
    .map((entry) => ({
      method: entry.method ?? entry.method_ ?? 'GET',
      url: entry.url ?? '',
      status: entry.status,
      requestHeaders: entry.requestHeaders ? sanitizeHeaders(entry.requestHeaders) : undefined,
      responseHeaders: entry.responseHeaders ? sanitizeHeaders(entry.responseHeaders) : undefined,
      requestBody: truncate(entry.postData, NETWORK_BODY_MAX_CHARS),
      responseBody: truncate(entry.responseBody, NETWORK_BODY_MAX_CHARS),
      failureText: entry.failureText,
      timestamp: entry.wallTime ?? entry.timestamp,
    }));

  const failed = events.filter((e) => e.failureText || (e.status && e.status >= 400));
  const successful = events.filter((e) => !failed.includes(e));

  // Prioritize failures, then the last N successful requests leading up to them.
  return [...failed, ...successful.slice(-NETWORK_PRE_FAILURE_KEEP)].slice(0, NETWORK_MAX_TOTAL);
};

const collectConsoleEvents = (entries: RawTraceEntry[]): ConsoleEvent[] => {
  const events = entries
    .filter((entry) => entry.type === 'console' || entry.type === 'event')
    .filter((entry) => entry.text !== undefined)
    .map((entry) => ({
      level: entry.level ?? 'log',
      text: truncate(entry.text, CONSOLE_MAX_TEXT_CHARS) ?? '',
      timestamp: entry.timestamp,
    }));

  const errors = events.filter((e) => e.level === 'error' || e.level === 'warning');
  const recent = events.filter((e) => !errors.includes(e)).slice(-CONSOLE_RECENT_LOGS_KEEP);

  return [...errors, ...recent].slice(0, CONSOLE_MAX_TOTAL);
};

const collectActionLog = (entries: RawTraceEntry[]): ActionEvent[] => {
  return entries
    .filter((entry) => entry.type === 'before' || entry.type === 'after' || !!entry.apiName)
    .map((entry) => ({
      action: entry.apiName ?? entry.type ?? 'action',
      target: entry.selector,
      error: entry.error?.message,
    }))
    .slice(-ACTION_LOG_KEEP);
};

/**
 * Never throws — any failure (missing attachment, oversized trace, corrupt
 * zip, malformed JSONL) just means the deep-analysis call proceeds without
 * this evidence, not that the whole report generation fails.
 */
export const extractTraceEvidence = async (zip: JSZip, tracePath: string): Promise<TraceEvidence | null> => {
  try {
    const entry = zip.file(tracePath);

    if (!entry) {
      return null;
    }

    const buffer = await entry.async('nodebuffer');

    if (buffer.byteLength > MAX_TRACE_ZIP_BYTES) {
      console.warn(`[trace-evidence] skipping oversized trace ${tracePath} (${buffer.byteLength} bytes)`);

      return null;
    }

    const traceZip = await JSZip.loadAsync(buffer);

    const traceFile = pickLatestTraceFile(traceZip, 'trace');
    const networkFile = pickLatestTraceFile(traceZip, 'network');

    const traceEntries = traceFile ? parseJsonLines(await traceZip.file(traceFile)!.async('string')) : [];
    const networkEntries = networkFile ? parseJsonLines(await traceZip.file(networkFile)!.async('string')) : [];

    return {
      networkEvents: collectNetworkEvents(networkEntries),
      consoleEvents: collectConsoleEvents(traceEntries),
      actionLog: collectActionLog(traceEntries),
    };
  } catch (error) {
    console.warn(`[trace-evidence] failed to extract ${tracePath}: ${(error as Error).message}`);

    return null;
  }
};
