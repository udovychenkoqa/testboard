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
