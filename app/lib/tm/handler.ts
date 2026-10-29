import { getDb, type TmDb } from './db';
import { errorResponse } from './http';

import { auth } from '@/app/auth';
import { CAPABILITIES, can } from '@/app/lib/access';
import { AUTH_ENABLED } from '@/app/lib/authFlags';
import { isAuthorized } from '@/app/lib/auth';
import { env } from '@/app/config/env';

interface Ctx<P> {
  req: Request;
  params: P;
  db: TmDb;
  // Who did it, for created_by/result_by: the signed-in email, or a marker for API-key / open mode.
  by: string;
}

// Wraps a /api/tm route handler: resolves the actor, re-checks write access
// (middleware already does; this is defence in depth, like /api/access), and
// turns thrown errors into JSON responses.
export const tmRoute =
  <P = Record<string, never>>(handler: (ctx: Ctx<P>) => unknown | Promise<unknown>) =>
  async (req: Request, { params }: { params: P }): Promise<Response> => {
    try {
      const session = AUTH_ENABLED ? await auth() : null;
      // Same rule as the middleware: the service API token is full (admin) access.
      const hasApiToken =
        !!env.API_TOKEN &&
        isAuthorized({ actualAuthToken: req.headers.get('Authorization'), expectedAuthToken: env.API_TOKEN });

      if (AUTH_ENABLED && req.method !== 'GET' && !hasApiToken && !can(session?.user?.role, CAPABILITIES.manageCases)) {
        return Response.json({ error: 'forbidden' }, { status: 403 });
      }
      const by = session?.user?.email ?? (AUTH_ENABLED ? 'api-key' : 'open');
      const result = await handler({ req, params, db: getDb(), by });

      return result instanceof Response ? result : Response.json(result ?? { ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  };

export const readJson = async (req: Request): Promise<unknown> => {
  try {
    return await req.json();
  } catch {
    return {};
  }
};
