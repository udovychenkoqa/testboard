import { createProject, listProjects } from '@/app/lib/tm/projects';
import { projectCreate } from '@/app/lib/tm/schemas';
import { readJson, tmRoute } from '@/app/lib/tm/handler';

export const dynamic = 'force-dynamic';

export const GET = tmRoute(({ db }) => listProjects(db));

export const POST = tmRoute(async ({ db, req }) => createProject(db, projectCreate.parse(await readJson(req))));
