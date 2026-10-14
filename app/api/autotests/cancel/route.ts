import { type NextRequest } from 'next/server';

import { withError } from '@/app/lib/withError';
import { isDroneConfigured, cancelAutotestsBuild } from '@/app/lib/drone';

export const dynamic = 'force-dynamic';

// Cancel a running autotest build. Gated by the run:tests capability in
// middleware (same tier as triggering — anyone who can run can cancel).
export async function POST(req: NextRequest) {
  if (!isDroneConfigured()) {
    return Response.json({ error: 'Drone CI is not configured on this server' }, { status: 503 });
  }

  const { result: body, error: bodyError } = await withError(req.json());

  if (bodyError) {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const number = Number(body?.number);

  if (!Number.isInteger(number) || number <= 0) {
    return Response.json({ error: 'expected { number: <build number> }' }, { status: 400 });
  }

  const { error } = await withError(cancelAutotestsBuild(number));

  if (error) {
    return Response.json({ error: error.message }, { status: 502 });
  }

  return Response.json({ ok: true });
}
