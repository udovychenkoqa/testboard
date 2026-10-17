import { env } from '@/app/config/env';

// Thin server-side client for the GitLab REST API (v4), scoped to the autotests project. The token never
// leaves the server — the UI talks to our /api/autotests/* routes, which call this.

export type RunStatus = 'pending' | 'running' | 'success' | 'failure' | 'killed' | 'skipped';

export interface Pipeline {
  id: number;
  iid: number;
  status: RunStatus;
  user?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  duration?: number;
  link: string;
}

export type PipelineInputs = Record<string, string | boolean>;

interface ApiPipeline {
  id: number;
  iid: number;
  status: string;
  web_url: string;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration?: number | null;
  user?: { name?: string; username?: string } | null;
}

const STATUS: Record<string, RunStatus> = {
  created: 'pending',
  waiting_for_resource: 'pending',
  preparing: 'pending',
  pending: 'pending',
  scheduled: 'pending',
  manual: 'pending',
  running: 'running',
  success: 'success',
  failed: 'failure',
  canceled: 'killed',
  canceling: 'killed',
  skipped: 'skipped',
};

export const toRunStatus = (status: string): RunStatus => STATUS[status] ?? 'pending';

export const isGitlabConfigured = (): boolean =>
  !!env.GITLAB_URL && !!env.GITLAB_TOKEN && !!env.GITLAB_AUTOTESTS_PROJECT;

// Error text may echo request details back; make sure the token can't ride along into logs or responses.
const redact = (text: string): string => (env.GITLAB_TOKEN ? text.split(env.GITLAB_TOKEN).join('***') : text);

const projectUrl = (path: string): string =>
  `${env.GITLAB_URL!.replace(/\/+$/, '')}/api/v4/projects/${encodeURIComponent(env.GITLAB_AUTOTESTS_PROJECT!)}${path}`;

const gitlabFetch = async (path: string, init?: { method?: string; body?: unknown }): Promise<Response> => {
  let response: Response;

  try {
    response = await fetch(projectUrl(path), {
      method: init?.method ?? 'GET',
      headers: {
        'PRIVATE-TOKEN': env.GITLAB_TOKEN!,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
  } catch (error) {
    // Keep the original wording ("fetch failed", ENOTFOUND…) so the UI recognises an unreachable host.
    throw new Error(redact(error instanceof Error ? error.message : String(error)));
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');

    throw new Error(`GitLab API ${response.status}: ${redact(body.slice(0, 300))}`);
  }

  return response;
};

const toPipeline = (p: ApiPipeline): Pipeline => ({
  id: p.id,
  iid: p.iid,
  status: toRunStatus(p.status),
  user: p.user?.name || p.user?.username || undefined,
  createdAt: p.created_at,
  startedAt: p.started_at ?? undefined,
  finishedAt: p.finished_at ?? undefined,
  duration: p.duration ?? undefined,
  link: p.web_url,
});

export const createPipeline = async (inputs: PipelineInputs): Promise<Pipeline> => {
  const response = await gitlabFetch('/pipeline', { method: 'POST', body: { ref: env.GITLAB_REF, inputs } });

  return toPipeline(await response.json());
};

export const getPipeline = async (id: number): Promise<Pipeline> =>
  toPipeline(await (await gitlabFetch(`/pipelines/${id}`)).json());

// The list endpoint lacks user, start/finish times and duration, so each row is fetched in full.
export const listPipelines = async (
  page: number,
  perPage: number,
): Promise<{ pipelines: Pipeline[]; total: number }> => {
  const response = await gitlabFetch(`/pipelines?per_page=${perPage}&page=${page}`);
  const rows = (await response.json()) as { id: number }[];
  const pipelines = await Promise.all(rows.map((row) => getPipeline(row.id)));
  const total = Number(response.headers.get('X-Total'));

  return { pipelines, total: Number.isFinite(total) && total > 0 ? total : (page - 1) * perPage + rows.length };
};

export const cancelPipeline = async (id: number): Promise<void> => {
  await gitlabFetch(`/pipelines/${id}/cancel`, { method: 'POST' });
};

export const retryPipeline = async (id: number): Promise<Pipeline> =>
  toPipeline(await (await gitlabFetch(`/pipelines/${id}/retry`, { method: 'POST' })).json());
