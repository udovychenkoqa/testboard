// Role-based access model. Framework-agnostic and env-free on purpose: usable from the edge middleware,
// server routes and client components alike. Two roles, named as in Qase:
//   administrator  everything; assigned in Settings, or fixed by AUTH_ADMIN_EMAILS (can't be changed in the UI)
//   member         the daily work (cases, runs, autotests, reports) without deletes, projects or settings;
//                  the default for anyone from an allowed domain
// Roles come from env (see authFlags.ts) and the admin-managed map in config.json (see roleStore.ts).

export const ROLES = {
  administrator: 'administrator',
  member: 'member',
} as const;

export type Role = string;

// Roles an administrator can hand out.
export const ASSIGNABLE_ROLES = [ROLES.administrator, ROLES.member] as const;

// The role a signed-in but unassigned allowed-domain user gets.
export const DEFAULT_ROLE: Role = ROLES.member;

// Stored maps and live sessions may still carry the names from before the rename (admin / tester / viewer),
// and older configs allowed free-form labels. All of them keep working: admin was full access, the rest
// become member.
export const normalizeRole = (role: Role | null | undefined): Role | null => {
  if (!role) return null;
  // 'owner' existed briefly as a separate name for the AUTH_ADMIN_EMAILS administrators.
  if (role === ROLES.administrator || role === 'admin' || role === 'owner') return ROLES.administrator;

  return ROLES.member;
};

export const isAdminRole = (role: Role | null | undefined): boolean => normalizeRole(role) === ROLES.administrator;

// Capabilities gate groups of routes/actions. Keep the set small; add one only
// when a real route needs a distinct rule (not "just in case").
export const CAPABILITIES = {
  // Read reports, results, trends, cases and runs.
  view: 'view',
  // Start, cancel and rerun autotest pipelines.
  runTests: 'run:tests',
  // Add to reports: upload results, generate a report, regenerate the AI summary.
  manageReports: 'manage:reports',
  // Delete reports and results (can't be undone).
  deleteReports: 'delete:reports',
  // Test management writes: suites, cases, runs and their results, a project's name and logo.
  manageCases: 'manage:cases',
  // Create and delete test-management projects.
  manageProjects: 'manage:projects',
  // Server/notification/AI settings and user roles (/api/config, /api/access).
  manageSettings: 'manage:settings',
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

const ADMIN_ONLY: ReadonlySet<Capability> = new Set([
  CAPABILITIES.deleteReports,
  CAPABILITIES.manageProjects,
  CAPABILITIES.manageSettings,
]);

export const can = (role: Role | null | undefined, capability: Capability): boolean => {
  const normalized = normalizeRole(role);

  if (!normalized) return false;

  return isAdminRole(normalized) || !ADMIN_ONLY.has(capability);
};

// The API token (Authorization header) lives in CI variables and on QA machines, so it gets what CI and
// scripts use: uploads, report generation, reads, test management and autotest pipelines. Settings and
// roles stay with signed-in people.
export const apiTokenCan = (capability: Capability): boolean => capability !== CAPABILITIES.manageSettings;

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

  if (policy.adminEmails.includes(normalized)) return ROLES.administrator;

  const domain = normalized.split('@')[1] ?? '';

  if (policy.allowedDomains.length > 0 && domainAllowed(domain, policy.allowedDomains)) {
    return DEFAULT_ROLE;
  }

  return null;
};

// --- Mapping an /api request to the capability it requires -----------------

interface GatedRoute {
  method: string;
  // Matched against the pathname; endsWith so a configurable API base path
  // prefix (API_BASE_PATH) doesn't break the match.
  suffix: string;
  capability: Capability;
}

// Everything not listed here (and outside /api/tm) requires only `view`: any signed-in user.
const GATED_ROUTES: GatedRoute[] = [
  { method: 'GET', suffix: '/api/access', capability: CAPABILITIES.manageSettings },
  { method: 'POST', suffix: '/api/access', capability: CAPABILITIES.manageSettings },
  { method: 'POST', suffix: '/api/config', capability: CAPABILITIES.manageSettings },
  // The real settings write (POST was never a handler).
  { method: 'PATCH', suffix: '/api/config', capability: CAPABILITIES.manageSettings },
  { method: 'POST', suffix: '/api/report/delete', capability: CAPABILITIES.deleteReports },
  { method: 'POST', suffix: '/api/result/delete', capability: CAPABILITIES.deleteReports },
  { method: 'DELETE', suffix: '/api/report/delete', capability: CAPABILITIES.deleteReports },
  { method: 'DELETE', suffix: '/api/result/delete', capability: CAPABILITIES.deleteReports },
  { method: 'PUT', suffix: '/api/result/upload', capability: CAPABILITIES.manageReports },
  { method: 'POST', suffix: '/api/report/generate', capability: CAPABILITIES.manageReports },
  // POST /api/report/{id}/ai-summary (Regenerate)
  { method: 'POST', suffix: '/ai-summary', capability: CAPABILITIES.manageReports },
  { method: 'POST', suffix: '/api/autotests/trigger', capability: CAPABILITIES.runTests },
  { method: 'POST', suffix: '/api/autotests/cancel', capability: CAPABILITIES.runTests },
  { method: 'POST', suffix: '/api/autotests/rerun', capability: CAPABILITIES.runTests },
];

// POST …/api/tm/projects creates a project, DELETE …/api/tm/projects/{key} removes one with everything in it.
const isProjectLifecycle = (pathname: string, method: string): boolean =>
  (method === 'POST' && pathname.endsWith('/api/tm/projects')) ||
  (method === 'DELETE' && /\/api\/tm\/projects\/[^/]+$/.test(pathname));

export const requiredCapability = (pathname: string, method: string): Capability => {
  if (pathname.includes('/api/tm/')) {
    if (method === 'GET') return CAPABILITIES.view;

    return isProjectLifecycle(pathname, method) ? CAPABILITIES.manageProjects : CAPABILITIES.manageCases;
  }

  return (
    GATED_ROUTES.find((route) => route.method === method && pathname.endsWith(route.suffix))?.capability ??
    CAPABILITIES.view
  );
};
