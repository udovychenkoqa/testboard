import { type TmDb } from '@/app/lib/tm/db';
import { now, TmError } from '@/app/lib/tm/errors';
import { detectImageType, type LogoType, MAX_LOGO_BYTES } from '@/app/lib/tm/projectLogo';

export { displayName } from '@/app/lib/profileName';

// A person's own profile, keyed by the email they sign in with. Lives in the test-management database
// (testboard.db). Sessions without an email (API token, open mode) have no profile.

export interface Profile {
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  // Set while an uploaded photo exists; part of the photo URL so a new upload isn't cached.
  avatarUpdatedAt: string | null;
}

export interface ProfileInput {
  firstName: string;
  lastName: string;
  position: string;
}

interface ProfileRow {
  email: string;
  first_name: string;
  last_name: string;
  position: string;
  avatar_updated_at: string | null;
}

const MAX_FIELD = 80;

const key = (email: string): string => email.trim().toLowerCase();

const toProfile = (row: ProfileRow): Profile => ({
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  position: row.position,
  avatarUpdatedAt: row.avatar_updated_at,
});

export const getProfile = (db: TmDb, email: string): Profile => {
  const row = db.prepare('SELECT * FROM user_profiles WHERE email = ?').get(key(email)) as ProfileRow | undefined;

  return row ? toProfile(row) : { email: key(email), firstName: '', lastName: '', position: '', avatarUpdatedAt: null };
};

export const listProfiles = (db: TmDb): Profile[] =>
  (db.prepare('SELECT * FROM user_profiles ORDER BY email').all() as ProfileRow[]).map(toProfile);

const ensureRow = (db: TmDb, email: string) =>
  db.prepare('INSERT INTO user_profiles (email) VALUES (?) ON CONFLICT(email) DO NOTHING').run(key(email));

export const saveProfile = (db: TmDb, email: string, input: ProfileInput): Profile => {
  const fields = [input.firstName, input.lastName, input.position].map((value) => value.trim());

  if (fields.some((value) => value.length > MAX_FIELD)) {
    throw new TmError('invalid', `each field must be ${MAX_FIELD} characters or shorter`);
  }

  db.transaction(() => {
    ensureRow(db, email);
    db.prepare('UPDATE user_profiles SET first_name = ?, last_name = ?, position = ? WHERE email = ?').run(
      ...fields,
      key(email),
    );
  })();

  return getProfile(db, email);
};

export const getAvatar = (db: TmDb, email: string): { type: LogoType; data: Buffer } | null =>
  (db.prepare('SELECT type, data FROM user_avatars WHERE email = ?').get(key(email)) as
    | { type: LogoType; data: Buffer }
    | undefined) ?? null;

// Same rules as a project logo: the type is read from the bytes, and SVG is never accepted.
export const setAvatar = (db: TmDb, email: string, data: Buffer): void => {
  if (data.length > MAX_LOGO_BYTES) throw new TmError('invalid', 'photo must be 200 KB or smaller');
  const type = detectImageType(data);

  if (!type) throw new TmError('invalid', 'photo must be a PNG, JPEG or WebP image');

  db.transaction(() => {
    ensureRow(db, email);
    db.prepare(
      `INSERT INTO user_avatars (email, type, data) VALUES (?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET type = excluded.type, data = excluded.data`,
    ).run(key(email), type, data);
    db.prepare('UPDATE user_profiles SET avatar_updated_at = ? WHERE email = ?').run(now(), key(email));
  })();
};

export const deleteAvatar = (db: TmDb, email: string): void => {
  db.transaction(() => {
    db.prepare('DELETE FROM user_avatars WHERE email = ?').run(key(email));
    db.prepare('UPDATE user_profiles SET avatar_updated_at = NULL WHERE email = ?').run(key(email));
  })();
};
