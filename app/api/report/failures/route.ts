import { type NextRequest } from 'next/server';

import { service } from '@/app/lib/service';
import { env } from '@/app/config/env';
import { getOrBuildReportFailures, type FailureCategory, type FailureRecord } from '@/app/lib/analytics/failures';

export const dynamic = 'force-dynamic';

const CONCURRENCY = 4;

interface TopFailure {
  title: string;
  location: string;
  count: number;
  lastReportId: string;
  category: FailureCategory;
}

export async function GET(request: NextRequest) {
  if (env.DATA_STORAGE !== 'fs') {
    return Response.json({ enabled: false, categories: {}, topFailures: [] });
  }

  const { searchParams } = new URL(request.url);
  const project = searchParams.get('project') ?? '';
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 30));

  const { reports } = await service.getReports({ project, pagination: { offset: 0, limit } });

  // Newest-first; build per-report digests with a small concurrency cap —
  // uncached reports require loading their zips.
  const perReport: Array<{ reportId: string; failures: FailureRecord[] }> = [];

  for (let i = 0; i < reports.length; i += CONCURRENCY) {
    const chunk = reports.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (report) => {
        const projectPath = report.project ? `${encodeURI(report.project)}/` : '';
        const failures = await getOrBuildReportFailures(report.reportID, projectPath, report);

        return { reportId: report.reportID, failures };
      }),
    );

    perReport.push(...results);
  }

  const categories: Partial<Record<FailureCategory, number>> = {};
  const byTest = new Map<string, TopFailure>();

  for (const { reportId, failures } of perReport) {
    for (const f of failures) {
      categories[f.category] = (categories[f.category] ?? 0) + 1;

      const key = `${f.location}::${f.title}`;
      const existing = byTest.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        // reports are newest-first, so the first sighting is the latest report
        byTest.set(key, { title: f.title, location: f.location, count: 1, lastReportId: reportId, category: f.category });
      }
    }
  }

  const topFailures = [...byTest.values()].sort((a, b) => b.count - a.count).slice(0, 10);

  return Response.json({
    enabled: true,
    analyzedReports: reports.length,
    categories,
    topFailures,
  });
}
