import path from 'node:path';

import { resolveInside } from '@/app/lib/safePath';
import { CAPABILITIES, requiredCapability } from '@/app/lib/access';

describe('resolveInside', () => {
  const root = path.resolve('/srv/data/results');

  it('keeps ordinary nested paths', () => {
    expect(resolveInside(root, 'proj', 'a.zip')).toBe(path.join(root, 'proj', 'a.zip'));
  });

  it.each(['../config', '../../etc/passwd', 'a/../../b', '/etc/passwd'])('rejects %s', (segment) => {
    expect(() => resolveInside(root, segment)).toThrow('escapes');
  });

  it('rejects a sibling folder that shares the prefix', () => {
    expect(() => resolveInside(root, '../results-evil/x')).toThrow('escapes');
  });
});

describe('requiredCapability for settings and deletes', () => {
  it('requires manage:settings for PATCH /api/config', () => {
    expect(requiredCapability('/api/config', 'PATCH')).toBe(CAPABILITIES.manageSettings);
  });

  it('keeps DELETE routes behind manage:reports', () => {
    expect(requiredCapability('/api/result/delete', 'DELETE')).toBe(CAPABILITIES.manageReports);
    expect(requiredCapability('/api/report/delete', 'DELETE')).toBe(CAPABILITIES.manageReports);
  });
});

describe('safeCallbackPath', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { safeCallbackPath } = require('@/app/lib/safeRedirect');

  it.each(['/reports', '/runs/automated?tab=1'])('keeps %s', (value) => {
    expect(safeCallbackPath(value)).toBe(value);
  });

  it.each(['javascript:alert(1)', '//evil.example', '/\\evil.example', 'https://evil.example', '%'])(
    'falls back for %s',
    (value) => {
      expect(safeCallbackPath(value)).toBe('/');
    },
  );
});

describe('isAuthorized', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { isAuthorized } = require('@/app/lib/auth');

  it('matches only the exact token', () => {
    expect(isAuthorized({ actualAuthToken: 'abc', expectedAuthToken: 'abc' })).toBe(true);
    expect(isAuthorized({ actualAuthToken: 'abd', expectedAuthToken: 'abc' })).toBe(false);
    expect(isAuthorized({ actualAuthToken: 'ab', expectedAuthToken: 'abc' })).toBe(false);
    expect(isAuthorized({ actualAuthToken: null, expectedAuthToken: 'abc' })).toBe(false);
  });
});

describe('stripReservedMetadata', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { stripReservedMetadata } = require('@/app/lib/reservedMetadata');

  it('drops server-owned identity fields and keeps free-form ones', () => {
    expect(
      stripReservedMetadata({ resultID: 'x', reportID: 'y', reportUrl: '//evil.example', job: 'nightly', env: 'qa' }),
    ).toEqual({ job: 'nightly', env: 'qa' });
  });
});

describe('isSafeProjectName', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { isSafeProjectName } = require('@/app/lib/safePath');

  it.each([undefined, '', 'hanimax', 'team/web', 'My Project'])('accepts %p', (value) => {
    expect(isSafeProjectName(value)).toBe(true);
  });

  it.each(['..', '../x', 'a/../b', '/abs', 'a\\..\\b', 42])('rejects %p', (value) => {
    expect(isSafeProjectName(value)).toBe(false);
  });
});
