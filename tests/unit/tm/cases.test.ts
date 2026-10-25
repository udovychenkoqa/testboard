import { openDb, type TmDb } from '@/app/lib/tm/db';
import { TmError } from '@/app/lib/tm/errors';
import { createProject } from '@/app/lib/tm/projects';
import { createSuite } from '@/app/lib/tm/suites';
import { createCase, deleteCases, getCase, listCases, moveCases, updateCase } from '@/app/lib/tm/cases';

let db: TmDb;
let projectId: number;
let auth: number;
let login: number;
let cart: number;

beforeEach(() => {
  db = openDb(':memory:');
  projectId = createProject(db, { key: 'hw', name: 'Hanimax', code: 'HW' }).id;
  auth = createSuite(db, { projectId, name: 'Auth' }).id;
  login = createSuite(db, { projectId, parentId: auth, name: 'Login' }).id;
  cart = createSuite(db, { projectId, name: 'Cart' }).id;
});

const make = (title: string, extra: Record<string, unknown> = {}) =>
  createCase(db, projectId, { suiteId: login, title, ...extra }, 'qa@example.com');

describe('cases', () => {
  it('creates a case with defaults, steps and tags', () => {
    const c = make('User signs in', {
      preconditions: 'Account exists',
      steps: [
        { action: 'Open /login', expected: 'Form shown' },
        { action: 'Submit valid creds', expected: 'Dashboard opens' },
      ],
      tags: [' smoke ', 'auth', 'smoke'],
    });

    expect(c).toMatchObject({
      label: 'HW-1',
      number: 1,
      suiteId: login,
      title: 'User signs in',
      preconditions: 'Account exists',
      priority: 'medium',
      status: 'actual',
      automation: 'manual',
      createdBy: 'qa@example.com',
      tags: ['auth', 'smoke'],
    });
    expect(c.steps.map((s) => s.action)).toEqual(['Open /login', 'Submit valid creds']);
  });

  it('never reuses a number after a delete', () => {
    make('a');
    make('b');
    const third = make('c');

    deleteCases(db, [third.id]);
    expect(make('d').label).toBe('HW-4');
  });

  it('rejects a blank title and a suite from another project', () => {
    const other = createProject(db, { key: 'ot', name: 'O', code: 'OT' });
    const foreign = createSuite(db, { projectId: other.id, name: 'X' });

    expect(() => make('   ')).toThrow(TmError);
    expect(() => createCase(db, projectId, { suiteId: foreign.id, title: 'x' }, 'qa')).toThrow(TmError);
  });

  it('updates fields and replaces steps and tags', () => {
    const c = make('Old', { steps: [{ action: 'a', expected: '' }], tags: ['x'] });
    const u = updateCase(
      db,
      c.id,
      {
        title: 'New',
        priority: 'high',
        automation: 'to_automate',
        steps: [{ action: 'b', expected: 'B' }],
        tags: ['y'],
      },
      'lead@example.com',
    );

    expect(u).toMatchObject({
      title: 'New',
      priority: 'high',
      automation: 'to_automate',
      updatedBy: 'lead@example.com',
    });
    expect(u.steps).toEqual([expect.objectContaining({ action: 'b', expected: 'B' })]);
    expect(u.tags).toEqual(['y']);
    expect(updateCase(db, c.id, { description: 'd' }, 'x').steps).toHaveLength(1);
  });

  describe('listing', () => {
    beforeEach(() => {
      make('Sign in', { priority: 'high', tags: ['smoke'] });
      make('Reset password', { automation: 'automated' });
      createCase(db, projectId, { suiteId: cart, title: 'Add to cart', status: 'draft' }, 'qa');
    });

    const titles = (f: Parameters<typeof listCases>[2]) => listCases(db, projectId, f).map((c) => c.title);

    it('includes cases of descendant suites', () => {
      expect(titles({ suiteId: auth })).toEqual(['Sign in', 'Reset password']);
    });

    it('filters by text in title or label, case-insensitively', () => {
      expect(titles({ q: 'SIGN' })).toEqual(['Sign in']);
      expect(titles({ q: 'hw-3' })).toEqual(['Add to cart']);
    });

    it('filters by priority, status, automation and tag', () => {
      expect(titles({ priority: 'high' })).toEqual(['Sign in']);
      expect(titles({ status: 'draft' })).toEqual(['Add to cart']);
      expect(titles({ automation: 'automated' })).toEqual(['Reset password']);
      expect(titles({ tag: 'smoke' })).toEqual(['Sign in']);
    });

    it('hides deleted cases and moves cases between suites', () => {
      const [signIn, reset] = listCases(db, projectId, {});

      deleteCases(db, [signIn.id]);
      moveCases(db, [reset.id], cart);
      expect(titles({ suiteId: cart })).toEqual(['Reset password', 'Add to cart']);
      expect(titles({})).not.toContain('Sign in');
      expect(() => getCase(db, signIn.id)).toThrow(TmError);
    });
  });
});
