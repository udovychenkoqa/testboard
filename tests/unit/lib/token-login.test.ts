import { isTokenLoginEnabled } from '@/app/lib/tokenLogin';

describe('isTokenLoginEnabled', () => {
  it('needs an API token', () => {
    expect(isTokenLoginEnabled({ hasApiToken: false, googleEnabled: false, forced: false })).toBe(false);
    expect(isTokenLoginEnabled({ hasApiToken: false, googleEnabled: true, forced: true })).toBe(false);
  });

  it('is the only sign-in when Google is off', () => {
    expect(isTokenLoginEnabled({ hasApiToken: true, googleEnabled: false, forced: false })).toBe(true);
  });

  it('is off once Google is on, so the CI token cannot open the UI as admin', () => {
    expect(isTokenLoginEnabled({ hasApiToken: true, googleEnabled: true, forced: false })).toBe(false);
  });

  it('comes back with AUTH_TOKEN_LOGIN as a break-glass path', () => {
    expect(isTokenLoginEnabled({ hasApiToken: true, googleEnabled: true, forced: true })).toBe(true);
  });
});
