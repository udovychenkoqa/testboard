import { z } from 'zod';

import { profileRoute } from '@/app/lib/profileRoute';
import { getProfile, saveProfile } from '@/app/lib/profiles';
import { readJson } from '@/app/lib/tm/handler';

export const dynamic = 'force-dynamic';

const profileInput = z.object({
  firstName: z.string().max(80),
  lastName: z.string().max(80),
  position: z.string().max(80),
});

// The caller's own profile; the email always comes from the session, never from the request.
export const GET = profileRoute(({ db, email }) => getProfile(db, email));

export const PUT = profileRoute(async ({ db, email, req }) =>
  saveProfile(db, email, profileInput.parse(await readJson(req))),
);
