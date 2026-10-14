import { type NextRequest } from 'next/server';

import { withError } from '@/app/lib/withError';
import { isDroneConfigured, listAutotestsBuilds, getAutotestsBuildCount, droneBuildLink } from '@/app/lib/drone';

export const dynamic = 'force-dynamic';

const PER_PAGE = 10;

export async function GET(req: NextRequest) {
  if (!isDroneConfigured()) {
    return Response.json({ enabled: false, builds: [] });
  }

  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);

  const [{ result: builds, error }, { result: total }] = await Promise.all([
    withError(listAutotestsBuilds(PER_PAGE, page)),
    withError(getAutotestsBuildCount()),
  ]);

  if (error || !builds) {
    return Response.json({ enabled: true, builds: [], error: error?.message ?? 'failed to list builds' });
  }

  return Response.json({
    enabled: true,
    page,
    perPage: PER_PAGE,
    total: total ?? 0,
    builds: builds.map((build) => ({
      ...build,
      // Prefer the STARTED_BY custom param (the logged-in user who triggered);
      // fall back to Drone's sender (the token owner) for older/CI builds.
      startedBy: build.params?.STARTED_BY ?? build.sender,
      // true when the run came from the service token (no STARTED_BY) rather
      // than a signed-in human — used to badge it "CI" in the UI.
      viaCi: !build.params?.STARTED_BY,
      // Surface the run parameters so the UI can show what each build tested.
      environment: build.params?.ENVIRONMENT,
      funnel: build.params?.FUNNEL,
      tag: build.params?.TAG,
      abTest: build.params?.AB_TEST,
      abVariation: build.params?.AB_VARIATION,
      locale: build.params?.LOCALE,
      slideUrl: build.params?.SLIDE_URL,
      link: droneBuildLink(build.number),
    })),
  });
}
