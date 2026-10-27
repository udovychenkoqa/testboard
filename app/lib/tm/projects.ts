import { type TmDb } from './db';
import { now, TmError } from './errors';

export const PROJECT_KEY_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
export const PROJECT_CODE_RE = /^[A-Z][A-Z0-9]{1,9}$/;

export interface Project {
  id: number;
  key: string;
  name: string;
  code: string;
  nextCaseNumber: number;
  createdAt: string;
}

export interface ProjectSummary extends Project {
  caseCount: number;
  automatedCount: number;
}

interface ProjectRow {
  id: number;
  key: string;
  name: string;
  code: string;
  next_case_number: number;
  created_at: string;
}

const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  key: row.key,
  name: row.name,
  code: row.code,
  nextCaseNumber: row.next_case_number,
  createdAt: row.created_at,
});

export const getProject = (db: TmDb, key: string): Project => {
  const row = db.prepare('SELECT * FROM tm_projects WHERE key = ?').get(key) as ProjectRow | undefined;

  if (!row) throw new TmError('not_found', `project "${key}" not found`);

  return toProject(row);
};

export const getProjectById = (db: TmDb, id: number): Project => {
  const row = db.prepare('SELECT * FROM tm_projects WHERE id = ?').get(id) as ProjectRow | undefined;

  if (!row) throw new TmError('not_found', `project ${id} not found`);

  return toProject(row);
};

export const createProject = (db: TmDb, input: { key: string; name: string; code: string }): Project => {
  const name = input.name.trim();

  if (!PROJECT_KEY_RE.test(input.key)) {
    throw new TmError('invalid', 'key: lowercase letters, digits, ".", "_" or "-", up to 64 characters');
  }
  if (!PROJECT_CODE_RE.test(input.code)) {
    throw new TmError('invalid', 'code: 2–10 uppercase letters or digits, starting with a letter');
  }
  if (!name) throw new TmError('invalid', 'name is required');

  const clash = db.prepare('SELECT key, code FROM tm_projects WHERE key = ? OR code = ?').get(input.key, input.code) as
    | { key: string; code: string }
    | undefined;

  if (clash) {
    throw new TmError(
      'conflict',
      clash.key === input.key ? `key "${input.key}" is taken` : `code "${input.code}" is taken`,
    );
  }

  const { lastInsertRowid } = db
    .prepare('INSERT INTO tm_projects (key, name, code, created_at) VALUES (?, ?, ?, ?)')
    .run(input.key, name, input.code, now());

  return getProjectById(db, Number(lastInsertRowid));
};

export const listProjects = (db: TmDb): ProjectSummary[] => {
  const rows = db
    .prepare(
      `SELECT p.*,
              COUNT(c.id) AS case_count,
              COALESCE(SUM(c.automation = 'automated'), 0) AS automated_count
         FROM tm_projects p
         LEFT JOIN tm_cases c ON c.project_id = p.id AND c.deleted_at IS NULL
        GROUP BY p.id
        ORDER BY p.name COLLATE NOCASE`,
    )
    .all() as (ProjectRow & { case_count: number; automated_count: number })[];

  return rows.map((row) => ({ ...toProject(row), caseCount: row.case_count, automatedCount: row.automated_count }));
};

export const updateProject = (db: TmDb, key: string, patch: { name?: string }): Project => {
  const project = getProject(db, key);

  if (patch.name !== undefined) {
    const name = patch.name.trim();

    if (!name) throw new TmError('invalid', 'name is required');
    db.prepare('UPDATE tm_projects SET name = ? WHERE id = ?').run(name, project.id);
  }

  return getProjectById(db, project.id);
};

// Removes the project with everything in it: runs and their results, cases (steps and tags cascade),
// suites. Irreversible — the UI makes the user type the project key first.
export const deleteProject = (db: TmDb, key: string): void => {
  const { id } = getProject(db, key);

  db.transaction(() => {
    db.prepare('DELETE FROM tm_run_cases WHERE run_id IN (SELECT id FROM tm_runs WHERE project_id = ?)').run(id);
    db.prepare('DELETE FROM tm_runs WHERE project_id = ?').run(id);
    db.prepare('DELETE FROM tm_cases WHERE project_id = ?').run(id);
    db.prepare('DELETE FROM tm_suites WHERE project_id = ?').run(id);
    db.prepare('DELETE FROM tm_projects WHERE id = ?').run(id);
  })();
};
