import { type TmDb } from '@/app/lib/tm/db';
import { now } from '@/app/lib/tm/errors';

// Who has signed in with a personal account, and when last. Roles for people from the allowed domain are
// resolved on the fly and stored nowhere, so without this an administrator cannot see who uses Testboard.

export interface SignIn {
  email: string;
  // The name the sign-in provider gave; empty when it gave none.
  name: string;
  lastSeenAt: string;
}

export const recordSignIn = (db: TmDb, email: string, name: string | null | undefined): void => {
  // A sign-in without a name must not wipe the one we already know.
  db.prepare(
    `INSERT INTO user_sign_ins (email, name, last_seen_at) VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       name = CASE WHEN excluded.name = '' THEN name ELSE excluded.name END,
       last_seen_at = excluded.last_seen_at`,
  ).run(email.trim().toLowerCase(), (name ?? '').trim(), now());
};

export const listSignIns = (db: TmDb): SignIn[] =>
  (
    db.prepare('SELECT email, name, last_seen_at FROM user_sign_ins ORDER BY email').all() as {
      email: string;
      name: string;
      last_seen_at: string;
    }[]
  ).map((row) => ({ email: row.email, name: row.name, lastSeenAt: row.last_seen_at }));
