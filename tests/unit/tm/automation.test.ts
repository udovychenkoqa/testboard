import {
  getAutoResult,
  outcomeForCase,
  parseCaseTags,
  parseCaseTitle,
  syncReport,
  type SyncableReport,
} from '@/app/lib/tm/automation';
import { createCase, deleteCases, getCase, updateCase } from '@/app/lib/tm/cases';
import { openDb, type TmDb } from '@/app/lib/tm/db';
import { createProject } from '@/app/lib/tm/projects';
import { completeRun, createRun, getRun, updateRunCase } from '@/app/lib/tm/runs';
import { createSuite } from '@/app/lib/tm/suites';

type Test = SyncableReport['files'][number]['tests'][number];

const test_ = (title: string, tags: string[], outcome: Test['outcome']): Test => ({ title, tags, outcome });

const report = (tests: Test[], extra: Partial<SyncableReport> = {}): SyncableReport => ({
  reportID: 'rep-1',
  project: 'hanimax',
  reportUrl: '/api/serve/hanimax/rep-1/index.html',
  files: [{ tests }],
  ...extra,
});

describe('parseCaseTags', () => {
  it('reads case numbers for the project code, with or without @, any case', () => {
    expect(parseCaseTags(['@smoke', '@HAN-12', 'han-3', '@HAN-12', '@OTHER-5', '@HAN-x', '@HAN-'], 'HAN')).toEqual([
      12, 3,
    ]);
  });
});

describe('parseCaseTitle', () => {
  it('reads the case labels a test title starts with', () => {
    expect(parseCaseTitle('HM-36 the header menu opens', 'HM')).toEqual([36]);
    expect(parseCaseTitle('HM-40 HM-11 the rails list serials', 'HM')).toEqual([40, 11]);
    expect(parseCaseTitle('hm-7, HM-8: both work', 'HM')).toEqual([7, 8]);
  });

  it('ignores labels of other projects and labels that are not at the start', () => {
    expect(parseCaseTitle('OTHER-5 something', 'HM')).toEqual([]);
    expect(parseCaseTitle('opens the page from HM-36', 'HM')).toEqual([]);
    expect(parseCaseTitle('HM-x broken label', 'HM')).toEqual([]);
    expect(parseCaseTitle('', 'HM')).toEqual([]);
  });
});

describe('a report whose tests name their cases in the title', () => {
  it('links them just like tagged tests', () => {
    const db = openDb(':memory:');
    const project = createProject(db, { key: 'hanimax', name: 'HanimaX', code: 'HM' });
    const suite = createSuite(db, { projectId: project.id, name: 'Root' });
    const first = createCase(db, project.id, { suiteId: suite.id, title: 'Header menu' }, 'qa');
    const second = createCase(db, project.id, { suiteId: suite.id, title: 'Rails' }, 'qa');

    const summary = syncReport(db, {
      reportID: 'r1',
      reportUrl: '/api/serve/hanimax/r1/index.html',
      project: 'hanimax',
      files: [
        {
          tests: [
            { title: `HM-${first.number} the header menu opens`, tags: ['@smoke'], outcome: 'expected' },
            { title: `HM-${second.number} HM-${first.number} the rails list serials`, tags: [], outcome: 'unexpected' },
          ],
        },
      ],
    } as SyncableReport);

    expect(summary.linkedCases).toBe(2);
    expect(getAutoResult(db, first.id)?.result).toBe('failed');
    expect(getAutoResult(db, second.id)?.result).toBe('failed');
  });
});

describe('outcomeForCase', () => {
  it.each([
    [['expected', 'unexpected'], 'failed'],
    [['expected', 'flaky'], 'passed'],
    [['flaky'], 'passed'],
    [['skipped', 'expected'], 'passed'],
    [['skipped'], 'skipped'],
  ] as const)('%j → %s', (outcomes, result) => {
    expect(outcomeForCase([...outcomes])).toBe(result);
  });
});

describe('syncReport', () => {
  let db: TmDb;
  let projectId: number;
  let suite: number;
  const mk = (title: string, automation: 'manual' | 'automated' | 'to_automate' = 'manual') =>
    createCase(db, projectId, { suiteId: suite, title, automation }, 'qa@example.com');

  beforeEach(() => {
    db = openDb(':memory:');
    projectId = createProject(db, { key: 'hanimax', name: 'HanimaX', code: 'HAN' }).id;
    suite = createSuite(db, { projectId, name: 'S' }).id;
  });

  afterEach(() => db.close());

  it('records the latest automated result per case and marks cases automated', () => {
    const login = mk('login');
    const pay = mk('pay', 'to_automate');
    const other = mk('untouched');

    const summary = syncReport(
      db,
      report([
        test_('login works', ['@smoke', `@HAN-${login.number}`], 'expected'),
        test_('pay works', [`@HAN-${pay.number}`], 'unexpected'),
        test_('pay retry', [`@HAN-${pay.number}`], 'expected'),
        test_('unknown case', ['@HAN-999'], 'expected'),
      ]),
    );

    expect(summary).toMatchObject({ linkedCases: 2, unknownTags: ['@HAN-999'] });
    expect(getAutoResult(db, login.id)).toMatchObject({
      result: 'passed',
      reportId: 'rep-1',
      reportUrl: '/api/serve/hanimax/rep-1/index.html',
      tests: ['login works'],
    });
    expect(getAutoResult(db, pay.id)).toMatchObject({ result: 'failed', tests: ['pay works', 'pay retry'] });
    expect(getAutoResult(db, other.id)).toBeNull();
    expect(getCase(db, login.id).automation).toBe('automated');
    expect(getCase(db, pay.id).automation).toBe('automated');
    expect(getCase(db, other.id).automation).toBe('manual');
  });

  it('replaces the previous result with the latest report', () => {
    const c = mk('c');

    syncReport(db, report([test_('t', [`@HAN-${c.number}`], 'unexpected')]));
    syncReport(db, report([test_('t', [`@HAN-${c.number}`], 'expected')], { reportID: 'rep-2' }));

    expect(getAutoResult(db, c.id)).toMatchObject({ result: 'passed', reportId: 'rep-2' });
  });

  it('ignores reports of projects that are not in test management, and deleted cases', () => {
    const c = mk('c');
    const gone = mk('gone');

    deleteCases(db, [gone.id]);
    expect(syncReport(db, report([test_('t', [`@HAN-${c.number}`], 'expected')], { project: 'nope' }))).toMatchObject({
      linkedCases: 0,
    });
    syncReport(db, report([test_('t', [`@HAN-${gone.number}`], 'expected')]));
    expect(getAutoResult(db, c.id)).toBeNull();
    expect(getAutoResult(db, gone.id)).toBeNull();
  });

  it('fills an existing run without overwriting what a person set', () => {
    const a = mk('a');
    const b = mk('b');
    const notInRun = mk('later');
    const run = createRun(db, {
      projectId,
      name: 'Regression',
      source: { type: 'cases', caseIds: [a.id, b.id] },
      by: 'qa',
    });
    const rcB = getRun(db, run.id).cases.find((rc) => rc.caseId === b.id)!;

    updateRunCase(db, rcB.id, { result: 'blocked' }, 'qa@example.com');
    updateCase(db, notInRun.id, { title: 'later' }, 'qa');

    const summary = syncReport(
      db,
      report(
        [
          test_('a fails', [`@HAN-${a.number}`], 'unexpected'),
          test_('b passes', [`@HAN-${b.number}`], 'expected'),
          test_('later', [`@HAN-${notInRun.number}`], 'expected'),
        ],
        { testboardRun: String(run.id) },
      ),
    );

    const cases = getRun(db, run.id).cases;
    const ra = cases.find((rc) => rc.caseId === a.id)!;
    const rb = cases.find((rc) => rc.caseId === b.id)!;

    expect(summary.run).toEqual({ id: run.id, updated: 1 });
    expect(ra).toMatchObject({ result: 'failed', resultBy: 'autotests' });
    expect(ra.comment).toContain('/api/serve/hanimax/rep-1/index.html');
    expect(ra.comment).toContain('a fails');
    expect(rb).toMatchObject({ result: 'blocked', resultBy: 'qa@example.com' });
    expect(cases).toHaveLength(2);
  });

  it('updates results it set itself on a later report', () => {
    const a = mk('a');
    const run = createRun(db, { projectId, name: 'R', source: { type: 'all' }, by: 'qa' });

    syncReport(db, report([test_('a', [`@HAN-${a.number}`], 'unexpected')], { testboardRun: String(run.id) }));
    syncReport(
      db,
      report([test_('a', [`@HAN-${a.number}`], 'expected')], { testboardRun: String(run.id), reportID: 'rep-2' }),
    );

    expect(getRun(db, run.id).cases[0]).toMatchObject({ result: 'passed', resultBy: 'autotests' });
  });

  it('creates a new run from the linked cases on "new"', () => {
    const a = mk('a');
    const b = mk('b');

    mk('not linked');
    const summary = syncReport(
      db,
      report([test_('a', [`@HAN-${a.number}`], 'expected'), test_('b', [`@HAN-${b.number}`], 'skipped')], {
        testboardRun: 'new',
        env: 'stage',
      }),
    );

    const { run, cases } = getRun(db, summary.run!.id);

    expect(run.name).toMatch(/^Autotests · stage · /);
    expect(run.createdBy).toBe('autotests');
    expect(cases.map((rc) => [rc.caseId, rc.result])).toEqual([
      [a.id, 'passed'],
      [b.id, 'skipped'],
    ]);
  });

  it('leaves completed runs, foreign runs and junk run values alone', () => {
    const a = mk('a');
    const run = createRun(db, { projectId, name: 'Done', source: { type: 'all' }, by: 'qa' });
    const otherProject = createProject(db, { key: 'other', name: 'O', code: 'OTH' }).id;
    const foreign = createRun(db, {
      projectId: otherProject,
      name: 'F',
      source: {
        type: 'cases',
        caseIds: [
          createCase(
            db,
            otherProject,
            { suiteId: createSuite(db, { projectId: otherProject, name: 'S' }).id, title: 'x' },
            'qa',
          ).id,
        ],
      },
      by: 'qa',
    });

    completeRun(db, run.id);
    for (const value of [String(run.id), String(foreign.id), 'abc', '0']) {
      const summary = syncReport(db, report([test_('a', [`@HAN-${a.number}`], 'expected')], { testboardRun: value }));

      expect(summary.run).toBeNull();
    }
    expect(getRun(db, run.id).cases[0].result).toBe('untested');
    expect(getRun(db, foreign.id).cases[0].result).toBe('untested');
  });
});
