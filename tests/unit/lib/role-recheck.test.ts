import { needsRoleRecheck, ROLE_RECHECK_MS } from '@/app/lib/roleRecheck';

describe('needsRoleRecheck', () => {
  const now = 1_000_000;
  const google = { jwtToken: 'oauth:a@b.c', email: 'a@b.c' };

  it('rechecks a Google session that was never checked or is stale', () => {
    expect(needsRoleRecheck(google, now)).toBe(true);
    expect(needsRoleRecheck({ ...google, roleCheckedAt: now - ROLE_RECHECK_MS }, now)).toBe(true);
  });

  it('skips a fresh check', () => {
    expect(needsRoleRecheck({ ...google, roleCheckedAt: now - 1000 }, now)).toBe(false);
  });

  it('never touches API-token or open-mode sessions', () => {
    expect(needsRoleRecheck({ jwtToken: 'api-token' }, now)).toBe(false);
    expect(needsRoleRecheck({ jwtToken: 'open' }, now)).toBe(false);
  });
});
