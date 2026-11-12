import { openDb, type TmDb } from '@/app/lib/tm/db';
import { TmError } from '@/app/lib/tm/errors';
import {
  deleteAvatar,
  displayName,
  getAvatar,
  getProfile,
  listProfiles,
  saveProfile,
  setAvatar,
} from '@/app/lib/profiles';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

let db: TmDb;

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof TmError ? error.code : String(error);
  }

  return 'no error';
};

beforeEach(() => {
  db = openDb(':memory:');
});

describe('profiles', () => {
  it('is empty until saved, and keyed by a case-insensitive email', () => {
    expect(getProfile(db, 'Anton@X.co')).toEqual({
      email: 'anton@x.co',
      firstName: '',
      lastName: '',
      position: '',
      avatarUpdatedAt: null,
    });

    saveProfile(db, 'Anton@X.co', { firstName: ' Антон ', lastName: 'Удовиченко', position: 'Automation Engineer' });

    expect(getProfile(db, 'anton@x.co')).toMatchObject({
      firstName: 'Антон',
      lastName: 'Удовиченко',
      position: 'Automation Engineer',
    });
  });

  it('updates the text fields without touching the avatar', () => {
    saveProfile(db, 'a@x.co', { firstName: 'A', lastName: 'B', position: '' });
    setAvatar(db, 'a@x.co', PNG);
    saveProfile(db, 'a@x.co', { firstName: 'A2', lastName: 'B', position: 'QA' });

    expect(getProfile(db, 'a@x.co')).toMatchObject({ firstName: 'A2', position: 'QA' });
    expect(getProfile(db, 'a@x.co').avatarUpdatedAt).not.toBeNull();
    expect(getAvatar(db, 'a@x.co')).toMatchObject({ type: 'image/png', data: PNG });
  });

  it('stores and removes an avatar, even before any name is saved', () => {
    setAvatar(db, 'new@x.co', PNG);
    expect(getAvatar(db, 'NEW@x.co')?.type).toBe('image/png');

    deleteAvatar(db, 'new@x.co');
    expect(getAvatar(db, 'new@x.co')).toBeNull();
    expect(getProfile(db, 'new@x.co').avatarUpdatedAt).toBeNull();
  });

  it('rejects an avatar that is not a PNG, JPEG or WebP, or is too large', () => {
    expect(code(() => setAvatar(db, 'a@x.co', SVG))).toBe('invalid');
    expect(code(() => setAvatar(db, 'a@x.co', Buffer.concat([PNG, Buffer.alloc(200 * 1024)])))).toBe('invalid');
    expect(getAvatar(db, 'a@x.co')).toBeNull();
  });

  it('rejects over-long fields', () => {
    expect(code(() => saveProfile(db, 'a@x.co', { firstName: 'x'.repeat(81), lastName: '', position: '' }))).toBe(
      'invalid',
    );
  });

  it('lists everyone with a profile, for showing names instead of emails', () => {
    saveProfile(db, 'b@x.co', { firstName: 'Bo', lastName: 'Li', position: 'QA' });
    setAvatar(db, 'a@x.co', PNG);

    expect(listProfiles(db).map((p) => p.email)).toEqual(['a@x.co', 'b@x.co']);
  });
});

describe('displayName', () => {
  it('joins the name parts and falls back to the given text', () => {
    expect(displayName({ firstName: 'Антон', lastName: 'Удовиченко' }, 'a@x.co')).toBe('Антон Удовиченко');
    expect(displayName({ firstName: 'Антон', lastName: '' }, 'a@x.co')).toBe('Антон');
    expect(displayName({ firstName: '', lastName: '' }, 'a@x.co')).toBe('a@x.co');
    expect(displayName(undefined, 'autotests')).toBe('autotests');
  });
});
