import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';

import { openDb } from '@/app/lib/tm/db';

const TABLES = ['tm_case_steps', 'tm_case_tags', 'tm_cases', 'tm_projects', 'tm_run_cases', 'tm_runs', 'tm_suites'];

describe('tm database', () => {
  it('creates every tm_* table and enables foreign keys', () => {
    const db = openDb(':memory:');
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'tm_%' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual(TABLES);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('reopening an existing file does not re-run migrations', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'tm-db-'));
    const file = path.join(dir, 'testboard.db');

    try {
      openDb(file).close();
      const db = openDb(file);

      expect(db.pragma('user_version', { simple: true })).toBeGreaterThan(0);
      expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
