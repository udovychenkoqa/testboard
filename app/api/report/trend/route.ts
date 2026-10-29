import { type NextRequest } from 'next/server';

import { service } from '@/app/lib/service';

export const dynamic = 'force-dynamic'; // defaults to auto

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const project = searchParams.get('project') ?? '';
  // Analytics needs the current window plus the previous one for deltas —
  // the caller asks for 2×N; cap keeps a stray query from dragging in everything.
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 20));
  const { reports: latestReports } = await service.getReports({ project, pagination: { offset: 0, limit } });

  return Response.json(latestReports);
}
