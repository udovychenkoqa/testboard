import { openDb, type TmDb } from '@/app/lib/tm/db';
import { TmError } from '@/app/lib/tm/errors';
import { createProject, deleteProject, getProject, listProjects } from '@/app/lib/tm/projects';
import {
  deleteProjectLogo,
  detectImageType,
  getProjectLogo,
  MAX_LOGO_BYTES,
  setProjectLogo,
} from '@/app/lib/tm/projectLogo';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
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
  createProject(db, { key: 'hw', name: 'HanimaX', code: 'HAN' });
});

describe('detectImageType', () => {
  it('reads the type from the bytes, not the name', () => {
    expect(detectImageType(PNG)).toBe('image/png');
    expect(detectImageType(JPEG)).toBe('image/jpeg');
    expect(detectImageType(WEBP)).toBe('image/webp');
  });

  it('refuses SVG, text and empty data', () => {
    expect(detectImageType(SVG)).toBeNull();
    expect(detectImageType(Buffer.from('hello'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe('project logo', () => {
  it('has none until one is set', () => {
    expect(getProjectLogo(db, 'hw')).toBeNull();
    expect(getProject(db, 'hw').logoUpdatedAt).toBeNull();
  });

  it('stores, replaces and removes a logo, and stamps the project', () => {
    setProjectLogo(db, 'hw', PNG);
    expect(getProjectLogo(db, 'hw')).toMatchObject({ type: 'image/png', data: PNG });
    expect(getProject(db, 'hw').logoUpdatedAt).not.toBeNull();
    expect(listProjects(db)[0].logoUpdatedAt).not.toBeNull();

    setProjectLogo(db, 'hw', JPEG);
    expect(getProjectLogo(db, 'hw')?.type).toBe('image/jpeg');

    deleteProjectLogo(db, 'hw');
    expect(getProjectLogo(db, 'hw')).toBeNull();
    expect(getProject(db, 'hw').logoUpdatedAt).toBeNull();
  });

  it('rejects unknown types and oversized files', () => {
    expect(code(() => setProjectLogo(db, 'hw', SVG))).toBe('invalid');
    expect(code(() => setProjectLogo(db, 'hw', Buffer.concat([PNG, Buffer.alloc(MAX_LOGO_BYTES)])))).toBe('invalid');
    expect(getProjectLogo(db, 'hw')).toBeNull();
  });

  it('needs an existing project and goes away with it', () => {
    expect(code(() => setProjectLogo(db, 'nope', PNG))).toBe('not_found');

    setProjectLogo(db, 'hw', PNG);
    deleteProject(db, 'hw');
    expect(db.prepare('SELECT COUNT(*) AS n FROM tm_project_logos').get()).toEqual({ n: 0 });
  });
});
