import { auth } from '@/app/auth';
import { readBody, notConfigured, notStartedHere, upstreamError } from '@/app/lib/autotests/http';
import { getPipelineRecords, recordPipeline } from '@/app/lib/autotests/pipelines';
import { pipelineId } from '@/app/lib/autotests/schema';
import { createPipeline, isGitlabConfigured } from '@/app/lib/gitlab';
import { getDb } from '@/app/lib/tm/db';

export const dynamic = 'force-dynamic';

// A pipeline Testboard started is re-run as a new pipeline with the same inputs. One started elsewhere is
// refused: GITLAB_TOKEN must not become a way to retry any pipeline in the project.
export async function POST(req: Request) {
  if (!isGitlabConfigured()) return notConfigured();

  try {
    const { id } = pipelineId.parse(await readBody(req));
    const db = getDb();
    const record = getPipelineRecords(db, [id]).get(id);

    if (!record) return notStartedHere();

    const session = await auth();
    const build = await createPipeline(record.inputs);

    recordPipeline(db, {
      pipelineId: build.id,
      startedBy: session?.user?.name || session?.user?.email || null,
      inputs: record.inputs,
    });

    return Response.json({ build, link: build.link });
  } catch (error) {
    return upstreamError(error);
  }
}
