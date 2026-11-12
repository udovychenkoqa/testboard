import { auth } from '@/app/auth';
import { getDb, type TmDb } from '@/app/lib/tm/db';
import { errorResponse } from '@/app/lib/tm/http';

// Wraps a /api/profile handler: a profile belongs to a signed-in person, so the caller's email comes from
// the session only. An API-token or open-mode request has no email and gets 403.
export const profileRoute =
  (handler: (ctx: { req: Request; db: TmDb; email: string }) => unknown | Promise<unknown>) =>
  async (req: Request): Promise<Response> => {
    try {
      const email = (await auth())?.user?.email;

      if (!email) return Response.json({ error: 'a profile needs a personal sign-in' }, { status: 403 });
      const result = await handler({ req, db: getDb(), email });

      return result instanceof Response ? result : Response.json(result ?? { ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  };
