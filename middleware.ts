import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';

import { authConfig } from '@/app/auth.config';
import { CommonResponseFactory } from '@/app/lib/network';
import { isAuthorized } from '@/app/lib/auth';
import { AUTH_ENABLED } from '@/app/lib/authFlags';
import { can, requiredCapability } from '@/app/lib/access';
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

  // CI / programmatic path: a matching Authorization header is full access
  // (the service token behaves as admin, unchanged from before).
  if (
    env.API_TOKEN &&
    isAuthorized({ actualAuthToken: request.headers.get('Authorization'), expectedAuthToken: env.API_TOKEN })
  ) {
    return NextResponse.next();
  }

  // Human session path (Google, or the API-token credentials login): must be
  // signed in, and must have the role capability for this route.
  const role = request.auth?.user?.role;

  if (!role) return CommonResponseFactory.buildUnauthorizedResponse();

  if (!can(role, requiredCapability(pathname, method))) {
    return CommonResponseFactory.buildForbiddenResponse();
  }

  return NextResponse.next();
});
