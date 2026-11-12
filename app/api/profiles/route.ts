import { listProfiles } from '@/app/lib/profiles';
import { tmRoute } from '@/app/lib/tm/handler';

export const dynamic = 'force-dynamic';

// The directory: who is who, so the UI can show names and photos where it only has an email.
// Any signed-in user may read it (middleware), including sessions that have no profile of their own.
export const GET = tmRoute(({ db }) => listProfiles(db));
