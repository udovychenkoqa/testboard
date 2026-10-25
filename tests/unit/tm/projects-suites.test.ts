import { openDb, type TmDb } from '@/app/lib/tm/db';
import { TmError } from '@/app/lib/tm/errors';
import { createProject, deleteProject, getProject, listProjects, updateProject } from '@/app/lib/tm/projects';
import { createSuite, deleteSuite, listSuites, updateSuite } from '@/app/lib/tm/suites';

// Cases arrive in Task 4; raw rows are enough to test counts and cascades here.
const insertCase = (db: TmDb, projectId: number, suiteId: number, number: number, automation = 'manual') =>
  db
    .prepare(
      `INSERT INTO tm_cases (project_id, suite_id, number, title, automation, created_by, created_at, updated_by, updated_at)
       VALUES (?, ?, ?, 'c', ?, 't', 'now', 't', 'now')`,
    )
    .run(projectId, suiteId, number, automation);

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof TmError ? error.code : String(error);
  }

  return 'no error';
};

let db: TmDb;

beforeEach(() => {
  db = openDb(':memory:');
});

describe('projects', () => {
  it('creates and reads a project', () => {
    const p = createProject(db, { key: 'hanimax-web', name: 'Hanimax Web', code: 'HW' });

    expect(p).toMatchObject({ key: 'hanimax-web', name: 'Hanimax Web', code: 'HW', nextCaseNumber: 1 });
    expect(getProject(db, 'hanimax-web').id).toBe(p.id);
  });

  it.each([
    [{ key: 'Hanimax Web', name: 'x', code: 'HW' }],
    [{ key: 'hanimax web', name: 'x', code: 'HW' }],
    [{ key: '', name: 'x', code: 'HW' }],
    [{ key: 'hw', name: 'x', code: 'hw' }],
    [{ key: 'hw', name: 'x', code: 'H' }],
    [{ key: 'hw', name: 'x', code: '1HW' }],
    [{ key: 'hw', name: '  ', code: 'HW' }],
  ])('rejects invalid input %j', (input) => {
    expect(code(() => createProject(db, input))).toBe('invalid');
  });

  it('rejects a duplicate key or code', () => {
    createProject(db, { key: 'hw', name: 'A', code: 'HW' });
    expect(code(() => createProject(db, { key: 'hw', name: 'B', code: 'HB' }))).toBe('conflict');
    expect(code(() => createProject(db, { key: 'hb', name: 'B', code: 'HW' }))).toBe('conflict');
  });

  it('lists projects with case and automation counts', () => {
    const p = createProject(db, { key: 'hw', name: 'A', code: 'HW' });
    const s = createSuite(db, { projectId: p.id, name: 'Root' });

    insertCase(db, p.id, s.id, 1, 'automated');
    insertCase(db, p.id, s.id, 2);
    db.prepare('UPDATE tm_cases SET deleted_at = ? WHERE number = 2').run('now');
    insertCase(db, p.id, s.id, 3);

    expect(listProjects(db)).toEqual([expect.objectContaining({ key: 'hw', caseCount: 2, automatedCount: 1 })]);
  });

  it('renames, and refuses to delete a project that has cases', () => {
    const p = createProject(db, { key: 'hw', name: 'A', code: 'HW' });

    expect(updateProject(db, 'hw', { name: 'Hanimax' }).name).toBe('Hanimax');
    insertCase(db, p.id, createSuite(db, { projectId: p.id, name: 'S' }).id, 1);
    expect(code(() => deleteProject(db, 'hw'))).toBe('not_empty');
  });

  it('deletes an empty project and reports unknown keys', () => {
    createProject(db, { key: 'hw', name: 'A', code: 'HW' });
    deleteProject(db, 'hw');
    expect(code(() => getProject(db, 'hw'))).toBe('not_found');
  });
});

describe('suites', () => {
  let projectId: number;

  beforeEach(() => {
    projectId = createProject(db, { key: 'hw', name: 'A', code: 'HW' }).id;
  });

  it('builds a tree ordered by position with case counts', () => {
    const a = createSuite(db, { projectId, name: 'Auth' });
    const b = createSuite(db, { projectId, name: 'Cart' });
    const a1 = createSuite(db, { projectId, parentId: a.id, name: 'Login' });

    insertCase(db, projectId, a1.id, 1);

    expect(listSuites(db, projectId)).toEqual([
      { id: a.id, parentId: null, name: 'Auth', position: 0, caseCount: 0 },
      { id: b.id, parentId: null, name: 'Cart', position: 1, caseCount: 0 },
      { id: a1.id, parentId: a.id, name: 'Login', position: 0, caseCount: 1 },
    ]);
  });

  it('renames and moves a suite', () => {
    const a = createSuite(db, { projectId, name: 'Auth' });
    const b = createSuite(db, { projectId, name: 'Cart' });

    expect(updateSuite(db, b.id, { name: 'Basket', parentId: a.id })).toMatchObject({ name: 'Basket', parentId: a.id });
  });

  it('rejects moving a suite under itself or its descendant', () => {
    const a = createSuite(db, { projectId, name: 'A' });
    const b = createSuite(db, { projectId, parentId: a.id, name: 'B' });
    const c = createSuite(db, { projectId, parentId: b.id, name: 'C' });

    expect(code(() => updateSuite(db, a.id, { parentId: a.id }))).toBe('invalid');
    expect(code(() => updateSuite(db, a.id, { parentId: c.id }))).toBe('invalid');
  });

  it('rejects a parent from another project', () => {
    const other = createProject(db, { key: 'ot', name: 'O', code: 'OT' });
    const foreign = createSuite(db, { projectId: other.id, name: 'X' });

    expect(code(() => createSuite(db, { projectId, parentId: foreign.id, name: 'Y' }))).toBe('invalid');
  });

  it('soft-deletes a suite with its descendants and their cases', () => {
    const a = createSuite(db, { projectId, name: 'A' });
    const b = createSuite(db, { projectId, parentId: a.id, name: 'B' });
    const keep = createSuite(db, { projectId, name: 'Keep' });

    insertCase(db, projectId, b.id, 1);
    insertCase(db, projectId, keep.id, 2);
    deleteSuite(db, a.id);

    expect(listSuites(db, projectId).map((s) => s.name)).toEqual(['Keep']);
    const live = db.prepare('SELECT number FROM tm_cases WHERE deleted_at IS NULL').all();

    expect(live).toEqual([{ number: 2 }]);
  });
});
