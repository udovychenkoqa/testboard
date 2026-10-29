import { ZodError } from 'zod';

import { TmError, type TmErrorCode } from './errors';

const STATUS: Record<TmErrorCode, number> = {
  not_found: 404,
  conflict: 409,
  not_empty: 409,
  invalid: 400,
};

// Domain and validation errors become readable 4xx responses; anything else is
// logged and reported as a generic 500 (no internals leak to the client).
export const errorResponse = (error: unknown): Response => {
  if (error instanceof TmError) return Response.json({ error: error.message }, { status: STATUS[error.code] });
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const field = issue?.path.join('.') || 'body';

    return Response.json({ error: `${field}: ${issue?.message ?? 'invalid'}` }, { status: 400 });
  }
  console.error('[tm] unexpected error', error);

  return Response.json({ error: 'internal error' }, { status: 500 });
};
