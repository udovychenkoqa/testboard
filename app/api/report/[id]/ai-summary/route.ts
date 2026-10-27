import { type NextRequest } from 'next/server';

import { withError } from '@/app/lib/withError';
import { service } from '@/app/lib/service';
import { generateReportAiSummary } from '@/app/lib/ai/reportSummary';

export const dynamic = 'force-dynamic';

/**
 * Manual "Regenerate" trigger for the UI (app/components/report-details/ai-summary.tsx).
 * Unlike the fire-and-forget call in service.generateReport(), this one is
 * awaited and its result returned directly — a button click deserves a real
 * answer (generated / why not / what failed), not a silent no-op.
 */
export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: {
      id: string;
    };
  },
) {
  const { id } = params;

  if (!id) {
    return new Response('report ID is required', { status: 400 });
  }

  const { result: report, error: reportError } = await withError(service.getReport(id));

  if (reportError || !report) {
    return new Response(`failed to get report: ${reportError?.message ?? 'unknown error'}`, { status: 404 });
  }

  const projectPath = report.project ? `${encodeURI(report.project)}/` : '';

  const { result, error } = await withError(generateReportAiSummary(id, projectPath, report));

  if (error) {
    return Response.json({ status: 'failed', reason: error.message }, { status: 500 });
  }

  return Response.json(result);
}
