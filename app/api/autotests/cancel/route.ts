import { readBody, notConfigured, notStartedHere, upstreamError } from '@/app/lib/autotests/http';
import { getPipelineRecords } from '@/app/lib/autotests/pipelines';
import { pipelineId } from '@/app/lib/autotests/schema';
import { cancelPipeline, isGitlabConfigured } from '@/app/lib/gitlab';
import { getDb } from '@/app/lib/tm/db';

export const dynamic = 'force-dynamic';

// Gated by run:tests in middleware — anyone who can run can cancel, but only pipelines Testboard started.
export async function POST(req: Request) {
  if (!isGitlabConfigured()) return notConfigured();

  try {
    const { id } = pipelineId.parse(await readBody(req));

    if (!getPipelineRecords(getDb(), [id]).has(id)) return notStartedHere();

    await cancelPipeline(id);

    return Response.json({ ok: true });
  } catch (error) {
    return upstreamError(error);
  }
}
