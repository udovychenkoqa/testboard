import { getProject } from '@/app/lib/tm/projects';
import { createSuite, listSuites } from '@/app/lib/tm/suites';
import { suiteCreate } from '@/app/lib/tm/schemas';
import { readJson, tmRoute } from '@/app/lib/tm/handler';

export const dynamic = 'force-dynamic';

type P = { key: string };

export const GET = tmRoute<P>(({ db, params }) => listSuites(db, getProject(db, params.key).id));

export const POST = tmRoute<P>(async ({ db, params, req }) => {
  const input = suiteCreate.parse(await readJson(req));

  return createSuite(db, { projectId: getProject(db, params.key).id, ...input });
});
