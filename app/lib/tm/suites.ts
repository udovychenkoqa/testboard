import { type TmDb } from './db';
import { now, TmError } from './errors';

export interface SuiteNode {
  id: number;
  parentId: number | null;
  name: string;
  position: number;
  caseCount: number;
}

interface SuiteRow {
  id: number;
  project_id: number;
  parent_id: number | null;
  name: string;
  position: number;
}

const getSuiteRow = (db: TmDb, id: number): SuiteRow => {
  const row = db.prepare('SELECT * FROM tm_suites WHERE id = ? AND deleted_at IS NULL').get(id) as SuiteRow | undefined;

  if (!row) throw new TmError('not_found', `suite ${id} not found`);

  return row;
};

// The suite and every live suite below it.
export const suiteSubtreeIds = (db: TmDb, id: number): number[] =>
  (
    db
      .prepare(
        `WITH RECURSIVE sub(id) AS (
           SELECT ? UNION ALL
           SELECT s.id FROM tm_suites s JOIN sub ON s.parent_id = sub.id WHERE s.deleted_at IS NULL
         )
         SELECT id FROM sub`,
      )
      .all(id) as { id: number }[]
  ).map((row) => row.id);

export const listSuites = (db: TmDb, projectId: number): SuiteNode[] => {
  const rows = db
    .prepare(
      `SELECT s.id, s.parent_id, s.name, s.position, COUNT(c.id) AS case_count
         FROM tm_suites s
         LEFT JOIN tm_cases c ON c.suite_id = s.id AND c.deleted_at IS NULL
        WHERE s.project_id = ? AND s.deleted_at IS NULL
        GROUP BY s.id
        ORDER BY s.parent_id IS NOT NULL, s.parent_id, s.position, s.id`,
    )
    .all(projectId) as (Omit<SuiteRow, 'project_id'> & { case_count: number })[];

  return rows.map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    position: row.position,
    caseCount: row.case_count,
  }));
};

const toNode = (db: TmDb, id: number): SuiteNode => {
  const row = getSuiteRow(db, id);
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM tm_cases WHERE suite_id = ? AND deleted_at IS NULL').get(id) as {
    n: number;
  };

  return { id: row.id, parentId: row.parent_id, name: row.name, position: row.position, caseCount: n };
};

const checkParent = (db: TmDb, projectId: number, parentId: number) => {
  const parent = getSuiteRow(db, parentId);

  if (parent.project_id !== projectId) throw new TmError('invalid', 'parent suite belongs to another project');
};

const nextPosition = (db: TmDb, projectId: number, parentId: number | null) =>
  (
    db
      .prepare('SELECT COUNT(*) AS n FROM tm_suites WHERE project_id = ? AND parent_id IS ? AND deleted_at IS NULL')
      .get(projectId, parentId) as { n: number }
  ).n;

export const createSuite = (
  db: TmDb,
  input: { projectId: number; parentId?: number | null; name: string },
): SuiteNode => {
  const name = input.name.trim();
  const parentId = input.parentId ?? null;

  if (!name) throw new TmError('invalid', 'name is required');
  if (parentId !== null) checkParent(db, input.projectId, parentId);

  const { lastInsertRowid } = db
    .prepare('INSERT INTO tm_suites (project_id, parent_id, name, position) VALUES (?, ?, ?, ?)')
    .run(input.projectId, parentId, name, nextPosition(db, input.projectId, parentId));

  return toNode(db, Number(lastInsertRowid));
};

export const updateSuite = (db: TmDb, id: number, patch: { name?: string; parentId?: number | null }): SuiteNode => {
  const suite = getSuiteRow(db, id);

  if (patch.name !== undefined) {
    const name = patch.name.trim();

    if (!name) throw new TmError('invalid', 'name is required');
    db.prepare('UPDATE tm_suites SET name = ? WHERE id = ?').run(name, id);
  }

  if (patch.parentId !== undefined && patch.parentId !== suite.parent_id) {
    const parentId = patch.parentId;

    if (parentId !== null) {
      checkParent(db, suite.project_id, parentId);
      if (suiteSubtreeIds(db, id).includes(parentId)) {
        throw new TmError('invalid', 'a suite cannot move under itself or its own descendant');
      }
    }
    db.prepare('UPDATE tm_suites SET parent_id = ?, position = ? WHERE id = ?').run(
      parentId,
      nextPosition(db, suite.project_id, parentId),
      id,
    );
  }

  return toNode(db, id);
};

// Soft delete: the suite, everything below it and their cases disappear from
// the repository but stay referenced by past runs.
export const deleteSuite = (db: TmDb, id: number): void => {
  getSuiteRow(db, id);
  const ids = suiteSubtreeIds(db, id);
  const placeholders = ids.map(() => '?').join(',');
  const at = now();

  db.transaction(() => {
    db.prepare(`UPDATE tm_suites SET deleted_at = ? WHERE id IN (${placeholders})`).run(at, ...ids);
    db.prepare(`UPDATE tm_cases SET deleted_at = ? WHERE deleted_at IS NULL AND suite_id IN (${placeholders})`).run(
      at,
      ...ids,
    );
  })();
};
