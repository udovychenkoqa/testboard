import { can, CAPABILITIES } from '@/app/lib/access';
import { ROLE_POLICY } from '@/app/lib/authFlags';
import { getUserRoles } from '@/app/lib/roleStore';

// People a run case can be assigned to: everyone known who can record results —
// owners from env plus users listed in Settings (anyone else from the domain appears once listed there).
export const listAssignees = async (): Promise<string[]> => {
  const users = await getUserRoles();
  const fromSettings = Object.entries(users)
    .filter(([, role]) => can(role, CAPABILITIES.manageCases))
    .map(([email]) => email);

  return [...new Set([...ROLE_POLICY.adminEmails, ...fromSettings].map((e) => e.toLowerCase()))].sort();
};
