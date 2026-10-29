import { type TmDb } from './db';
import { now, TmError } from './errors';
import { getProjectById } from './projects';
import { suiteSubtreeIds } from './suites';
import { type Automation, type CaseStatus, type Priority } from './constants';

export { AUTOMATION, CASE_STATUSES, PRIORITIES, type Automation, type CaseStatus, type Priority } from './constants';

export interface StepInput {
  action: string;
  expected: string;
}

export interface CaseInput {
  suiteId: number;
  title: string;
  description?: string;
  preconditions?: string;
  priority?: Priority;
  status?: CaseStatus;
  automation?: Automation;
  steps?: StepInput[];
  tags?: string[];
}

export interface CaseListItem {
  id: number;
  label: string;
  number: number;
  suiteId: number;
  title: string;
  priority: Priority;
  status: CaseStatus;
  automation: Automation;
  tags: string[];
}

export interface CaseDetail extends CaseListItem {
  description: string;
  preconditions: string;
  steps: (StepInput & { id: number })[];
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface CaseFilter {
  suiteId?: number;
  q?: string;
  priority?: Priority;
  status?: CaseStatus;
  automation?: Automation;
  tag?: string;
}

interface CaseRow {
  id: number;
  project_id: number;
  suite_id: number;
  number: number;
  title: string;
  description: string;
  preconditions: string;
  priority: Priority;
  status: CaseStatus;
  automation: Automation;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  code: string;
}

const normalizeTags = (tags: string[]) => [...new Set(tags.map((t) => t.trim()).filter(Boolean))].sort();

const tagsOf = (db: TmDb, caseId: number) =>
  (db.prepare('SELECT tag FROM tm_case_tags WHERE case_id = ? ORDER BY tag').all(caseId) as { tag: string }[]).map(
    (row) => row.tag,
  );

const stepsOf = (db: TmDb, caseId: number) =>
  db
    .prepare('SELECT id, action, expected FROM tm_case_steps WHERE case_id = ? ORDER BY position')
    .all(caseId) as CaseDetail['steps'];

const toListItem = (db: TmDb, row: CaseRow): CaseListItem => ({
  id: row.id,
  label: `${row.code}-${row.number}`,
  number: row.number,
  suiteId: row.suite_id,
  title: row.title,
  priority: row.priority,
  status: row.status,
  automation: row.automation,
  tags: tagsOf(db, row.id),
});

const CASE_SELECT = 'SELECT c.*, p.code FROM tm_cases c JOIN tm_projects p ON p.id = c.project_id';

export const getCase = (db: TmDb, id: number): CaseDetail => {
  const row = db.prepare(`${CASE_SELECT} WHERE c.id = ? AND c.deleted_at IS NULL`).get(id) as CaseRow | undefined;

  if (!row) throw new TmError('not_found', `case ${id} not found`);

  return {
    ...toListItem(db, row),
    description: row.description,
    preconditions: row.preconditions,
    steps: stepsOf(db, id),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
};

const checkSuite = (db: TmDb, projectId: number, suiteId: number) => {
  const suite = db.prepare('SELECT project_id FROM tm_suites WHERE id = ? AND deleted_at IS NULL').get(suiteId) as
    | { project_id: number }
    | undefined;

  if (!suite || suite.project_id !== projectId) throw new TmError('invalid', 'suite not found in this project');
};

const writeSteps = (db: TmDb, caseId: number, steps: StepInput[]) => {
  db.prepare('DELETE FROM tm_case_steps WHERE case_id = ?').run(caseId);
  const insert = db.prepare('INSERT INTO tm_case_steps (case_id, position, action, expected) VALUES (?, ?, ?, ?)');

  steps
    .filter((s) => s.action.trim() || s.expected.trim())
    .forEach((s, i) => insert.run(caseId, i, s.action.trim(), s.expected.trim()));
};

const writeTags = (db: TmDb, caseId: number, tags: string[]) => {
  db.prepare('DELETE FROM tm_case_tags WHERE case_id = ?').run(caseId);
  const insert = db.prepare('INSERT INTO tm_case_tags (case_id, tag) VALUES (?, ?)');

  normalizeTags(tags).forEach((tag) => insert.run(caseId, tag));
};

export const createCase = (db: TmDb, projectId: number, input: CaseInput, by: string): CaseDetail => {
  const title = input.title.trim();

  if (!title) throw new TmError('invalid', 'title is required');
  checkSuite(db, projectId, input.suiteId);

  const id = db.transaction(() => {
    // Numbers come from the project's counter, so a deleted case's number is never handed out again.
    const { nextCaseNumber } = getProjectById(db, projectId);
    const at = now();

    db.prepare('UPDATE tm_projects SET next_case_number = ? WHERE id = ?').run(nextCaseNumber + 1, projectId);
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO tm_cases (project_id, suite_id, number, title, description, preconditions,
                               priority, status, automation, created_by, created_at, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        projectId,
        input.suiteId,
        nextCaseNumber,
        title,
        input.description?.trim() ?? '',
        input.preconditions?.trim() ?? '',
        input.priority ?? 'medium',
        input.status ?? 'actual',
        input.automation ?? 'manual',
        by,
        at,
        by,
        at,
      );
    const caseId = Number(lastInsertRowid);

    writeSteps(db, caseId, input.steps ?? []);
    writeTags(db, caseId, input.tags ?? []);

    return caseId;
  })();

  return getCase(db, id);
};

const FIELD_COLUMNS = {
  suiteId: 'suite_id',
  title: 'title',
  description: 'description',
  preconditions: 'preconditions',
  priority: 'priority',
  status: 'status',
  automation: 'automation',
} as const;

export const updateCase = (db: TmDb, id: number, patch: Partial<CaseInput>, by: string): CaseDetail => {
  const current = getCase(db, id);
  const { project_id: projectId } = db.prepare('SELECT project_id FROM tm_cases WHERE id = ?').get(id) as {
    project_id: number;
  };

  if (patch.title !== undefined && !patch.title.trim()) throw new TmError('invalid', 'title is required');
  if (patch.suiteId !== undefined && patch.suiteId !== current.suiteId) checkSuite(db, projectId, patch.suiteId);

  db.transaction(() => {
    for (const [field, column] of Object.entries(FIELD_COLUMNS)) {
      const value = patch[field as keyof typeof FIELD_COLUMNS];

      if (value === undefined) continue;
      db.prepare(`UPDATE tm_cases SET ${column} = ? WHERE id = ?`).run(
        typeof value === 'string' ? value.trim() : value,
        id,
      );
    }
    if (patch.steps) writeSteps(db, id, patch.steps);
    if (patch.tags) writeTags(db, id, patch.tags);
    db.prepare('UPDATE tm_cases SET updated_by = ?, updated_at = ? WHERE id = ?').run(by, now(), id);
  })();

  return getCase(db, id);
};

export const listCases = (db: TmDb, projectId: number, filter: CaseFilter): CaseListItem[] => {
  const where = ['c.project_id = ?', 'c.deleted_at IS NULL'];
  const params: (string | number)[] = [projectId];

  if (filter.suiteId !== undefined) {
    const ids = suiteSubtreeIds(db, filter.suiteId);

    where.push(`c.suite_id IN (${ids.map(() => '?').join(',')})`);
    params.push(...ids);
  }
  if (filter.q?.trim()) {
    const like = `%${filter.q.trim().toLowerCase()}%`;

    where.push(`(LOWER(c.title) LIKE ? OR LOWER(p.code || '-' || c.number) LIKE ?)`);
    params.push(like, like);
  }
  for (const key of ['priority', 'status', 'automation'] as const) {
    if (filter[key]) {
      where.push(`c.${key} = ?`);
      params.push(filter[key] as string);
    }
  }
  if (filter.tag) {
    where.push('EXISTS (SELECT 1 FROM tm_case_tags t WHERE t.case_id = c.id AND t.tag = ?)');
    params.push(filter.tag);
  }

  const rows = db.prepare(`${CASE_SELECT} WHERE ${where.join(' AND ')} ORDER BY c.number`).all(...params) as CaseRow[];

  return rows.map((row) => toListItem(db, row));
};

const inList = (ids: number[]) => ids.map(() => '?').join(',');

export const deleteCases = (db: TmDb, ids: number[]): void => {
  if (!ids.length) return;
  db.prepare(`UPDATE tm_cases SET deleted_at = ? WHERE deleted_at IS NULL AND id IN (${inList(ids)})`).run(
    now(),
    ...ids,
  );
};

export const moveCases = (db: TmDb, ids: number[], suiteId: number): void => {
  if (!ids.length) return;
  const projects = db.prepare(`SELECT DISTINCT project_id FROM tm_cases WHERE id IN (${inList(ids)})`).all(...ids) as {
    project_id: number;
  }[];

  if (projects.length !== 1) throw new TmError('invalid', 'cases must belong to one project');
  checkSuite(db, projects[0].project_id, suiteId);
  db.prepare(`UPDATE tm_cases SET suite_id = ? WHERE id IN (${inList(ids)})`).run(suiteId, ...ids);
};

export interface TagUsage {
  tag: string;
  count: number;
}

// Tags already used on the project's live cases, most used first — suggestions for the tags field.
export const listTags = (db: TmDb, projectId: number): TagUsage[] =>
  db
    .prepare(
      `SELECT t.tag, COUNT(*) AS count FROM tm_case_tags t JOIN tm_cases c ON c.id = t.case_id
       WHERE c.project_id = ? AND c.deleted_at IS NULL GROUP BY t.tag ORDER BY count DESC, t.tag`,
    )
    .all(projectId) as TagUsage[];
