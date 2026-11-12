import { importCases, parseCasesCsv } from '@/app/lib/tm/caseImport';
import { TmError } from '@/app/lib/tm/errors';
import { tmRoute } from '@/app/lib/tm/handler';
import { getProject } from '@/app/lib/tm/projects';

export const dynamic = 'force-dynamic';

type P = { key: string };

// A few thousand cases with steps fit well within this; anything bigger is not a test-case export.
const MAX_BYTES = 5 * 1024 * 1024;

// The body is the CSV itself. ?dryRun=1 only counts what the import would do (the preview before confirming).
export const POST = tmRoute<P>(async ({ db, params, req, by }) => {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BYTES) {
    throw new TmError('invalid', 'the file must be 5 MB or smaller');
  }
  const text = await req.text();

  if (Buffer.byteLength(text) > MAX_BYTES) throw new TmError('invalid', 'the file must be 5 MB or smaller');

  const { cases, problems } = parseCasesCsv(text);
  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1';

  if (!cases.length) return { summary: { suitesCreated: 0, casesCreated: 0, casesSkipped: 0 }, problems, dryRun };

  return { summary: importCases(db, getProject(db, params.key).id, cases, by, { dryRun }), problems, dryRun };
});
