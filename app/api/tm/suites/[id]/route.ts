import { deleteSuite, updateSuite } from '@/app/lib/tm/suites';
import { idParam, suiteUpdate } from '@/app/lib/tm/schemas';
import { readJson, tmRoute } from '@/app/lib/tm/handler';

export const dynamic = 'force-dynamic';

type P = { id: string };

export const PATCH = tmRoute<P>(async ({ db, params, req }) =>
  updateSuite(db, idParam.parse(params.id), suiteUpdate.parse(await readJson(req))),
);

export const DELETE = tmRoute<P>(({ db, params }) => {
  deleteSuite(db, idParam.parse(params.id));
});
