import { type NextRequest } from 'next/server';

import { withError } from '@/app/lib/withError';
import { isDroneConfigured, triggerAutotestsBuild, droneBuildLink } from '@/app/lib/drone';
import { auth } from '@/app/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isDroneConfigured()) {
    return Response.json({ error: 'Drone CI is not configured on this server' }, { status: 503 });
  }

  const { result: body, error: bodyError } = await withError(req.json());

  if (bodyError) {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const environment = String(body?.environment ?? '').trim() || 'test';
  const funnel = String(body?.funnel ?? '').trim() || 'Hw1Vs5W';
  const tag = String(body?.tag ?? '').trim() || '@smoke';
  const abTest = String(body?.abTest ?? '').trim() || undefined;
  const abVariation = String(body?.abVariation ?? '').trim() || undefined;
  const locale = String(body?.locale ?? '').trim() || undefined;
  const slideUrl = String(body?.slideUrl ?? '').trim() || undefined;
  const devices = String(body?.devices ?? '').trim() || undefined;

  // Attribute the run to the signed-in user (Drone's own sender is the token
  // owner). undefined in API-token/open mode → falls back to sender in the UI.
  const session = await auth();
  const startedBy = session?.user?.name || session?.user?.email || undefined;

  const { result: build, error } = await withError(
    triggerAutotestsBuild({ environment, funnel, tag, abTest, abVariation, locale, slideUrl, devices, startedBy }),
  );

  if (error || !build) {
    return Response.json({ error: error?.message ?? 'failed to trigger build' }, { status: 502 });
  }

  return Response.json({ build, link: droneBuildLink(build.number) });
}
