import { listActiveRuns } from '@/app/lib/tm/runs';
import { tmRoute } from '@/app/lib/tm/handler';

export const dynamic = 'force-dynamic';

// In-progress runs of every project, for the "Testboard run" choice when starting autotests.
export const GET = tmRoute(({ db }) => listActiveRuns(db));
