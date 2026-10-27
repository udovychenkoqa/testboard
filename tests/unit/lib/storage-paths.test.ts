import path from 'node:path';

type Constants = typeof import('@/app/lib/storage/constants');

// Constants are computed at import time, so each case loads a fresh copy.
const load = (dataDir?: string): Constants => {
  const previous = process.env.DATA_DIR;

  if (dataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = dataDir;

  let constants!: Constants;

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    constants = require('@/app/lib/storage/constants');
  });

  if (previous === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previous;

  return constants;
};

describe('storage paths', () => {
  it('default to ./data when DATA_DIR is unset', () => {
    const c = load();

    expect(c.DATA_FOLDER).toBe(path.join(process.cwd(), 'data'));
    expect(c.REPORTS_FOLDER).toBe(path.join(process.cwd(), 'data', 'reports'));
  });

  it('accept an absolute DATA_DIR as-is', () => {
    const c = load('/var/lib/testboard');

    expect(c.DATA_FOLDER).toBe('/var/lib/testboard');
    expect(c.REPORTS_FOLDER).toBe('/var/lib/testboard/reports');
  });

  it('follow DATA_DIR when set (isolated e2e data)', () => {
    const c = load('tests/e2e/.data');

    expect(c.DATA_FOLDER).toBe(path.join(process.cwd(), 'tests/e2e/.data'));
    expect(c.RESULTS_FOLDER).toBe(path.join(process.cwd(), 'tests/e2e/.data', 'results'));
    expect(c.REPORTS_FOLDER).toBe(path.join(process.cwd(), 'tests/e2e/.data', 'reports'));
    expect(c.APP_CONFIG).toBe(path.join(process.cwd(), 'tests/e2e/.data', 'config.json'));
  });
});
