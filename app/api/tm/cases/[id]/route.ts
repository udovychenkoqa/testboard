import { deleteCases, getCase, updateCase } from '@/app/lib/tm/cases';
import { caseUpdate, idParam } from '@/app/lib/tm/schemas';
import { readJson, tmRoute } from '@/app/lib/tm/handler';

export const dynamic = 'force-dynamic';

type P = { id: string };

export const GET = tmRoute<P>(({ db, params }) => getCase(db, idParam.parse(params.id)));

export const PATCH = tmRoute<P>(async ({ db, params, req, by }) =>
  updateCase(db, idParam.parse(params.id), caseUpdate.parse(await readJson(req)), by),
);

export const DELETE = tmRoute<P>(({ db, params }) => {
  const id = idParam.parse(params.id);

  getCase(db, id);
  deleteCases(db, [id]);
});
