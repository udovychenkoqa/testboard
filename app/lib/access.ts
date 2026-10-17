// Role-based access model — a slimmed port of the upstream
// (CyborgTests/playwright-reports-server) `packages/shared/src/access.ts`.
// Framework-agnostic and env-free on purpose: usable from the edge middleware,
// server routes, and client components alike. Three roles (admin, tester,
// viewer), no invites/audit — roles come from env (see authFlags.ts) and the
// admin-managed map in config.json (see roleStore.ts).

export const ROLES = {
  admin: 'admin',
  // Writes test cases and works through manual runs; no Settings access.
  tester: 'tester',
  viewer: 'viewer',
} as const;

// A role is a free-form label (admin can define e.g. "developer", "qa
// engineer"). 'admin' grants everything and 'tester' adds test-management
// writes; every other label is an organizational tag with viewer access. See can().
export type Role = string;

// Roles offered in the admin UI dropdown. More labels could be added here, but
// they'd behave as viewer: only 'admin' and 'tester' carry extra rights.
export const ASSIGNABLE_ROLES = ['admin', 'tester', 'viewer'] as const;

// The role a signed-in but unassigned allowed-domain user gets by default.
export const DEFAULT_ROLE: Role = ROLES.viewer;

// Capabilities gate groups of routes/actions. Keep the set small; add one only
// when a real route needs a distinct rule (not "just in case").
export const CAPABILITIES = {
  // Read reports/results and anything a logged-in human should see.
  view: 'view',
  // Trigger autotest runs — allowed for viewers too (not just admins).
  runTests: 'run:tests',
  // Mutating report/result actions: delete, (re)generate.
  manageReports: 'manage:reports',
  // Server/notification/AI settings (POST /api/config, /api/access).
  manageSettings: 'manage:settings',
  // Test management writes: projects, suites, cases, runs and their results.
  manageCases: 'manage:cases',
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

// Roles are labels: 'admin' can do everything, any other non-null label is
// read-only. There's intentionally no per-label matrix — the product decision
// is that only admin is privileged (labels are organizational).
// Only Settings / access management is admin-exclusive. A signed-in viewer can
// do everything else: view, run tests, delete, regenerate AI.
export const can = (role: Role | null | undefined, capability: Capability): boolean => {
  if (role === ROLES.admin) return true;
  // Unlike the rest, test management is closed to viewers and free-form labels.
  if (capability === CAPABILITIES.manageCases) return role === ROLES.tester;

  return !!role && capability !== CAPABILITIES.manageSettings;
};

// --- Assigning a role from an email (env-driven, no DB) --------------------

export interface RolePolicy {
  adminEmails: string[];
  allowedDomains: string[];
}

// Exact domain or subdomain match (foo.com allows a@foo.com and a@sub.foo.com).
const domainAllowed = (domain: string, allowed: string[]): boolean =>
  allowed.some((d) => domain === d || domain.endsWith(`.${d}`));

/**
 * Maps a verified OAuth email to a role, or null when the email isn't allowed
 * in at all (caller rejects the sign-in). Admins listed by exact email are
 * always allowed regardless of domain; everyone else must match an allowed
 * domain. With no domains AND no admin emails configured, nobody is allowed
 * (Google is effectively misconfigured — fail closed, never open).
 */
export const resolveRole = (email: string | undefined | null, policy: RolePolicy): Role | null => {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();

  if (policy.adminEmails.includes(normalized)) return ROLES.admin;

  const domain = normalized.split('@')[1] ?? '';

  if (policy.allowedDomains.length > 0 && domainAllowed(domain, policy.allowedDomains)) {
    return ROLES.viewer;
  }

  return null;
};

// --- Mapping an /api request to the capability it requires -----------------

interface AdminRoute {
  method: string;
  // Matched against the pathname; endsWith so a configurable API base path
  // prefix (API_BASE_PATH) doesn't break the match.
  suffix: string;
}

// Everything not listed here requires only `view` (any authenticated user).
// These are the mutating/privileged endpoints (see app/api/*/route.ts).
const ADMIN_ROUTES: AdminRoute[] = [
  { method: 'GET', suffix: '/api/access' }, // manage:settings (user/role admin)
  { method: 'POST', suffix: '/api/access' },
  { method: 'POST', suffix: '/api/config' }, // manage:settings
  { method: 'POST', suffix: '/api/report/delete' },
  { method: 'POST', suffix: '/api/result/delete' },
  { method: 'POST', suffix: '/api/report/generate' },
  { method: 'POST', suffix: '/api/autotests/trigger' }, // run:tests (viewers too)
  { method: 'POST', suffix: '/api/autotests/cancel' }, // run:tests
  { method: 'POST', suffix: '/api/autotests/rerun' }, // run:tests
  { method: 'POST', suffix: '/ai-summary' }, // POST /api/report/{id}/ai-summary (Regenerate)
];

export const requiredCapability = (pathname: string, method: string): Capability => {
  if (pathname.includes('/api/tm/')) return method === 'GET' ? CAPABILITIES.view : CAPABILITIES.manageCases;
  const match = ADMIN_ROUTES.find((route) => route.method === method && pathname.endsWith(route.suffix));

  if (!match) return CAPABILITIES.view;
  if (match.suffix.startsWith('/api/autotests/')) return CAPABILITIES.runTests;
  if (match.suffix === '/api/config' || match.suffix === '/api/access') return CAPABILITIES.manageSettings;

  return CAPABILITIES.manageReports;
};
