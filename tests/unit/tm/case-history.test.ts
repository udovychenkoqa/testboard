import { openDb, type TmDb } from '@/app/lib/tm/db';
import { createCase, moveCases, updateCase } from '@/app/lib/tm/cases';
import { listCaseHistory } from '@/app/lib/tm/caseHistory';
import { createProject } from '@/app/lib/tm/projects';
import { createSuite } from '@/app/lib/tm/suites';

let db: TmDb;
let projectId: number;
let suiteId: number;

beforeEach(() => {
  db = openDb(':memory:');
  projectId = createProject(db, { key: 'hw', name: 'HanimaX', code: 'HAN' }).id;
  suiteId = createSuite(db, { projectId, name: 'Player' }).id;
});

const newCase = () =>
  createCase(
    db,
    projectId,
    { suiteId, title: 'Video plays', priority: 'medium', tags: ['smoke'], steps: [{ action: 'Open', expected: 'Plays' }] },
    'anna@x.co',
  );

describe('case history', () => {
  it('is empty for a case nobody has edited', () => {
    expect(listCaseHistory(db, newCase().id)).toEqual([]);
  });

  it('records who changed which fields, with the old and new value', () => {
    const { id } = newCase();

    updateCase(db, id, { title: 'Video plays on mobile', priority: 'high' }, 'bob@x.co');

    const [entry] = listCaseHistory(db, id);

    expect(entry.changedBy).toBe('bob@x.co');
    expect(entry.changedAt).toBeTruthy();
    expect(entry.changes).toEqual([
      { field: 'title', from: 'Video plays', to: 'Video plays on mobile' },
      { field: 'priority', from: 'medium', to: 'high' },
    ]);
  });

  it('records steps and tags as whole lists', () => {
    const { id } = newCase();

    updateCase(
      db,
      id,
      { tags: ['smoke', 'player'], steps: [{ action: 'Open', expected: 'Plays' }, { action: 'Pause', expected: 'Stops' }] },
      'bob@x.co',
    );

    expect(listCaseHistory(db, id)[0].changes).toEqual([
      {
        field: 'steps',
        from: [{ action: 'Open', expected: 'Plays' }],
        to: [
          { action: 'Open', expected: 'Plays' },
          { action: 'Pause', expected: 'Stops' },
        ],
      },
      { field: 'tags', from: ['smoke'], to: ['player', 'smoke'] },
    ]);
  });

  it('writes nothing when a save changes nothing', () => {
    const { id } = newCase();

    updateCase(db, id, { title: 'Video plays', priority: 'medium', tags: ['smoke'] }, 'bob@x.co');

    expect(listCaseHistory(db, id)).toEqual([]);
  });

  it('names the suites when a case moves, by edit or by drag and drop', () => {
    const other = createSuite(db, { projectId, name: 'Admin' }).id;
    const { id } = newCase();

    updateCase(db, id, { suiteId: other }, 'bob@x.co');
    moveCases(db, [id], suiteId, 'cara@x.co');

    const history = listCaseHistory(db, id);

    expect(history.map((entry) => [entry.changedBy, entry.changes])).toEqual([
      ['cara@x.co', [{ field: 'suite', from: 'Admin', to: 'Player' }]],
      ['bob@x.co', [{ field: 'suite', from: 'Player', to: 'Admin' }]],
    ]);
  });

  it('lists the newest change first', () => {
    const { id } = newCase();

    updateCase(db, id, { status: 'draft' }, 'bob@x.co');
    updateCase(db, id, { status: 'actual' }, 'cara@x.co');

    expect(listCaseHistory(db, id).map((entry) => entry.changedBy)).toEqual(['cara@x.co', 'bob@x.co']);
  });
});
