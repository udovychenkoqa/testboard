import { openDb, type TmDb } from '@/app/lib/tm/db';
import { getPipelineRecords, recordPipeline } from '@/app/lib/autotests/pipelines';

let db: TmDb;

jest.mock('@/app/lib/gitlab', () => ({
  isGitlabConfigured: jest.fn(),
  createPipeline: jest.fn(),
  cancelPipeline: jest.fn(),
  listPipelines: jest.fn(),
}));
jest.mock('@/app/lib/tm/db', () => ({ ...jest.requireActual('@/app/lib/tm/db'), getDb: () => db }));
jest.mock('@/app/auth', () => ({ auth: async () => ({ user: { email: 'qa@hanimax.com' } }) }));

import { POST as trigger } from '@/app/api/autotests/trigger/route';
import { POST as rerun } from '@/app/api/autotests/rerun/route';
import { POST as cancel } from '@/app/api/autotests/cancel/route';
import { GET as builds } from '@/app/api/autotests/builds/route';

const gitlab = jest.requireMock('@/app/lib/gitlab') as Record<
  'isGitlabConfigured' | 'createPipeline' | 'cancelPipeline' | 'listPipelines',
  jest.Mock
>;

const post = (body: unknown) =>
  new Request('http://tb/api', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

const pipeline = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  iid: id - 800,
  status: 'pending',
  createdAt: '2026-10-18T10:00:00Z',
  link: `https://gitlab/p/${id}`,
  user: 'Testboard bot',
  ...over,
});

describe('/api/autotests routes', () => {
  beforeEach(() => {
    db = openDb(':memory:');
    Object.values(gitlab).forEach((fn) => fn.mockReset());
    gitlab.isGitlabConfigured.mockReturnValue(true);
  });

  afterEach(() => db.close());

  it('reports "not configured" without GitLab settings', async () => {
    gitlab.isGitlabConfigured.mockReturnValue(false);

    expect((await trigger(post({}))).status).toBe(503);
    expect((await cancel(post({ id: 1 }))).status).toBe(503);
    expect((await rerun(post({ id: 1 }))).status).toBe(503);
    const list = await builds({ nextUrl: new URL('http://tb/api/autotests/builds') } as never);

    expect(await list.json()).toEqual({ enabled: false, builds: [] });
  });

  it('triggers with defaults filled and remembers who started it', async () => {
    gitlab.createPipeline.mockResolvedValue(pipeline(901));

    const res = await trigger(post({ env: 'stage', tag: '@api' }));

    expect(res.status).toBe(200);
    expect(gitlab.createPipeline).toHaveBeenCalledWith({
      env: 'stage',
      mode: 'by tag',
      tag: '@api',
      qase_run_id: '',
      qase_id: '',
      force_snapshots_recollection: false,
      skip_visual_checks: true,
    });
    expect(getPipelineRecords(db, [901]).get(901)?.startedBy).toBe('qa@hanimax.com');
  });

  it('rejects invalid inputs with 400 before calling GitLab', async () => {
    const res = await trigger(post({ env: 'test' }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/^env:/);
    expect(gitlab.createPipeline).not.toHaveBeenCalled();
  });

  it('turns GitLab failures into 502 with the message', async () => {
    gitlab.createPipeline.mockRejectedValue(new Error('fetch failed'));

    const res = await trigger(post({}));

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'fetch failed' });
  });

  it('reruns a Testboard pipeline as a new one with the same inputs', async () => {
    const inputs = { env: 'dev', mode: 'smoke', tag: '@smoke', skip_visual_checks: false };

    recordPipeline(db, { pipelineId: 901, startedBy: 'someone', inputs });
    gitlab.createPipeline.mockResolvedValue(pipeline(905));

    const res = await rerun(post({ id: 901 }));

    expect(res.status).toBe(200);
    expect(gitlab.createPipeline).toHaveBeenCalledWith(inputs);
    expect(getPipelineRecords(db, [905]).get(905)).toEqual({ startedBy: 'qa@hanimax.com', inputs });
  });

  it('refuses to rerun a pipeline Testboard did not start', async () => {
    const res = await rerun(post({ id: 700 }));

    expect(res.status).toBe(403);
    expect(gitlab.createPipeline).not.toHaveBeenCalled();
  });

  it('lists pipelines with the Testboard user and inputs when known', async () => {
    recordPipeline(db, { pipelineId: 901, startedBy: 'qa@hanimax.com', inputs: { env: 'prod' } });
    gitlab.listPipelines.mockResolvedValue({ pipelines: [pipeline(901), pipeline(700, { user: 'Dev' })], total: 2 });

    const body = await (await builds({ nextUrl: new URL('http://tb/api/autotests/builds?page=1') } as never)).json();

    expect(body.total).toBe(2);
    expect(
      body.builds.map((b: { id: number; startedBy: string; viaCi: boolean; inputs?: unknown }) => [
        b.id,
        b.startedBy,
        b.viaCi,
        b.inputs,
      ]),
    ).toEqual([
      [901, 'qa@hanimax.com', false, { env: 'prod' }],
      [700, 'Dev', true, undefined],
    ]);
  });

  it('cancels only pipelines Testboard started', async () => {
    expect((await cancel(post({ id: 901 }))).status).toBe(403);
    expect(gitlab.cancelPipeline).not.toHaveBeenCalled();

    recordPipeline(db, { pipelineId: 901, startedBy: 'someone', inputs: {} as never });
    expect((await cancel(post({ id: 901 }))).status).toBe(200);
    expect(gitlab.cancelPipeline).toHaveBeenCalledWith(901);
    expect((await cancel(post({ id: 'x' }))).status).toBe(400);
  });
});
