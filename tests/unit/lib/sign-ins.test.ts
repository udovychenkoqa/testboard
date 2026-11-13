import { openDb, type TmDb } from '@/app/lib/tm/db';
import { listSignIns, recordSignIn } from '@/app/lib/signIns';

let db: TmDb;

beforeEach(() => {
  db = openDb(':memory:');
});

describe('sign-ins', () => {
  it('is empty until somebody signs in', () => {
    expect(listSignIns(db)).toEqual([]);
  });

  it('remembers who signed in, by lower-cased email, with the name the provider gave', () => {
    recordSignIn(db, ' Anna@X.co ', 'Anna Kovalenko');

    const [seen] = listSignIns(db);

    expect(seen).toMatchObject({ email: 'anna@x.co', name: 'Anna Kovalenko' });
    expect(Date.parse(seen.lastSeenAt)).not.toBeNaN();
  });

  it('keeps one row per person and refreshes it on the next sign-in', () => {
    recordSignIn(db, 'anna@x.co', 'Anna');
    db.prepare("UPDATE user_sign_ins SET last_seen_at = '2020-01-01T00:00:00.000Z'").run();
    recordSignIn(db, 'ANNA@x.co', 'Anna Kovalenko');

    const seen = listSignIns(db);

    expect(seen).toHaveLength(1);
    expect(seen[0].name).toBe('Anna Kovalenko');
    expect(seen[0].lastSeenAt > '2020-01-01').toBe(true);
  });

  it('keeps the known name when a later sign-in comes without one', () => {
    recordSignIn(db, 'anna@x.co', 'Anna');
    recordSignIn(db, 'anna@x.co', null);

    expect(listSignIns(db)[0].name).toBe('Anna');
  });

  it('lists people by email', () => {
    recordSignIn(db, 'bob@x.co', 'Bob');
    recordSignIn(db, 'anna@x.co', 'Anna');

    expect(listSignIns(db).map((s) => s.email)).toEqual(['anna@x.co', 'bob@x.co']);
  });
});
