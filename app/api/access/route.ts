import { auth } from '@/app/auth';
import { getUserRoles, saveUserRoles, type UserRoles } from '@/app/lib/roleStore';
import { ASSIGNABLE_ROLES, ROLES } from '@/app/lib/access';
import { AUTH_ENABLED, ROLE_POLICY } from '@/app/lib/authFlags';
import { withError } from '@/app/lib/withError';

export const dynamic = 'force-dynamic';

// Middleware already gates /api/access to admins; this is defense-in-depth for
// open mode (no middleware auth) and against any misconfiguration.
const ensureAdmin = async (): Promise<boolean> => {
  if (!AUTH_ENABLED) return true; // open mode = implicit admin
  const session = await auth();

  return session?.user?.role === ROLES.admin;
};

export async function GET() {
  if (!(await ensureAdmin())) return new Response('Forbidden', { status: 403 });

  const users = await getUserRoles();

  // Emails from AUTH_ADMIN_EMAILS are permanent admins (can't be edited/removed
  // in the UI) — surfaced so the client can show them as locked rows.
  return Response.json({ users, assignableRoles: ASSIGNABLE_ROLES, bootstrapAdmins: ROLE_POLICY.adminEmails });
}

export async function POST(request: Request) {
  if (!(await ensureAdmin())) return new Response('Forbidden', { status: 403 });

  const { result: body, error } = await withError(request.json() as Promise<{ users?: UserRoles }>);

  if (error || !body || typeof body.users !== 'object' || body.users === null) {
    return Response.json({ error: 'expected { users: { email: role } }' }, { status: 400 });
  }

  const saved = await saveUserRoles(body.users);

  return Response.json({ users: saved });
}
