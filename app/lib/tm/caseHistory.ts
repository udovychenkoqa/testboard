import type { CaseDetail } from './cases';

import { type TmDb } from './db';
import { now } from './errors';

// What changed in a test case, when, and who did it. One entry per save; values are kept as they read at the
// time (a suite by its name), so an entry still makes sense after the suite is renamed or removed.

export type CaseHistoryField =
  | 'title'
  | 'description'
  | 'preconditions'
  | 'priority'
  | 'status'
  | 'automation'
  | 'suite'
  | 'steps'
  | 'tags';

export interface CaseChange {
  field: CaseHistoryField;
  from: unknown;
  to: unknown;
}

export interface CaseHistoryEntry {
  id: number;
  changedBy: string;
  changedAt: string;
  changes: CaseChange[];
}

const TEXT_FIELDS = ['title', 'description', 'preconditions', 'priority', 'status', 'automation'] as const;

const suiteName = (db: TmDb, id: number): string =>
  (db.prepare('SELECT name FROM tm_suites WHERE id = ?').get(id) as { name: string } | undefined)?.name ?? `#${id}`;

const plainSteps = (steps: CaseDetail['steps']) => steps.map(({ action, expected }) => ({ action, expected }));

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export const diffCase = (db: TmDb, before: CaseDetail, after: CaseDetail): CaseChange[] => {
  const changes: CaseChange[] = [];

  for (const field of TEXT_FIELDS) {
    if (before[field] !== after[field]) changes.push({ field, from: before[field], to: after[field] });
  }
  if (before.suiteId !== after.suiteId) {
    changes.push({ field: 'suite', from: suiteName(db, before.suiteId), to: suiteName(db, after.suiteId) });
  }
  if (!same(plainSteps(before.steps), plainSteps(after.steps))) {
    changes.push({ field: 'steps', from: plainSteps(before.steps), to: plainSteps(after.steps) });
  }
  if (!same(before.tags, after.tags)) changes.push({ field: 'tags', from: before.tags, to: after.tags });

  return changes;
};

// A save that changed nothing leaves no entry.
export const recordCaseChanges = (db: TmDb, caseId: number, by: string, changes: CaseChange[]): void => {
  if (!changes.length) return;
  db.prepare('INSERT INTO tm_case_history (case_id, changed_by, changed_at, changes) VALUES (?, ?, ?, ?)').run(
    caseId,
    by,
    now(),
    JSON.stringify(changes),
  );
};

export const listCaseHistory = (db: TmDb, caseId: number): CaseHistoryEntry[] =>
  (
    db
      .prepare('SELECT id, changed_by, changed_at, changes FROM tm_case_history WHERE case_id = ? ORDER BY id DESC')
      .all(caseId) as { id: number; changed_by: string; changed_at: string; changes: string }[]
  ).map((row) => ({
    id: row.id,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
    changes: JSON.parse(row.changes) as CaseChange[],
  }));
