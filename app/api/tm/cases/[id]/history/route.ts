import { listCaseHistory } from '@/app/lib/tm/caseHistory';
import { getCase } from '@/app/lib/tm/cases';
import { idParam } from '@/app/lib/tm/schemas';
import { tmRoute } from '@/app/lib/tm/handler';

export const dynamic = 'force-dynamic';

type P = { id: string };

export const GET = tmRoute<P>(({ db, params }) => {
  const id = idParam.parse(params.id);

  // 404 for a case that doesn't exist, instead of an empty history.
  getCase(db, id);

  return listCaseHistory(db, id);
});
