import { createCase, type StepInput } from './cases';
import { type CaseStatus, type Priority, PRIORITIES } from './constants';
import { type TmDb } from './db';
import { createSuite } from './suites';

// Import of test cases from a CSV in the layout QA Sphere exports (Test Cases → ⋮ → Export): Folder, Name,
// Priority, Tags, Draft, Preconditions, then Step 1 / Expected 1, Step 2 / Expected 2, … Any spreadsheet saved
// with those columns works too.

export interface ImportedCase {
  // Folder path from the root, e.g. ['Player', 'Controls'].
  folder: string[];
  title: string;
  priority: Priority;
  status: CaseStatus;
  tags: string[];
  preconditions: string;
  steps: StepInput[];
}

export interface ImportSummary {
  suitesCreated: number;
  casesCreated: number;
  casesSkipped: number;
}

// Rows without a folder still need a suite to live in.
const FALLBACK_FOLDER = 'Imported';

// RFC 4180: quoted cells may hold the separator, line breaks and doubled quotes. The separator is whichever of
// "," and ";" the header line uses more (Excel in some locales saves with ";").
export const parseCsv = (text: string): string[][] => {
  const source = text.replace(/^﻿/, '');
  const header = source.split(/\r?\n/, 1)[0] ?? '';
  const separator = header.split(';').length > header.split(',').length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === separator) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) rows.push([...row, cell]);

  return rows.filter((cells) => cells.some((value) => value.trim()));
};

export const parseCasesCsv = (text: string): { cases: ImportedCase[]; problems: string[] } => {
  const [header = [], ...rows] = parseCsv(text);
  const column = new Map(header.map((name, index) => [name.trim().toLowerCase(), index]));
  const missing = ['Folder', 'Name'].filter((name) => !column.has(name.toLowerCase()));

  if (missing.length) return { cases: [], problems: missing.map((name) => `missing column: ${name}`) };

  const stepCount = header.filter((name) => /^step \d+$/i.test(name.trim())).length;
  const problems: string[] = [];
  const cases: ImportedCase[] = [];

  rows.forEach((cells, index) => {
    const get = (name: string) => (cells[column.get(name.toLowerCase()) ?? -1] ?? '').trim();
    const title = get('Name');

    if (!title) {
      problems.push(`row ${index + 2}: no name, skipped`);

      return;
    }

    const rawPriority = get('Priority').toLowerCase();
    const known = (PRIORITIES as readonly string[]).includes(rawPriority);

    if (rawPriority && !known) problems.push(`row ${index + 2}: unknown priority "${rawPriority}", set to medium`);

    const steps: StepInput[] = [];

    for (let n = 1; n <= stepCount; n++) {
      const action = get(`Step ${n}`);
      const expected = get(`Expected ${n}`);

      if (action || expected) steps.push({ action, expected });
    }

    const folder = get('Folder')
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean);

    cases.push({
      folder: folder.length ? folder : [FALLBACK_FOLDER],
      title,
      priority: known ? (rawPriority as Priority) : 'medium',
      status: get('Draft').toLowerCase() === 'true' ? 'draft' : 'actual',
      tags: get('Tags')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      preconditions: get('Preconditions'),
      steps,
    });
  });

  return { cases, problems };
};

class DryRun extends Error {}

// Adds the cases to a project: folders become suites (an existing suite with the same name under the same
// parent is reused), cases get the project's next numbers. A case whose title is already in that suite is
// skipped, so importing the same file twice adds nothing. With dryRun everything is counted, then rolled back.
export const importCases = (
  db: TmDb,
  projectId: number,
  cases: ImportedCase[],
  by: string,
  options: { dryRun?: boolean } = {},
): ImportSummary => {
  const summary: ImportSummary = { suitesCreated: 0, casesCreated: 0, casesSkipped: 0 };
  const findSuite = db.prepare(
    'SELECT id FROM tm_suites WHERE project_id = ? AND parent_id IS ? AND name = ? AND deleted_at IS NULL',
  );
  const hasCase = db.prepare('SELECT 1 FROM tm_cases WHERE suite_id = ? AND title = ? AND deleted_at IS NULL');

  const suiteFor = (folder: string[]): number => {
    let parentId: number | null = null;

    for (const name of folder) {
      const existing = findSuite.get(projectId, parentId, name) as { id: number } | undefined;

      if (existing) parentId = existing.id;
      else {
        parentId = createSuite(db, { projectId, parentId, name }).id;
        summary.suitesCreated++;
      }
    }

    return parentId as number;
  };

  try {
    db.transaction(() => {
      for (const item of cases) {
        const suiteId = suiteFor(item.folder);

        if (hasCase.get(suiteId, item.title)) {
          summary.casesSkipped++;
          continue;
        }
        createCase(
          db,
          projectId,
          {
            suiteId,
            title: item.title,
            priority: item.priority,
            status: item.status,
            tags: item.tags,
            preconditions: item.preconditions,
            steps: item.steps,
          },
          by,
        );
        summary.casesCreated++;
      }
      if (options.dryRun) throw new DryRun();
    })();
  } catch (error) {
    if (!(error instanceof DryRun)) throw error;
  }

  return summary;
};
