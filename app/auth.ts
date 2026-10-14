import NextAuth from 'next-auth';

import { authConfig } from './auth.config';
import { ROLE_POLICY } from './lib/authFlags';
import { resolveRole } from './lib/access';

// The full (Node-runtime) auth instance used by route handlers and server
// components. It extends the edge-safe authConfig with role resolution that
// reads config.json (admin-assigned roles) — via a DYNAMIC import of the
// Node-only roleStore so it never lands in the edge middleware bundle. The
// role is baked into the JWT at sign-in; middleware only reads it back.
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
          const { getAssignedRole } = await import('./lib/roleStore');
          const assigned = await getAssignedRole(user.email);
          const envRole = resolveRole(user.email, ROLE_POLICY); // 'admin' | 'viewer' | null

          // Bootstrap admins (AUTH_ADMIN_EMAILS) are ALWAYS admin and cannot be
          // demoted through the UI — this prevents an admin locking themselves
          // out. Otherwise the admin-assigned role wins, then the domain default.
          token.role = envRole === 'admin' ? 'admin' : (assigned ?? envRole ?? undefined);
          token.email = user.email ?? undefined;
          token.jwtToken = `oauth:${user.email}`;
        } else {
          token.apiToken = user.apiToken;
          token.jwtToken = user.jwtToken;
          token.role = user.role;
        }
      }

      return token;
    },
  },
});
