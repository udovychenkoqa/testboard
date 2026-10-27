// The role is baked into the JWT at sign-in. A Google session re-resolves it from the current config
// (assigned roles, admin emails, allowed domains) at most this often, so demoting or removing a person
// takes effect without waiting for the cookie to expire.
export const ROLE_RECHECK_MS = 60_000;

interface RecheckableToken {
  jwtToken?: unknown;
  email?: unknown;
  roleCheckedAt?: unknown;
}

export const needsRoleRecheck = (token: RecheckableToken, now: number): boolean =>
  typeof token.jwtToken === 'string' &&
  token.jwtToken.startsWith('oauth:') &&
  typeof token.email === 'string' &&
  now - (typeof token.roleCheckedAt === 'number' ? token.roleCheckedAt : 0) >= ROLE_RECHECK_MS;
