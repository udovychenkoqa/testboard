import NextAuth from 'next-auth';

import { authConfig } from './auth.config';
import { ROLE_POLICY } from './lib/authFlags';
import { normalizeRole, resolveRole, ROLES, type Role } from './lib/access';
import { needsRoleRecheck } from './lib/roleRecheck';

// The full (Node-runtime) auth instance used by route handlers and server
// components. It extends the edge-safe authConfig with role resolution that
// reads config.json (admin-assigned roles) — via a DYNAMIC import of the
// Node-only roleStore so it never lands in the edge middleware bundle. The
// role is baked into the JWT at sign-in; middleware only reads it back.
// AUTH_ADMIN_EMAILS are ALWAYS administrators and cannot be demoted through the UI — this prevents an
// admin locking themselves out. Otherwise the assigned role wins, then the domain default (member).
const resolveGoogleRole = async (email: string | null | undefined): Promise<Role | undefined> => {
  const { getAssignedRole } = await import('./lib/roleStore');
  const assigned = await getAssignedRole(email);
  const envRole = resolveRole(email, ROLE_POLICY); // administrator | member | null

  return envRole === ROLES.administrator ? envRole : (normalizeRole(assigned) ?? envRole ?? undefined);
};

// Remembers the person for the access list. Never blocks a sign-in: the list is a convenience.
const rememberSignIn = async (email: string | null | undefined, name: string | null | undefined) => {
  if (!email) return;
  try {
    const [{ getDb }, { recordSignIn }] = await Promise.all([import('./lib/tm/db'), import('./lib/signIns')]);

    recordSignIn(getDb(), email, name);
  } catch (error) {
    console.error('[auth] could not record the sign-in', error);
  }
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // Allow the sign-in if the email is either an allowed-domain user OR an
    // email an admin explicitly assigned a role to (e.g. an external contractor
    // outside the domain). Non-Google providers are gated in their authorize().
    async signIn({ account, user, profile }) {
      if (account?.provider !== 'google') return true;
      if (profile?.email_verified === false) return false;

      if (resolveRole(user.email, ROLE_POLICY) !== null) return true;

      const { getAssignedRole } = await import('./lib/roleStore');

      return !!(await getAssignedRole(user.email));
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === 'google') {
          token.role = await resolveGoogleRole(user.email);
          token.roleCheckedAt = Date.now();
          token.email = user.email ?? undefined;
          token.jwtToken = `oauth:${user.email}`;
          await rememberSignIn(user.email, user.name);
        } else {
          token.apiToken = user.apiToken;
          token.jwtToken = user.jwtToken;
          token.role = user.role;
        }
      } else if (needsRoleRecheck(token, Date.now())) {
        // A removed person ends up with no role, which middleware treats as signed out.
        token.role = await resolveGoogleRole(token.email as string);
        token.roleCheckedAt = Date.now();
      }

      return token;
    },
  },
});
