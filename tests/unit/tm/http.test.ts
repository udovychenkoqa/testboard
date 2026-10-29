import { z } from 'zod';

import { TmError } from '@/app/lib/tm/errors';
import { errorResponse } from '@/app/lib/tm/http';

describe('errorResponse', () => {
  it.each([
    ['not_found', 404],
    ['conflict', 409],
    ['not_empty', 409],
    ['invalid', 400],
  ] as const)('maps TmError(%s) to %i', async (code, status) => {
    const res = errorResponse(new TmError(code, 'boom'));

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: 'boom' });
  });

  it('turns a zod error into a 400 naming the field', async () => {
    const parsed = z.object({ name: z.string().min(1) }).safeParse({ name: '' });
    const res = errorResponse(parsed.error);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/^name: /);
  });

  it('hides unexpected errors behind a 500', async () => {
    const res = errorResponse(new Error('SQLITE_BUSY: database is locked'));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal error' });
  });
});
