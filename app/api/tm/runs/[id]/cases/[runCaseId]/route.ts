import { TmError } from '@/app/lib/tm/errors';
import { getRun, updateRunCase } from '@/app/lib/tm/runs';
import { idParam, runCaseUpdate } from '@/app/lib/tm/schemas';
import { readJson, tmRoute } from '@/app/lib/tm/handler';

export const dynamic = 'force-dynamic';

type P = { id: string; runCaseId: string };

export const PATCH = tmRoute<P>(async ({ db, params, req, by }) => {
  const runCaseId = idParam.parse(params.runCaseId);

  if (!getRun(db, idParam.parse(params.id)).cases.some((c) => c.id === runCaseId)) {
    throw new TmError('not_found', `case ${runCaseId} is not in this run`);
  }

  return updateRunCase(db, runCaseId, runCaseUpdate.parse(await readJson(req)), by);
});
