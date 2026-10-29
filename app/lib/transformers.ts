import { ReportFile, ReportTest, ReportTestFilters } from '@/app/lib/parser';
import { ReportHistory } from '@/app/lib/storage/types';

// Fields we already type/render explicitly elsewhere — anything else on the
// report object is a passthrough custom field (see /api/report/generate's
// `...rest` spread → fs.ts parseReportMetadata's Object.assign): CI can send
// arbitrary keys (environment, branch, workingDir, ...) when it generates the
// report, and they land directly on ReportHistory with no fixed schema.
const CORE_REPORT_FIELDS = new Set([
  'reportID',
  'title',
  'project',
  'createdAt',
  'size',
  'sizeBytes',
  'reportUrl',
  'metadata',
  'startTime',
  'duration',
  'files',
  'projectNames',
  'stats',
  'errors',
  'playwrightVersion',
  // Control flags the report-generation caller sends alongside real
  // metadata (e.g. an autotests repo's own POST /api/report/generate body) —
  // not something a person needs to see on the report itself.
  'triggerReportGeneration',
]);

// Some custom fields arrive as JSON-stringified arrays/objects (or, since
// report.json is real parsed JSON unlike resultDetails' plain strings, as
// actual arrays/objects — e.g. Playwright's own "machines" metadata). Either
// shape renders as an unreadable wall of text in a chip — hide both rather
// than try to pretty-print structured data inline.
const looksLikeJsonBlob = (value: unknown): boolean => {
  if (typeof value === 'string') {
    const trimmed = value.trim();

    return trimmed.startsWith('[') || trimmed.startsWith('{');
  }

  return Array.isArray(value) || (typeof value === 'object' && value !== null);
};

export interface ReportMetaChip {
  key: string;
  label: string;
}

// Ordered, human-readable metadata chips for a report: known fields first
// (environment, branch, working dir, Playwright version, worker count), then
// whatever other custom fields the CI run happened to attach. Returns []
// when a report was generated without any of these — that's the honest
// state, not a bug (see redesign-v2-refactor memory for why branch/env show
// up empty on this seed dataset).
export const getReportMetaChips = (item: ReportHistory): ReportMetaChip[] => {
  const extra = item as ReportHistory & Record<string, unknown>;
  const chips: ReportMetaChip[] = [];

  if (typeof extra.environment === 'string' && extra.environment) {
    chips.push({ key: 'environment', label: `env: ${extra.environment}` });
  }
  if (typeof extra.branch === 'string' && extra.branch) {
    chips.push({ key: 'branch', label: extra.branch });
  }
  if (typeof extra.workingDir === 'string' && extra.workingDir) {
    chips.push({ key: 'workingDir', label: extra.workingDir.split('/').pop() || extra.workingDir });
  }
  if (typeof extra.playwrightVersion === 'string' && extra.playwrightVersion) {
    chips.push({ key: 'playwright', label: `Playwright ${extra.playwrightVersion}` });
  }
  if (item.metadata?.actualWorkers) {
    chips.push({ key: 'workers', label: `${item.metadata.actualWorkers} workers` });
  }

  const knownExtraKeys = new Set(['environment', 'branch', 'workingDir']);

  for (const [key, value] of Object.entries(extra)) {
    if (CORE_REPORT_FIELDS.has(key) || knownExtraKeys.has(key)) continue;
    if (value === null || value === undefined) continue;
    // CI often sends optional fields as "" (e.g. testRun) — nothing to show.
    if (typeof value === 'string' && !value.trim()) continue;
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue;
    if (looksLikeJsonBlob(value)) continue;
    chips.push({ key, label: `${key}: ${String(value)}` });
  }

  return chips;
};

const isTestMatchingFilters = (test: ReportTest, filters?: ReportTestFilters): boolean => {
  if (!filters) {
    return true;
  }
  const byOutcome = !filters.outcomes || filters.outcomes.includes(test.outcome);
  const byTitle = !filters.name || test.title.toLowerCase().includes(filters.name.toLowerCase());

  return byOutcome && byTitle;
};

export const filterReportHistory = (
  report: ReportHistory,
  filters?: ReportTestFilters,
): ReportHistory & { testCount: number; totalTestCount: number } => {
  const filtered = structuredClone(report);
  const counter = {
    testCount: 0,
    totalTestCount: 0,
  };
  const filteredFiles = filtered.files.reduce((files, file) => {
    counter.totalTestCount += file.tests.length;
    const filteredTests = file.tests.filter((test) => isTestMatchingFilters(test, filters));

    counter.testCount += filteredTests.length;

    const fileHasTests = filteredTests.length > 0;

    if (!fileHasTests) {
      return files;
    }

    file.tests = filteredTests;

    files.push(file);

    return files;
  }, [] as ReportFile[]);

  filtered.files = filteredFiles;

  return {
    ...filtered,
    ...counter,
  };
};

export const pluralize = (count: number, singular: string, plural: string, locale: string = 'en-US'): string => {
  const pluralRules = new Intl.PluralRules(locale);
  const rule = pluralRules.select(count);

  return rule === 'one' ? singular : plural;
};
