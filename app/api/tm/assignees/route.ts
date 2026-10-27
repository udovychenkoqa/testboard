import { listAssignees } from '@/app/lib/tm/assignees';
import { tmRoute } from '@/app/lib/tm/handler';

export const dynamic = 'force-dynamic';

export const GET = tmRoute(() => listAssignees());
