import { readBody, notConfigured, upstreamError } from '@/app/lib/autotests/http';
import { pipelineId } from '@/app/lib/autotests/schema';
import { cancelPipeline, isGitlabConfigured } from '@/app/lib/gitlab';

export const dynamic = 'force-dynamic';

// Gated by run:tests in middleware — anyone who can run can cancel.
export async function POST(req: Request) {
  if (!isGitlabConfigured()) return notConfigured();

  try {
    const { id } = pipelineId.parse(await readBody(req));

    await cancelPipeline(id);

    return Response.json({ ok: true });
  } catch (error) {
    return upstreamError(error);
  }
}
