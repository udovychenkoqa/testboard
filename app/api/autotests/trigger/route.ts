import { auth } from '@/app/auth';
import { readBody, notConfigured, upstreamError } from '@/app/lib/autotests/http';
import { recordPipeline } from '@/app/lib/autotests/pipelines';
import { triggerInputs } from '@/app/lib/autotests/schema';
import { createPipeline, isGitlabConfigured } from '@/app/lib/gitlab';
import { getDb } from '@/app/lib/tm/db';

export const dynamic = 'force-dynamic';

// Gated by run:tests in middleware (viewers too).
export async function POST(req: Request) {
  if (!isGitlabConfigured()) return notConfigured();

  try {
    const inputs = triggerInputs.parse(await readBody(req));
    const session = await auth();
    const build = await createPipeline({ ...inputs });

    recordPipeline(getDb(), {
      pipelineId: build.id,
      startedBy: session?.user?.name || session?.user?.email || null,
      inputs,
    });

    return Response.json({ build, link: build.link });
  } catch (error) {
    return upstreamError(error);
  }
}
