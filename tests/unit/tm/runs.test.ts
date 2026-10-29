import { openDb, type TmDb } from '@/app/lib/tm/db';
import { TmError } from '@/app/lib/tm/errors';
import { createProject } from '@/app/lib/tm/projects';
import { createSuite } from '@/app/lib/tm/suites';
import { createCase, updateCase } from '@/app/lib/tm/cases';
import { completeRun, createRun, getRun, listRuns, updateRunCase } from '@/app/lib/tm/runs';

let db: TmDb;
let projectId: number;
let auth: number;
let login: number;
let cart: number;
let ids: Record<string, number>;

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof TmError ? error.code : String(error);
  }

  return 'no error';
};

beforeEach(() => {
  db = openDb(':memory:');
  projectId = createProject(db, { key: 'hw', name: 'Hanimax', code: 'HW' }).id;
  auth = createSuite(db, { projectId, name: 'Auth' }).id;
  login = createSuite(db, { projectId, parentId: auth, name: 'Login' }).id;
  cart = createSuite(db, { projectId, name: 'Cart' }).id;
  const make = (suiteId: number, title: string, extra = {}) =>
    createCase(db, projectId, { suiteId, title, ...extra }, 'qa').id;

  ids = {
    signIn: make(login, 'Sign in', { tags: ['smoke'], steps: [{ action: 'Open', expected: 'Shown' }] }),
    logout: make(auth, 'Log out'),
    add: make(cart, 'Add to cart', { tags: ['smoke'] }),
    old: make(cart, 'Old flow', { status: 'deprecated' }),
  };
});

const run = (source: Parameters<typeof createRun>[1]['source'], extra = {}) =>
  createRun(db, { projectId, name: 'Regression', source, by: 'lead@example.com', ...extra });

const titles = (runId: number) => getRun(db, runId).cases.map((c) => c.snapshot.title);

describe('runs', () => {
  it('takes every live, non-deprecated case for "all"', () => {
    const r = run({ type: 'all' });

    expect(r).toMatchObject({ name: 'Regression', status: 'in_progress', total: 3, createdBy: 'lead@example.com' });
    expect(r.counts).toEqual({ untested: 3, passed: 0, failed: 0, blocked: 0, skipped: 0 });
    expect(titles(r.id)).toEqual(['Log out', 'Sign in', 'Add to cart']);
  });

  it('takes suites with their descendants, tags, or a hand-picked list', () => {
    expect(titles(run({ type: 'suites', suiteIds: [auth] }).id)).toEqual(['Log out', 'Sign in']);
    expect(titles(run({ type: 'tags', tags: ['smoke'] }).id)).toEqual(['Sign in', 'Add to cart']);
    expect(titles(run({ type: 'cases', caseIds: [ids.add] }).id)).toEqual(['Add to cart']);
  });

  it('refuses a run that would contain no cases', () => {
    expect(code(() => run({ type: 'tags', tags: ['nope'] }))).toBe('invalid');
    expect(code(() => run({ type: 'cases', caseIds: [ids.old] }))).toBe('invalid');
  });

  it('keeps the snapshot when the case is edited later', () => {
    const r = run({ type: 'cases', caseIds: [ids.signIn] });

    updateCase(db, ids.signIn, { title: 'Changed', steps: [{ action: 'X', expected: 'Y' }] }, 'qa');
    const [rc] = getRun(db, r.id).cases;

    expect(rc.snapshot).toMatchObject({
      label: 'HW-1',
      title: 'Sign in',
      suitePath: ['Auth', 'Login'],
      steps: [{ action: 'Open', expected: 'Shown' }],
    });
  });

  it('applies a default assignee and records who set each result', () => {
    const r = run({ type: 'suites', suiteIds: [cart] }, { assignee: 'ann@example.com' });
    const [rc] = getRun(db, r.id).cases;

    expect(rc.assignee).toBe('ann@example.com');
    const updated = updateRunCase(db, rc.id, { result: 'failed', comment: 'button missing' }, 'ann@example.com');

    expect(updated).toMatchObject({ result: 'failed', comment: 'button missing', resultBy: 'ann@example.com' });
    expect(updated.resultAt).toBeTruthy();
    expect(updateRunCase(db, rc.id, { assignee: 'bob@example.com' }, 'lead').resultBy).toBe('ann@example.com');
  });

  it('counts results and lists runs newest first', () => {
    const first = run({ type: 'all' });
    const [a, b] = getRun(db, first.id).cases;

    updateRunCase(db, a.id, { result: 'passed' }, 'qa');
    updateRunCase(db, b.id, { result: 'blocked' }, 'qa');
    const second = run({ type: 'cases', caseIds: [ids.add] }, { name: 'Smoke' });

    expect(listRuns(db, projectId).map((r) => r.name)).toEqual(['Smoke', 'Regression']);
    expect(listRuns(db, projectId)[1].counts).toEqual({ untested: 1, passed: 1, failed: 0, blocked: 1, skipped: 0 });
    expect(second.total).toBe(1);
  });

  it('completes a run and then rejects result changes', () => {
    const r = run({ type: 'all' });
    const [rc] = getRun(db, r.id).cases;
    const done = completeRun(db, r.id);

    expect(done.status).toBe('completed');
    expect(done.completedAt).toBeTruthy();
    expect(code(() => updateRunCase(db, rc.id, { result: 'passed' }, 'qa'))).toBe('invalid');
  });
});
