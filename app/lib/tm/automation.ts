import { type TmDb } from './db';
import { now } from './errors';
import { createRun, getRun, updateRunCase } from './runs';

// Stage 2 of test management: autotests link to cases with a Playwright tag holding the case ID (`@HAN-12`).
// Every report updates the cases it covers and, when it names a Testboard run, fills that run too.

export type AutoResult = 'passed' | 'failed' | 'skipped';
type Outcome = 'expected' | 'unexpected' | 'flaky' | 'skipped';

// The slice of a stored report this needs (ReportHistory satisfies it; extra metadata fields ride along).
export interface SyncableReport {
  reportID: string;
  project: string;
  reportUrl: string;
  files: { tests: { title: string; tags: string[]; outcome: Outcome }[] }[];
  testboardRun?: string;
  env?: string;
}

export interface AutoResultView {
  result: AutoResult;
  reportId: string;
  reportUrl: string;
  tests: string[];
  recordedAt: string;
}

export interface SyncSummary {
  linkedCases: number;
  unknownTags: string[];
  run: { id: number; updated: number } | null;
}

const AUTOTESTS = 'autotests';

export const parseCaseTags = (tags: string[], code: string): number[] => {
  const re = new RegExp(`^@?${code}-(\\d+)$`, 'i');
  const numbers = tags
    .map((tag) => tag.trim().match(re)?.[1])
    .filter(Boolean)
    .map(Number);

  return [...new Set(numbers)];
};

// The autotests may name the case in the title instead of a tag: "HM-36 the header menu opens", or several
// labels in a row ("HM-40 HM-11 …"). Only labels the title starts with count, so a mention later in the
// sentence doesn't link the test.
export const parseCaseTitle = (title: string, code: string): number[] => {
  const head = title.match(new RegExp(`^(?:${code}-\\d+[\\s,:]+)+`, 'i'))?.[0] ?? '';

  return [...new Set([...head.matchAll(/-(\d+)/g)].map((m) => Number(m[1])))];
};

export const outcomeForCase = (outcomes: Outcome[]): AutoResult => {
  if (outcomes.includes('unexpected')) return 'failed';
  if (outcomes.some((o) => o === 'expected' || o === 'flaky')) return 'passed';

  return 'skipped';
};

export const getAutoResult = (db: TmDb, caseId: number): AutoResultView | null => {
  const row = db.prepare('SELECT * FROM tm_case_auto_results WHERE case_id = ?').get(caseId) as
    | { result: AutoResult; report_id: string; report_url: string; tests: string; recorded_at: string }
    | undefined;

  return row
    ? {
        result: row.result,
        reportId: row.report_id,
        reportUrl: row.report_url,
        tests: JSON.parse(row.tests),
        recordedAt: row.recorded_at,
      }
    : null;
};

const runComment = (report: SyncableReport, result: AutoResult, tests: { title: string; outcome: Outcome }[]) => {
  const failed = tests.filter((t) => t.outcome === 'unexpected').map((t) => `- ${t.title}`);

  return [`Autotests: ${report.reportUrl}`, ...(result === 'failed' ? ['Failed:', ...failed] : [])].join('\n');
};

const runName = (report: SyncableReport) => {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

  return ['Autotests', report.env, stamp].filter(Boolean).join(' · ');
};

export const syncReport = (db: TmDb, report: SyncableReport): SyncSummary => {
  const empty: SyncSummary = { linkedCases: 0, unknownTags: [], run: null };
  const project = db.prepare('SELECT id, code FROM tm_projects WHERE key = ?').get(report.project) as
    | { id: number; code: string }
    | undefined;

  if (!project) return empty;

  // case number → the tests that carry its tag or name it in the title
  const byNumber = new Map<number, { title: string; outcome: Outcome }[]>();

  for (const file of report.files ?? []) {
    for (const test of file.tests ?? []) {
      const numbers = new Set([
        ...parseCaseTags(test.tags ?? [], project.code),
        ...parseCaseTitle(test.title ?? '', project.code),
      ]);

      for (const number of numbers) {
        byNumber.set(number, [...(byNumber.get(number) ?? []), { title: test.title, outcome: test.outcome }]);
      }
    }
  }
  if (!byNumber.size) return empty;

  const numbers = [...byNumber.keys()];
  const rows = db
    .prepare(
      `SELECT id, number, automation FROM tm_cases WHERE project_id = ? AND deleted_at IS NULL AND number IN (${numbers.map(() => '?').join(',')})`,
    )
    .all(project.id, ...numbers) as { id: number; number: number; automation: string }[];
  const found = new Set(rows.map((r) => r.number));
  const unknownTags = numbers.filter((n) => !found.has(n)).map((n) => `@${project.code}-${n}`);

  return db.transaction((): SyncSummary => {
    const results = new Map<number, { result: AutoResult; tests: { title: string; outcome: Outcome }[] }>();
    const upsert = db.prepare(
      `INSERT INTO tm_case_auto_results (case_id, result, report_id, report_url, tests, recorded_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(case_id) DO UPDATE SET result = excluded.result, report_id = excluded.report_id,
         report_url = excluded.report_url, tests = excluded.tests, recorded_at = excluded.recorded_at`,
    );
    const markAutomated = db.prepare(
      "UPDATE tm_cases SET automation = 'automated' WHERE id = ? AND automation IN ('manual', 'to_automate')",
    );

    for (const row of rows) {
      const tests = byNumber.get(row.number)!;
      const result = outcomeForCase(tests.map((t) => t.outcome));

      results.set(row.id, { result, tests });
      upsert.run(row.id, result, report.reportID, report.reportUrl, JSON.stringify(tests.map((t) => t.title)), now());
      markAutomated.run(row.id);
    }

    let run: SyncSummary['run'] = null;
    const target = (report.testboardRun ?? '').trim();

    if (target && results.size) {
      let runId: number | null = null;

      if (target === 'new') {
        runId = createRun(db, {
          projectId: project.id,
          name: runName(report),
          source: { type: 'cases', caseIds: [...results.keys()] },
          by: AUTOTESTS,
        }).id;
      } else if (/^\d+$/.test(target)) {
        const existing = db.prepare('SELECT project_id, status FROM tm_runs WHERE id = ?').get(Number(target)) as
          | { project_id: number; status: string }
          | undefined;

        if (existing?.project_id === project.id && existing.status === 'in_progress') runId = Number(target);
      }

      if (runId !== null) {
        let updated = 0;

        for (const rc of getRun(db, runId).cases) {
          const auto = results.get(rc.caseId);

          // A result a person set stays; autotests only fill blanks and refresh their own results.
          if (!auto || (rc.result !== 'untested' && rc.resultBy !== AUTOTESTS)) continue;
          updateRunCase(
            db,
            rc.id,
            { result: auto.result, comment: runComment(report, auto.result, auto.tests) },
            AUTOTESTS,
          );
          updated++;
        }
        run = { id: runId, updated };
      }
    }

    return { linkedCases: rows.length, unknownTags, run };
  })();
};
