import { deleteProject, getProject, updateProject } from '@/app/lib/tm/projects';
import { projectUpdate } from '@/app/lib/tm/schemas';
import { readJson, tmRoute } from '@/app/lib/tm/handler';

export const dynamic = 'force-dynamic';

type P = { key: string };

export const GET = tmRoute<P>(({ db, params }) => getProject(db, params.key));

export const PATCH = tmRoute<P>(async ({ db, params, req }) =>
  updateProject(db, params.key, projectUpdate.parse(await readJson(req))),
);

export const DELETE = tmRoute<P>(({ db, params }) => {
  deleteProject(db, params.key);
});
