import { auth } from '@/app/auth';
import { getUserRoles, saveUserRoles, type UserRoles } from '@/app/lib/roleStore';
import { ASSIGNABLE_ROLES, isAdminRole, normalizeRole, ROLES } from '@/app/lib/access';

// Only administrator and member can be handed out; names from before the rename are read as their new ones.
const assignable = (role: string): string => (isAdminRole(role) ? ROLES.administrator : (normalizeRole(role) ?? ROLES.member));

const assignableMap = (users: UserRoles): UserRoles =>
  Object.fromEntries(Object.entries(users).map(([email, role]) => [email, assignable(String(role))]));
import { AUTH_ENABLED, ROLE_POLICY } from '@/app/lib/authFlags';
import { withError } from '@/app/lib/withError';

export const dynamic = 'force-dynamic';

// Middleware already gates /api/access to admins; this is defense-in-depth for
// open mode (no middleware auth) and against any misconfiguration.
const ensureAdmin = async (): Promise<boolean> => {
  if (!AUTH_ENABLED) return true; // open mode = implicit admin
  const session = await auth();

  return isAdminRole(session?.user?.role);
};

export async function GET() {
  if (!(await ensureAdmin())) return new Response('Forbidden', { status: 403 });

  const users = assignableMap(await getUserRoles());

  // Emails from AUTH_ADMIN_EMAILS are permanent administrators (can't be edited/removed in the UI) —
  // surfaced so the client can show them as locked rows.
  return Response.json({ users, assignableRoles: ASSIGNABLE_ROLES, bootstrapAdmins: ROLE_POLICY.adminEmails });
}

export async function POST(request: Request) {
  if (!(await ensureAdmin())) return new Response('Forbidden', { status: 403 });

  const { result: body, error } = await withError(request.json() as Promise<{ users?: UserRoles }>);

  if (error || !body || typeof body.users !== 'object' || body.users === null) {
    return Response.json({ error: 'expected { users: { email: role } }' }, { status: 400 });
  }

  const saved = await saveUserRoles(assignableMap(body.users));

  return Response.json({ users: saved });
}
