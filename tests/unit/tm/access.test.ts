import { apiTokenCan, ASSIGNABLE_ROLES, CAPABILITIES, can, requiredCapability, ROLES } from '@/app/lib/access';

describe('manage:cases', () => {
  it('is granted to admin and tester only', () => {
    expect(can(ROLES.admin, CAPABILITIES.manageCases)).toBe(true);
    expect(can(ROLES.tester, CAPABILITIES.manageCases)).toBe(true);
    expect(can(ROLES.viewer, CAPABILITIES.manageCases)).toBe(false);
    expect(can('qa engineer', CAPABILITIES.manageCases)).toBe(false);
    expect(can(undefined, CAPABILITIES.manageCases)).toBe(false);
  });

  it('keeps the existing rules for everything else', () => {
    expect(can(ROLES.viewer, CAPABILITIES.manageReports)).toBe(true);
    expect(can(ROLES.viewer, CAPABILITIES.manageSettings)).toBe(false);
    expect(can(ROLES.tester, CAPABILITIES.manageSettings)).toBe(false);
  });

  it('offers tester in the role picker', () => {
    expect(ASSIGNABLE_ROLES).toEqual(['admin', 'tester', 'viewer']);
  });
});

describe('requiredCapability for /api/tm', () => {
  it.each([
    ['POST', '/api/tm/projects'],
    ['PATCH', '/api/tm/cases/5'],
    ['DELETE', '/api/tm/suites/3'],
    ['PATCH', '/api/tm/runs/2/cases/9'],
    ['POST', '/base/api/tm/projects/hw/cases/bulk'],
  ])('%s %s needs manage:cases', (method, path) => {
    expect(requiredCapability(path, method)).toBe(CAPABILITIES.manageCases);
  });

  it('reads need only view', () => {
    expect(requiredCapability('/api/tm/projects', 'GET')).toBe(CAPABILITIES.view);
    expect(requiredCapability('/api/tm/runs/2', 'GET')).toBe(CAPABILITIES.view);
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
  ])('may %s %s', (method, path) => {
    expect(tokenCan(path, method)).toBe(true);
  });

  it.each([
    ['PATCH', '/api/config'],
    ['GET', '/api/access'],
    ['POST', '/api/access'],
    ['POST', '/api/autotests/trigger'],
    ['POST', '/api/autotests/cancel'],
    ['POST', '/api/autotests/rerun'],
  ])('may not %s %s', (method, path) => {
    expect(tokenCan(path, method)).toBe(false);
  });
});
