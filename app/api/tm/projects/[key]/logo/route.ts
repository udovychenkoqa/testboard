import { tmRoute } from '@/app/lib/tm/handler';
import { TmError } from '@/app/lib/tm/errors';
import { deleteProjectLogo, getProjectLogo, MAX_LOGO_BYTES, setProjectLogo } from '@/app/lib/tm/projectLogo';

export const dynamic = 'force-dynamic';

type P = { key: string };

export const GET = tmRoute<P>(({ db, params }) => {
  const logo = getProjectLogo(db, params.key);

  if (!logo) throw new TmError('not_found', 'no logo');

  return new Response(new Uint8Array(logo.data), {
    headers: {
      'Content-Type': logo.type,
      // An image is all this ever is: no sniffing into HTML, no scripts even if opened directly.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      // The URL carries logoUpdatedAt, so a cached copy is never stale.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
});

// The body is the image itself (no multipart): the client sends the picked File as-is.
export const PUT = tmRoute<P>(async ({ db, params, req }) => {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_LOGO_BYTES) {
    throw new TmError('invalid', 'logo must be 200 KB or smaller');
  }
  setProjectLogo(db, params.key, Buffer.from(await req.arrayBuffer()));
});

export const DELETE = tmRoute<P>(({ db, params }) => {
  deleteProjectLogo(db, params.key);
});
