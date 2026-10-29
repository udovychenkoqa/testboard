import { deleteCases, listCases, moveCases } from '@/app/lib/tm/cases';
import { TmError } from '@/app/lib/tm/errors';
import { getProject } from '@/app/lib/tm/projects';
import { caseBulk } from '@/app/lib/tm/schemas';
import { readJson, tmRoute } from '@/app/lib/tm/handler';

export const dynamic = 'force-dynamic';

type P = { key: string };

export const POST = tmRoute<P>(async ({ db, params, req }) => {
  const body = caseBulk.parse(await readJson(req));
  const projectId = getProject(db, params.key).id;
  const own = new Set(listCases(db, projectId, {}).map((c) => c.id));

  if (!body.ids.every((id) => own.has(id))) throw new TmError('invalid', 'some cases are not in this project');
  if (body.action === 'delete') deleteCases(db, body.ids);
  else moveCases(db, body.ids, body.suiteId);
});
