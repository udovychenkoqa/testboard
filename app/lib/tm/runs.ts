import { type TmDb } from './db';
import { now, TmError } from './errors';
import { getCase, type StepInput } from './cases';
import { suiteSubtreeIds } from './suites';

export const RESULTS = ['untested', 'passed', 'failed', 'blocked', 'skipped'] as const;
export type Result = (typeof RESULTS)[number];

export type RunSource =
  | { type: 'all' }
  | { type: 'suites'; suiteIds: number[] }
  | { type: 'tags'; tags: string[] }
  | { type: 'cases'; caseIds: number[] };

// What the tester saw when the run was created — later edits to the case don't touch it.
export interface CaseSnapshot {
  label: string;
  title: string;
  preconditions: string;
  steps: StepInput[];
  suitePath: string[];
}

export interface RunSummary {
  id: number;
  name: string;
  status: 'in_progress' | 'completed';
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
  total: number;
  counts: Record<Result, number>;
}

export interface RunCaseView {
  id: number;
  caseId: number;
  snapshot: CaseSnapshot;
  result: Result;
  comment: string;
  assignee: string | null;
  resultBy: string | null;
  resultAt: string | null;
}

interface RunRow {
  id: number;
  project_id: number;
  name: string;
  status: RunSummary['status'];
  created_by: string;
  created_at: string;
  completed_at: string | null;
}

interface RunCaseRow {
  id: number;
  run_id: number;
  case_id: number;
  snapshot: string;
  result: Result;
  comment: string;
  assignee: string | null;
  result_by: string | null;
  result_at: string | null;
}

const emptyCounts = (): Record<Result, number> => ({ untested: 0, passed: 0, failed: 0, blocked: 0, skipped: 0 });

const toSummary = (db: TmDb, row: RunRow): RunSummary => {
  const counts = emptyCounts();

  for (const { result, n } of db
    .prepare('SELECT result, COUNT(*) AS n FROM tm_run_cases WHERE run_id = ? GROUP BY result')
    .all(row.id) as { result: Result; n: number }[]) {
    counts[result] = n;
  }

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    total: Object.values(counts).reduce((sum, n) => sum + n, 0),
    counts,
  };
};

const getRunRow = (db: TmDb, id: number): RunRow => {
  const row = db.prepare('SELECT * FROM tm_runs WHERE id = ?').get(id) as RunRow | undefined;

  if (!row) throw new TmError('not_found', `run ${id} not found`);

  return row;
};

const toView = (row: RunCaseRow): RunCaseView => ({
  id: row.id,
  caseId: row.case_id,
  snapshot: JSON.parse(row.snapshot) as CaseSnapshot,
  result: row.result,
  comment: row.comment,
  assignee: row.assignee,
  resultBy: row.result_by,
  resultAt: row.result_at,
});

const inList = (n: number) => Array.from({ length: n }, () => '?').join(',');

// Live, non-deprecated case ids of the project that the source selects.
const resolveCaseIds = (db: TmDb, projectId: number, source: RunSource): number[] => {
  const base = "SELECT id FROM tm_cases WHERE project_id = ? AND deleted_at IS NULL AND status != 'deprecated'";
  const pick = (sql: string, params: (string | number)[]) =>
    (db.prepare(sql).all(projectId, ...params) as { id: number }[]).map((row) => row.id);

  switch (source.type) {
    case 'all':
      return pick(base, []);
    case 'suites': {
      const suiteIds = [...new Set(source.suiteIds.flatMap((id) => suiteSubtreeIds(db, id)))];

      return suiteIds.length ? pick(`${base} AND suite_id IN (${inList(suiteIds.length)})`, suiteIds) : [];
    }
    case 'tags':
      return source.tags.length
        ? pick(
            `${base} AND id IN (SELECT case_id FROM tm_case_tags WHERE tag IN (${inList(source.tags.length)}))`,
            source.tags,
          )
        : [];
    case 'cases':
      return source.caseIds.length
        ? pick(`${base} AND id IN (${inList(source.caseIds.length)})`, source.caseIds)
        : [];
  }
};

const suitePaths = (db: TmDb, projectId: number) => {
  const suites = db.prepare('SELECT id, parent_id, name FROM tm_suites WHERE project_id = ?').all(projectId) as {
    id: number;
    parent_id: number | null;
    name: string;
  }[];
  const byId = new Map(suites.map((s) => [s.id, s]));

  return (suiteId: number): string[] => {
    const path: string[] = [];

    for (let s = byId.get(suiteId); s; s = s.parent_id ? byId.get(s.parent_id) : undefined) path.unshift(s.name);

    return path;
  };
};

export const createRun = (
  db: TmDb,
  input: { projectId: number; name: string; source: RunSource; assignee?: string | null; by: string },
): RunSummary => {
  const name = input.name.trim();

  if (!name) throw new TmError('invalid', 'name is required');
  const caseIds = resolveCaseIds(db, input.projectId, input.source);

  if (!caseIds.length) throw new TmError('invalid', 'no cases match this selection');

  const pathOf = suitePaths(db, input.projectId);
  const snapshots = caseIds
    .map((id) => {
      const c = getCase(db, id);
      const snapshot: CaseSnapshot = {
        label: c.label,
        title: c.title,
        preconditions: c.preconditions,
        steps: c.steps.map(({ action, expected }) => ({ action, expected })),
        suitePath: pathOf(c.suiteId),
      };

      return { id, number: c.number, snapshot };
    })
    // Grouped by suite path, then by case number — the order testers work through.
    .sort((a, b) => a.snapshot.suitePath.join(' / ').localeCompare(b.snapshot.suitePath.join(' / ')) || a.number - b.number);

  const runId = db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO tm_runs (project_id, name, created_by, created_at) VALUES (?, ?, ?, ?)')
      .run(input.projectId, name, input.by, now());
    const insert = db.prepare('INSERT INTO tm_run_cases (run_id, case_id, snapshot, assignee) VALUES (?, ?, ?, ?)');

    for (const s of snapshots) insert.run(lastInsertRowid, s.id, JSON.stringify(s.snapshot), input.assignee ?? null);

    return Number(lastInsertRowid);
  })();

  return toSummary(db, getRunRow(db, runId));
};

export const listRuns = (db: TmDb, projectId: number): RunSummary[] =>
  (db.prepare('SELECT * FROM tm_runs WHERE project_id = ? ORDER BY id DESC').all(projectId) as RunRow[]).map((row) =>
    toSummary(db, row),
  );

export const getRun = (db: TmDb, id: number): { run: RunSummary; projectId: number; cases: RunCaseView[] } => {
  const row = getRunRow(db, id);
  const cases = (db.prepare('SELECT * FROM tm_run_cases WHERE run_id = ? ORDER BY id').all(id) as RunCaseRow[]).map(
    toView,
  );

  return { run: toSummary(db, row), projectId: row.project_id, cases };
};

export const updateRunCase = (
  db: TmDb,
  runCaseId: number,
  patch: { result?: Result; comment?: string; assignee?: string | null },
  by: string,
): RunCaseView => {
  const row = db.prepare('SELECT * FROM tm_run_cases WHERE id = ?').get(runCaseId) as RunCaseRow | undefined;

  if (!row) throw new TmError('not_found', `run case ${runCaseId} not found`);
  if (getRunRow(db, row.run_id).status === 'completed') throw new TmError('invalid', 'run is completed');

  db.transaction(() => {
    if (patch.result !== undefined && patch.result !== row.result) {
      db.prepare('UPDATE tm_run_cases SET result = ?, result_by = ?, result_at = ? WHERE id = ?').run(
        patch.result,
        by,
        now(),
        runCaseId,
      );
    }
    if (patch.comment !== undefined) {
      db.prepare('UPDATE tm_run_cases SET comment = ? WHERE id = ?').run(patch.comment.trim(), runCaseId);
    }
    if (patch.assignee !== undefined) {
      db.prepare('UPDATE tm_run_cases SET assignee = ? WHERE id = ?').run(patch.assignee, runCaseId);
    }
  })();

  return toView(db.prepare('SELECT * FROM tm_run_cases WHERE id = ?').get(runCaseId) as RunCaseRow);
};

export const completeRun = (db: TmDb, id: number): RunSummary => {
  getRunRow(db, id);
  db.prepare("UPDATE tm_runs SET status = 'completed', completed_at = ? WHERE id = ? AND status != 'completed'").run(
    now(),
    id,
  );

  return toSummary(db, getRunRow(db, id));
};
