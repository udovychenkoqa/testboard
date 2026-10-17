import path from 'node:path';
import { mkdirSync } from 'node:fs';

import Database from 'better-sqlite3';

import { MIGRATIONS } from './migrations';

import { DATA_FOLDER } from '@/app/lib/storage/constants';

export type TmDb = Database.Database;

const migrate = (db: TmDb) => {
  const applied = db.pragma('user_version', { simple: true }) as number;

  for (let i = applied; i < MIGRATIONS.length; i++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[i]);
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
};

// Opens (creating if needed) a test-management database and brings its schema
// up to date. ':memory:' gives an isolated DB for unit tests.
export const openDb = (file: string): TmDb => {
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);

  return db;
};

// One connection per server process, next to the reports in the data folder
// (DATA_DIR gives the e2e suite its own database).
const globalForDb = globalThis as unknown as { tmDb?: TmDb };

export const getDb = (): TmDb => {
  globalForDb.tmDb ??= openDb(path.join(DATA_FOLDER, 'testboard.db'));

  return globalForDb.tmDb;
};
