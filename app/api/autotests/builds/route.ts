import { type NextRequest } from 'next/server';

import { getPipelineRecords } from '@/app/lib/autotests/pipelines';
import { isGitlabConfigured, listPipelines } from '@/app/lib/gitlab';
import { getDb } from '@/app/lib/tm/db';

export const dynamic = 'force-dynamic';

const PER_PAGE = 10;

export async function GET(req: NextRequest) {
  if (!isGitlabConfigured()) return Response.json({ enabled: false, builds: [] });

  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);

  try {
    const { pipelines, total } = await listPipelines(page, PER_PAGE);
    const records = getPipelineRecords(
      getDb(),
      pipelines.map((p) => p.id),
    );

    return Response.json({
      enabled: true,
      page,
      perPage: PER_PAGE,
      total,
      builds: pipelines.map((pipeline) => {
        const record = records.get(pipeline.id);

        return {
          ...pipeline,
          // The Testboard user who pressed Run; GitLab's user is the token owner (or whoever started it there).
          startedBy: record?.startedBy ?? pipeline.user,
          // Started outside Testboard (schedule, push, GitLab UI) — badged "CI" in the list.
          viaCi: !record,
          inputs: record?.inputs,
        };
      }),
    });
  } catch (error) {
    return Response.json({
      enabled: true,
      builds: [],
      error: error instanceof Error ? error.message : 'failed to list pipelines',
    });
  }
}
