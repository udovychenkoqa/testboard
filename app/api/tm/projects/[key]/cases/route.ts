import { createCase, listCases } from '@/app/lib/tm/cases';
import { getProject } from '@/app/lib/tm/projects';
import { caseCreate, caseFilter } from '@/app/lib/tm/schemas';
import { readJson, tmRoute } from '@/app/lib/tm/handler';

export const dynamic = 'force-dynamic';

type P = { key: string };

export const GET = tmRoute<P>(({ db, params, req }) => {
  const query = Object.fromEntries(new URL(req.url).searchParams);
  const filter = caseFilter.parse(Object.fromEntries(Object.entries(query).filter(([, v]) => v !== '')));

  return listCases(db, getProject(db, params.key).id, filter);
});

export const POST = tmRoute<P>(async ({ db, params, req, by }) =>
  createCase(db, getProject(db, params.key).id, caseCreate.parse(await readJson(req)), by),
);
