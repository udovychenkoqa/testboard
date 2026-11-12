import { openDb, type TmDb } from '@/app/lib/tm/db';
import { getCase, listCases } from '@/app/lib/tm/cases';
import { importCases, parseCasesCsv, parseCsv } from '@/app/lib/tm/caseImport';
import { createProject } from '@/app/lib/tm/projects';
import { createSuite, listSuites } from '@/app/lib/tm/suites';

// The layout QA Sphere exports (Test Cases → ⋮ → Export).
const EXPORT = [
  'Folder,Type,Name,Legacy ID,Draft,Priority,Tags,Requirements,Links,Files,Preconditions,Step 1,Expected 1,Step 2,Expected 2',
  'Player/Controls,standalone,Video plays,,false,high,"smoke, player",,,,User is signed in,Open a serial,Player is visible,Tap play,"Video starts, sound on"',
  'Player/Controls,standalone,"Pause, then resume",,true,low,,,,,,Tap pause,Video stops,,',
  'Admin,standalone,Create a serial,,false,,,,,,"Admin\nis signed in",Open the form,,,',
].join('\n');

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, commas and line breaks inside a cell', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi""\nthere"\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"\nthere'],
    ]);
  });

  it('accepts CRLF, a BOM and a semicolon separator', () => {
    expect(parseCsv('﻿a;b\r\n1;2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('parseCasesCsv', () => {
  it('reads cases with their folder path, fields and steps', () => {
    const { cases, problems } = parseCasesCsv(EXPORT);

    expect(problems).toEqual([]);
    expect(cases).toEqual([
      {
        folder: ['Player', 'Controls'],
        title: 'Video plays',
        priority: 'high',
        status: 'actual',
        tags: ['smoke', 'player'],
        preconditions: 'User is signed in',
        steps: [
          { action: 'Open a serial', expected: 'Player is visible' },
          { action: 'Tap play', expected: 'Video starts, sound on' },
        ],
      },
      {
        folder: ['Player', 'Controls'],
        title: 'Pause, then resume',
        priority: 'low',
        status: 'draft',
        tags: [],
        preconditions: '',
        steps: [{ action: 'Tap pause', expected: 'Video stops' }],
      },
      {
        folder: ['Admin'],
        title: 'Create a serial',
        priority: 'medium',
        status: 'actual',
        tags: [],
        preconditions: 'Admin\nis signed in',
        steps: [{ action: 'Open the form', expected: '' }],
      },
    ]);
  });

  it('needs the Folder and Name columns', () => {
    expect(parseCasesCsv('Title,Steps\nx,y').problems).toEqual(['missing column: Folder', 'missing column: Name']);
  });

  it('reports rows it cannot use and keeps the rest', () => {
    const { cases, problems } = parseCasesCsv('Folder,Name,Priority\nA,,high\nA,Ok,urgent\n,No folder,low');

    expect(cases.map((c) => [c.folder, c.title, c.priority])).toEqual([
      [['A'], 'Ok', 'medium'],
      [['Imported'], 'No folder', 'low'],
    ]);
    expect(problems).toEqual(['row 2: no name, skipped', 'row 3: unknown priority "urgent", set to medium']);
  });
});

describe('importCases', () => {
  let db: TmDb;
  let projectId: number;

  beforeEach(() => {
    db = openDb(':memory:');
    projectId = createProject(db, { key: 'hw', name: 'HanimaX', code: 'HAN' }).id;
  });

  it('creates the folder tree as suites and the cases in them, with new numbers', () => {
    createSuite(db, { projectId, name: 'Player' });

    const summary = importCases(db, projectId, parseCasesCsv(EXPORT).cases, 'qa@x.co');

    expect(summary).toEqual({ suitesCreated: 2, casesCreated: 3, casesSkipped: 0 });

    const suites = listSuites(db, projectId);
    const player = suites.find((s) => s.name === 'Player')!;
    const controls = suites.find((s) => s.name === 'Controls')!;

    // The existing Player suite is reused, not duplicated.
    expect(suites.filter((s) => s.name === 'Player')).toHaveLength(1);
    expect(controls.parentId).toBe(player.id);

    const cases = listCases(db, projectId, {});
    const video = getCase(db, cases.find((c) => c.title === 'Video plays')!.id);

    expect(video).toMatchObject({
      suiteId: controls.id,
      priority: 'high',
      status: 'actual',
      tags: ['player', 'smoke'],
      preconditions: 'User is signed in',
      createdBy: 'qa@x.co',
    });
    expect(video.steps.map(({ action, expected }) => ({ action, expected }))).toEqual([
      { action: 'Open a serial', expected: 'Player is visible' },
      { action: 'Tap play', expected: 'Video starts, sound on' },
    ]);
    expect(cases.map((c) => c.number).sort()).toEqual([1, 2, 3]);
  });

  it('skips a case that is already in the same suite, so a second import adds nothing', () => {
    const parsed = parseCasesCsv(EXPORT).cases;

    importCases(db, projectId, parsed, 'qa@x.co');

    expect(importCases(db, projectId, parsed, 'qa@x.co')).toEqual({ suitesCreated: 0, casesCreated: 0, casesSkipped: 3 });
    expect(listCases(db, projectId, {})).toHaveLength(3);
  });

  it('can count what an import would do without writing anything', () => {
    const summary = importCases(db, projectId, parseCasesCsv(EXPORT).cases, 'qa@x.co', { dryRun: true });

    expect(summary).toEqual({ suitesCreated: 3, casesCreated: 3, casesSkipped: 0 });
    expect(listCases(db, projectId, {})).toHaveLength(0);
    expect(listSuites(db, projectId)).toHaveLength(0);
  });
});
