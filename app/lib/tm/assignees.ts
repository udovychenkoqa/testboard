import { ROLES } from '@/app/lib/access';
import { ROLE_POLICY } from '@/app/lib/authFlags';
import { getUserRoles } from '@/app/lib/roleStore';

// People a run case can be assigned to: everyone who can record results —
// admins from env plus users given the admin or tester role in Settings.
export const listAssignees = async (): Promise<string[]> => {
  const users = await getUserRoles();
  const fromSettings = Object.entries(users)
    .filter(([, role]) => role === ROLES.admin || role === ROLES.tester)
    .map(([email]) => email);

  return [...new Set([...ROLE_POLICY.adminEmails, ...fromSettings].map((e) => e.toLowerCase()))].sort();
};
