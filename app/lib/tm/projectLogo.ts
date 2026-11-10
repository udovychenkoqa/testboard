import { type TmDb } from './db';
import { now, TmError } from './errors';
import { getProject } from './projects';

export const MAX_LOGO_BYTES = 200 * 1024;

export type LogoType = 'image/png' | 'image/jpeg' | 'image/webp';

// The type comes from the file's own bytes: a name or a Content-Type header can lie, and an SVG (script-capable)
// must never be served back from our origin.
export const detectImageType = (data: Buffer): LogoType | null => {
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }

  return null;
};

export const getProjectLogo = (db: TmDb, key: string): { type: LogoType; data: Buffer } | null => {
  const { id } = getProject(db, key);
  const row = db.prepare('SELECT type, data FROM tm_project_logos WHERE project_id = ?').get(id) as
    | { type: LogoType; data: Buffer }
    | undefined;

  return row ?? null;
};

export const setProjectLogo = (db: TmDb, key: string, data: Buffer): void => {
  const { id } = getProject(db, key);

  if (data.length > MAX_LOGO_BYTES) throw new TmError('invalid', 'logo must be 200 KB or smaller');
  const type = detectImageType(data);

  if (!type) throw new TmError('invalid', 'logo must be a PNG, JPEG or WebP image');

  db.transaction(() => {
    db.prepare(
      `INSERT INTO tm_project_logos (project_id, type, data) VALUES (?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET type = excluded.type, data = excluded.data`,
    ).run(id, type, data);
    db.prepare('UPDATE tm_projects SET logo_updated_at = ? WHERE id = ?').run(now(), id);
  })();
};

export const deleteProjectLogo = (db: TmDb, key: string): void => {
  const { id } = getProject(db, key);

  db.transaction(() => {
    db.prepare('DELETE FROM tm_project_logos WHERE project_id = ?').run(id);
    db.prepare('UPDATE tm_projects SET logo_updated_at = NULL WHERE id = ?').run(id);
  })();
};
