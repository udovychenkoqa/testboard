import { completeRun, getRun } from '@/app/lib/tm/runs';
import { idParam, runUpdate } from '@/app/lib/tm/schemas';
import { readJson, tmRoute } from '@/app/lib/tm/handler';

export const dynamic = 'force-dynamic';

type P = { id: string };

export const GET = tmRoute<P>(({ db, params }) => getRun(db, idParam.parse(params.id)));

export const PATCH = tmRoute<P>(async ({ db, params, req }) => {
  runUpdate.parse(await readJson(req));

  return completeRun(db, idParam.parse(params.id));
});
