import { type NextAuthConfig, type User } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';

import { env } from './config/env';
import { AUTH_ENABLED, GOOGLE_ENABLED, ROLE_POLICY } from './lib/authFlags';
import { resolveRole, ROLES, type Role } from './lib/access';

// Edge-safe NextAuth config shared by app/auth.ts (Node route handler) and
// middleware.ts (edge). Deliberately imports NO Node-only libs (jsonwebtoken
// was dropped — the old "jwt" tokens were never verified, only checked for
// presence, so an opaque marker is equivalent and keeps this edge-bundlable).

const secret = env.AUTH_SECRET ?? 'default-secret-for-non-auth-mode';
const expirationHours = env.UI_AUTH_EXPIRE_HOURS ? parseInt(env.UI_AUTH_EXPIRE_HOURS) : 2;
const expirationSeconds = expirationHours * 60 * 60;

const buildProviders = () => {
  const providers = [];

  if (GOOGLE_ENABLED) {
    // With exactly one allowed domain, hint Google to show only that Workspace's
    // accounts in the chooser (UX only — the real gate is the signIn callback).
    const hd = ROLE_POLICY.allowedDomains.length === 1 ? ROLE_POLICY.allowedDomains[0] : undefined;

    providers.push(
      Google({
        clientId: env.AUTH_GOOGLE_ID,
        clientSecret: env.AUTH_GOOGLE_SECRET,
        // Force the account chooser so switching accounts is possible; ask only
        // for identity scopes.
        authorization: { params: { scope: 'openid email profile', prompt: 'select_account', ...(hd ? { hd } : {}) } },
      }),
    );
  }

  // The API_TOKEN login is the service/admin path — a correct token grants the
  // admin role. apiToken is the real token so the browser keeps passing it as
  // the Authorization header (middleware's CI path).
  if (env.API_TOKEN) {
    providers.push(
      Credentials({
        name: 'API Token',
        credentials: { apiToken: { label: 'API Token', type: 'password' } },
        async authorize(credentials): Promise<User | null> {
          if (credentials?.apiToken !== env.API_TOKEN) return null;

          return {
            apiToken: credentials.apiToken as string,
            jwtToken: 'api-token',
            role: ROLES.admin,
          };
        },
      }),
    );
  }

  // Open mode: neither API_TOKEN nor Google configured → everyone is an
  // implicit admin, exactly as before this feature. Middleware short-circuits
  // when AUTH_ENABLED is false, so these marker tokens are never checked.
  if (!AUTH_ENABLED) {
    providers.push(
      Credentials({
        name: 'No Auth',
        credentials: {},
        async authorize(): Promise<User | null> {
          return { apiToken: 'open', jwtToken: 'open', role: ROLES.admin };
        },
      }),
    );
  }

  return providers;
};

export const authConfig: NextAuthConfig = {
  secret,
  trustHost: true,
  session: { strategy: 'jwt', maxAge: expirationSeconds },
  pages: { signIn: '/login' },
  providers: buildProviders(),
  callbacks: {
    // Reject Google sign-ins whose email isn't allowed (wrong domain / not an
    // admin). Other providers (API token, no-auth) already gated in authorize.
    async signIn({ account, user, profile }) {
      if (account?.provider !== 'google') return true;
      if (profile?.email_verified === false) return false;

      return resolveRole(user.email, ROLE_POLICY) !== null;
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === 'google') {
          token.role = resolveRole(user.email, ROLE_POLICY) ?? undefined;
          token.email = user.email ?? undefined;
          // Presence marker so the serve/download gates (which only check
          // truthiness) pass; NOT the API token — Google users never get it.
          token.jwtToken = `oauth:${user.email}`;
        } else {
          token.apiToken = user.apiToken;
          token.jwtToken = user.jwtToken;
          token.role = user.role;
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.apiToken = token.apiToken as string | undefined;
      session.user.jwtToken = token.jwtToken as string | undefined;
      session.user.role = token.role as Role | undefined;
      if (token.email) session.user.email = token.email as string;

      return session;
    },
  },
};
