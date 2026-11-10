import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';

import { authConfig } from '@/app/auth.config';
import { CommonResponseFactory } from '@/app/lib/network';
import { isAuthorized } from '@/app/lib/auth';
import { AUTH_ENABLED } from '@/app/lib/authFlags';
import { apiTokenCan, can, requiredCapability } from '@/app/lib/access';
import { env } from '@/app/config/env';
import { withBase } from '@/app/lib/url';

export const config = {
  matcher: '/api/:path*',
};

// GET-only public routes (plus their API_BASE_PATH-prefixed variants). Serve
// and download run their own per-route session check and keep the callbackUrl
// redirect, so they stay out of here.
const UNPROTECTED = [
  { methods: ['GET'], path: '/api/ping' },
  { methods: ['GET', 'POST'], path: '/api/auth' },
  { methods: ['GET'], path: '/api/serve' },
  { methods: ['GET'], path: '/api/download' },
  { methods: ['GET'], path: '/api/static' },
  { methods: ['GET'], path: '/api/config' },
];

const unprotectedRoutes = UNPROTECTED.concat(
  UNPROTECTED.map((route) => ({ methods: route.methods, path: withBase(route.path) })),
);

// Wrapped in NextAuth's `auth` so `req.auth` carries the decoded session
// (Google/token/no-auth) on the edge without importing any Node-only lib.
const { auth } = NextAuth(authConfig);

export default auth((request) => {
  // Neither API_TOKEN nor Google configured → app is fully open, as before.
  if (!AUTH_ENABLED) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const method = request.method;

  const isUnprotected = unprotectedRoutes.some(
    (route) => pathname.startsWith(route.path) && route.methods.includes(method),
  );

  if (isUnprotected) return NextResponse.next();

  const capability = requiredCapability(pathname, method);

  // Human session path first (Google, or the API-token credentials login): the role decides. A token
  // sign-in session also sends the token as Authorization, and must keep its admin role.
  const role = request.auth?.user?.role;

  if (role) {
    return can(role, capability) ? NextResponse.next() : CommonResponseFactory.buildForbiddenResponse();
  }

  // CI / programmatic path: a matching Authorization header gets the token's capabilities (no settings,
  // roles or pipeline triggers; see apiTokenCan).
  if (
    env.API_TOKEN &&
    isAuthorized({ actualAuthToken: request.headers.get('Authorization'), expectedAuthToken: env.API_TOKEN })
  ) {
    return apiTokenCan(capability) ? NextResponse.next() : CommonResponseFactory.buildForbiddenResponse();
  }

  return CommonResponseFactory.buildUnauthorizedResponse();
});
