import { listTags } from '@/app/lib/tm/cases';
import { getProject } from '@/app/lib/tm/projects';
import { tmRoute } from '@/app/lib/tm/handler';

export const dynamic = 'force-dynamic';

export const GET = tmRoute<{ key: string }>(({ db, params }) => listTags(db, getProject(db, params.key).id));
