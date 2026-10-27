import path from 'path';

import mime from 'mime';
import { type NextRequest, NextResponse } from 'next/server';
import { redirect } from 'next/navigation';

import { withError } from '@/app/lib/withError';
import { storage } from '@/app/lib/storage';
import { auth } from '@/app/auth';
import { AUTH_ENABLED } from '@/app/lib/authFlags';
import { withBase } from '@/app/lib/url';

interface ReportParams {
  reportId: string;
  filePath?: string[];
}

// Without this, Next.js can cache this GET route handler's response (e.g. a
// 404 for ai-summary.md before it's written) and keep serving that same
// cached response on later requests for the same path — our client-side
// polling for the AI summary would then spin forever since the "fresh" fetch
// never actually reaches the filesystem again. Every other file this route
// serves (reports, results, screenshots) also legitimately changes over time.
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: ReportParams;
  },
) {
  // is not protected by the middleware
  // as we want to have callbackUrl in the query

  const authRequired = AUTH_ENABLED;
  const session = await auth();

  const { filePath } = params;

  const uriPath = Array.isArray(filePath) ? filePath.join('/') : (filePath ?? '');

  const targetPath = decodeURI(uriPath);

  // Only check for session if auth is required
  if (authRequired && !session?.user?.jwtToken) {
    redirect(withBase(`/login?callbackUrl=${encodeURI(req.nextUrl.pathname)}`));
  }

  const contentType = mime.getType(path.basename(targetPath));

  if (!contentType && !path.extname(targetPath)) {
    return NextResponse.next();
  }

  const { result: content, error } = await withError(storage.readFile(targetPath, contentType));

  if (error ?? !content) {
    return NextResponse.json({ error: `Could not read file ${error?.message ?? ''}` }, { status: 404 });
  }

  const responseHeaders: Record<string, string> = {
    'Content-Type': contentType ?? 'application/octet-stream',
  };

  responseHeaders['X-Content-Type-Options'] = 'nosniff';

  // Attachments a test produced (data/*.html, *.svg) are uploader-controlled. Served from the app origin
  // with scripts enabled they could act as the viewer; sandbox keeps them as plain documents. The report's
  // own index.html and the trace viewer sit outside data/ and keep working.
  const isAttachmentDocument =
    /(^|\/)data\//.test(targetPath) && (contentType === 'text/html' || contentType === 'image/svg+xml');

  if (isAttachmentDocument) responseHeaders['Content-Security-Policy'] = 'sandbox';

  return new Response(content, { headers: responseHeaders });
}
