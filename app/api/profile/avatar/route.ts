import { profileRoute } from '@/app/lib/profileRoute';
import { deleteAvatar, getAvatar, setAvatar } from '@/app/lib/profiles';
import { TmError } from '@/app/lib/tm/errors';
import { tmRoute } from '@/app/lib/tm/handler';
import { MAX_LOGO_BYTES } from '@/app/lib/tm/projectLogo';

export const dynamic = 'force-dynamic';

// Anyone signed in may see a person's photo (middleware), including sessions with no profile of their own.
export const GET = tmRoute(({ db, req }) => {
  const email = new URL(req.url).searchParams.get('email');
  const avatar = email ? getAvatar(db, email) : null;

  if (!avatar) throw new TmError('not_found', 'no photo');

  return new Response(new Uint8Array(avatar.data), {
    headers: {
      'Content-Type': avatar.type,
      // An image is all this ever is: no sniffing into HTML, no scripts even if opened directly.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      // The URL carries avatarUpdatedAt, so a cached copy is never stale.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
});

// The body is the image itself (no multipart); only the caller's own photo can be changed.
export const PUT = profileRoute(async ({ db, email, req }) => {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_LOGO_BYTES) {
    throw new TmError('invalid', 'photo must be 200 KB or smaller');
  }
  setAvatar(db, email, Buffer.from(await req.arrayBuffer()));
});

export const DELETE = profileRoute(({ db, email }) => {
  deleteAvatar(db, email);
});
