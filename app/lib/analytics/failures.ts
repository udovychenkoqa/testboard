import { promises as fs } from 'node:fs';
import path from 'node:path';

import { REPORTS_FOLDER } from '../storage/constants';
import { withError } from '../withError';
import { storage } from '../storage';
import { loadReportZip, getFailureDetails, type ReportInfo } from '../parser';

// Deterministic error classification for the analytics dashboard — no LLM,
// pure regex over the first error message of each failing test. Categories
// mirror upstream v6's failure-category analytics.
export type FailureCategory = 'network' | 'assertion' | 'element' | 'timeout' | 'navigation' | 'other';

export const CATEGORY_LABELS: Record<FailureCategory, string> = {
  network: 'Network',
  assertion: 'Assertion',
  element: 'Element / locator',
  timeout: 'Timeout',
  navigation: 'Navigation',
  other: 'Other',
};

// Order matters: a locator-wait timeout should read as "element", not the
// generic "timeout", so element patterns are checked before timeout ones.
const CATEGORY_PATTERNS: Array<{ category: FailureCategory; pattern: RegExp }> = [
  { category: 'network', pattern: /net::|ECONNREFUSED|ECONNRESET|fetch failed|ERR_[A-Z_]+|socket hang up|50[234]\s/i },
  { category: 'assertion', pattern: /expect\(|expected .* (to|but)|toBe|toEqual|toHave|toContain|assertion/i },
  {
    category: 'element',
    pattern: /waiting for (locator|selector|element)|locator\(|not visible|not attached|strict mode violation|element is|intercepts pointer events/i,
  },
  { category: 'timeout', pattern: /timeout|timed out|exceeded/i },
  { category: 'navigation', pattern: /page\.goto|navigation|ERR_ABORTED|frame was detached/i },
];

export const categorizeError = (message: string): FailureCategory => {
  for (const { category, pattern } of CATEGORY_PATTERNS) {
    if (pattern.test(message)) return category;
  }

  return 'other';
};

export interface FailureRecord {
  title: string;
  location: string;
  projectName: string;
  category: FailureCategory;
}

interface FailuresSummaryFile {
  version: 1;
  failures: FailureRecord[];
}

const FAILURES_SUMMARY_FILENAME = 'failures-summary.json';

/**
 * Lightweight per-report failure digest, cached as failures-summary.json next
 * to index.html (same pattern as ai-summary.md). Built on first demand by
 * loading the report zip once; later dashboard requests are pure file reads.
 * fs-only, like the AI summary. Never throws — an unreadable report just
 * contributes nothing to the aggregate.
 */
export const getOrBuildReportFailures = async (
  reportId: string,
  projectPath: string,
  report: ReportInfo,
): Promise<FailureRecord[]> => {
  const hasFailures = report.stats.unexpected > 0 || report.stats.flaky > 0;

  if (!hasFailures) return [];

  const cachePath = path.join(REPORTS_FOLDER, projectPath, reportId, FAILURES_SUMMARY_FILENAME);

  const { result: cached } = await withError(fs.readFile(cachePath, 'utf-8'));

  if (cached) {
    const { result: parsed } = await withError(Promise.resolve().then(() => JSON.parse(cached) as FailuresSummaryFile));

    if (parsed?.version === 1 && Array.isArray(parsed.failures)) return parsed.failures;
  }

  const relativeIndexPath = `${projectPath}${reportId}/index.html`;
  const { result: html, error: readError } = await withError(
    storage.readFile(relativeIndexPath, 'text/html') as Promise<string>,
  );

  if (readError || !html) {
    console.warn(`[failures-analytics] failed to read ${relativeIndexPath}: ${readError?.message}`);

    return [];
  }

  const { result: failures, error: parseError } = await withError(
    loadReportZip(html).then((zip) => getFailureDetails(zip, report)),
  );

  if (parseError || !failures) {
    console.warn(`[failures-analytics] failed to parse report ${reportId}: ${parseError?.message}`);

    return [];
  }

  const records: FailureRecord[] = failures.map((f) => ({
    title: f.title,
    location: f.location,
    projectName: f.projectName,
    category: categorizeError(f.errors[0] ?? ''),
  }));

  const file: FailuresSummaryFile = { version: 1, failures: records };
  const { error: writeError } = await withError(fs.writeFile(cachePath, JSON.stringify(file), 'utf-8'));

  if (writeError) {
    console.warn(`[failures-analytics] failed to cache summary for ${reportId}: ${writeError.message}`);
  }

  return records;
};
