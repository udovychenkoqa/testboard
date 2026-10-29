import { getProject } from '@/app/lib/tm/projects';
import { createRun, listRuns } from '@/app/lib/tm/runs';
import { runCreate } from '@/app/lib/tm/schemas';
import { readJson, tmRoute } from '@/app/lib/tm/handler';

export const dynamic = 'force-dynamic';

type P = { key: string };

export const GET = tmRoute<P>(({ db, params }) => listRuns(db, getProject(db, params.key).id));

export const POST = tmRoute<P>(async ({ db, params, req, by }) => {
  const body = runCreate.parse(await readJson(req));

  return createRun(db, { projectId: getProject(db, params.key).id, ...body, by });
});
