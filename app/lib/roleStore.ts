import { service } from '@/app/lib/service';

// Node-only store for admin-managed email → role assignments, persisted in
// config.json (config.access.users). Kept out of the edge-bundled auth.config
// on purpose — it's imported dynamically at sign-in (Node) from app/auth.ts.

export type UserRoles = Record<string, string>;

const normalize = (email: string): string => email.trim().toLowerCase();

export const getUserRoles = async (): Promise<UserRoles> => {
  const config = await service.getConfig();

  return config?.access?.users ?? {};
};

// The role an admin explicitly assigned to this email, or undefined if none.
export const getAssignedRole = async (email: string | null | undefined): Promise<string | undefined> => {
  if (!email) return undefined;
  const roles = await getUserRoles();

  return roles[normalize(email)];
};

// Replaces the whole map (the admin UI sends the full list). Emails are
// normalized and blank rows dropped so the stored map stays clean.
export const saveUserRoles = async (users: UserRoles): Promise<UserRoles> => {
  const cleaned: UserRoles = {};

  for (const [email, role] of Object.entries(users)) {
    const key = normalize(email);

    if (key && role) cleaned[key] = role;
  }

  await service.updateConfig({ access: { users: cleaned } });

  return cleaned;
};
