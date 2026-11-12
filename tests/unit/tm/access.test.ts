import {
  apiTokenCan,
  ASSIGNABLE_ROLES,
  CAPABILITIES,
  can,
  isAdminRole,
  normalizeRole,
  requiredCapability,
  resolveRole,
  ROLES,
} from '@/app/lib/access';

describe('roles', () => {
  const C = CAPABILITIES;

  it('administrator can do everything', () => {
    for (const capability of Object.values(C)) expect(can(ROLES.administrator, capability)).toBe(true);
  });

  it('member does the daily work but cannot delete, manage projects or touch settings', () => {
    for (const capability of [C.view, C.runTests, C.manageCases, C.manageReports]) {
      expect(can(ROLES.member, capability)).toBe(true);
    }
    for (const capability of [C.deleteReports, C.manageProjects, C.manageSettings]) {
      expect(can(ROLES.member, capability)).toBe(false);
    }
  });

  it('nobody signed out can do anything', () => {
    expect(can(undefined, C.view)).toBe(false);
    expect(can(null, C.view)).toBe(false);
  });

  it('reads roles stored before the rename, and treats unknown labels as member', () => {
    expect(normalizeRole('admin')).toBe(ROLES.administrator);
    expect(normalizeRole('tester')).toBe(ROLES.member);
    expect(normalizeRole('viewer')).toBe(ROLES.member);
    expect(normalizeRole('qa engineer')).toBe(ROLES.member);
    expect(normalizeRole('owner')).toBe(ROLES.administrator);
    expect(normalizeRole(undefined)).toBeNull();

    expect(can('admin', C.manageSettings)).toBe(true);
    expect(can('viewer', C.manageCases)).toBe(true);
    expect(can('viewer', C.deleteReports)).toBe(false);
  });

  it('offers administrator and member in the role picker', () => {
    expect(ASSIGNABLE_ROLES).toEqual(['administrator', 'member']);
    expect(isAdminRole('administrator')).toBe(true);
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('member')).toBe(false);
  });

  it('makes AUTH_ADMIN_EMAILS administrators and the allowed domain members', () => {
    const policy = { adminEmails: ['boss@x.co'], allowedDomains: ['x.co'] };

    expect(resolveRole('Boss@x.co', policy)).toBe(ROLES.administrator);
    expect(resolveRole('qa@x.co', policy)).toBe(ROLES.member);
    expect(resolveRole('qa@other.co', policy)).toBeNull();
  });
});

describe('requiredCapability for /api/tm', () => {
  it.each([
    ['PATCH', '/api/tm/cases/5'],
    ['DELETE', '/api/tm/suites/3'],
    ['PATCH', '/api/tm/runs/2/cases/9'],
    ['POST', '/base/api/tm/projects/hw/cases/bulk'],
    ['PATCH', '/api/tm/projects/hw'],
    ['PUT', '/api/tm/projects/hw/logo'],
  ])('%s %s needs manage:cases', (method, path) => {
    expect(requiredCapability(path, method)).toBe(CAPABILITIES.manageCases);
  });

  it.each([
    ['POST', '/api/tm/projects'],
    ['POST', '/base/api/tm/projects'],
    ['DELETE', '/api/tm/projects/hw'],
  ])('%s %s (create or delete a project) needs manage:projects', (method, path) => {
    expect(requiredCapability(path, method)).toBe(CAPABILITIES.manageProjects);
  });

  it('reads need only view', () => {
    expect(requiredCapability('/api/tm/projects', 'GET')).toBe(CAPABILITIES.view);
    expect(requiredCapability('/api/tm/runs/2', 'GET')).toBe(CAPABILITIES.view);
  });
});

describe('requiredCapability for reports and results', () => {
  it.each([
    ['DELETE', '/api/report/delete'],
    ['DELETE', '/api/result/delete'],
    ['POST', '/api/report/delete'],
  ])('%s %s needs delete:reports', (method, path) => {
    expect(requiredCapability(path, method)).toBe(CAPABILITIES.deleteReports);
  });

  it.each([
    ['POST', '/api/report/generate'],
    ['POST', '/api/report/abc/ai-summary'],
    ['PUT', '/api/result/upload'],
  ])('%s %s needs manage:reports', (method, path) => {
    expect(requiredCapability(path, method)).toBe(CAPABILITIES.manageReports);
  });
});

describe('requiredCapability for /api/autotests', () => {
  it.each(['trigger', 'cancel', 'rerun'])('POST %s needs run:tests', (action) => {
    expect(requiredCapability(`/api/autotests/${action}`, 'POST')).toBe(CAPABILITIES.runTests);
  });

  it('listing builds needs only view', () => {
    expect(requiredCapability('/api/autotests/builds', 'GET')).toBe(CAPABILITIES.view);
  });
});

describe('the API token (CI and scripts)', () => {
  const tokenCan = (path: string, method: string) => apiTokenCan(requiredCapability(path, method));

  it.each([
    ['PUT', '/api/result/upload'],
    ['POST', '/api/report/generate'],
    ['GET', '/api/report/list'],
    ['GET', '/api/tm/projects'],
    ['POST', '/api/tm/projects/hw/cases'],
    ['PATCH', '/api/tm/cases/7'],
    ['PATCH', '/api/tm/runs/2/cases/5'],
    ['POST', '/api/autotests/trigger'],
    ['POST', '/api/autotests/cancel'],
    ['POST', '/api/autotests/rerun'],
  ])('may %s %s', (method, path) => {
    expect(tokenCan(path, method)).toBe(true);
  });

  it.each([
    ['PATCH', '/api/config'],
    ['GET', '/api/access'],
    ['POST', '/api/access'],
  ])('may not %s %s', (method, path) => {
    expect(tokenCan(path, method)).toBe(false);
  });
});
