type Gitlab = typeof import('@/app/lib/gitlab');

const TOKEN = 'glpat-secret-token';

// env.ts reads process.env once at import, so each test loads a fresh copy of the client.
const load = (overrides: Record<string, string | undefined> = {}): Gitlab => {
  const vars: Record<string, string | undefined> = {
    GITLAB_URL: 'https://gitlab.example.com/',
    GITLAB_TOKEN: TOKEN,
    GITLAB_AUTOTESTS_PROJECT: 'qa/autotests',
    GITLAB_REF: 'main',
    ...overrides,
  };

  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  let mod!: Gitlab;

  jest.isolateModules(() => {
    mod = require('@/app/lib/gitlab');
  });

  return mod;
};

const json = (body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });

const apiPipeline = (over: Record<string, unknown> = {}) => ({
  id: 901,
  iid: 17,
  status: 'running',
  web_url: 'https://gitlab.example.com/qa/autotests/-/pipelines/901',
  created_at: '2026-10-18T10:00:00Z',
  started_at: '2026-10-18T10:00:05Z',
  finished_at: null,
  duration: null,
  user: { username: 'tb-bot', name: 'Testboard bot' },
  ...over,
});

describe('gitlab client', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('is configured only when url, token and project are set', () => {
    expect(load().isGitlabConfigured()).toBe(true);
    expect(load({ GITLAB_TOKEN: undefined }).isGitlabConfigured()).toBe(false);
    expect(load({ GITLAB_URL: undefined }).isGitlabConfigured()).toBe(false);
    expect(load({ GITLAB_AUTOTESTS_PROJECT: undefined }).isGitlabConfigured()).toBe(false);
  });

  it('creates a pipeline on the configured ref with inputs', async () => {
    const gitlab = load();

    fetchMock.mockResolvedValueOnce(json(apiPipeline({ status: 'created' })));

    const pipeline = await gitlab.createPipeline({
      env: 'stage',
      mode: 'by tag',
      tag: '@smoke',
      skip_visual_checks: true,
    });

    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe('https://gitlab.example.com/api/v4/projects/qa%2Fautotests/pipeline');
    expect(init.method).toBe('POST');
    expect(init.headers['PRIVATE-TOKEN']).toBe(TOKEN);
    expect(JSON.parse(init.body)).toEqual({
      ref: 'main',
      inputs: { env: 'stage', mode: 'by tag', tag: '@smoke', skip_visual_checks: true },
    });
    expect(pipeline).toEqual({
      id: 901,
      iid: 17,
      status: 'pending',
      user: 'Testboard bot',
      createdAt: '2026-10-18T10:00:00Z',
      startedAt: '2026-10-18T10:00:05Z',
      finishedAt: undefined,
      duration: undefined,
      link: 'https://gitlab.example.com/qa/autotests/-/pipelines/901',
    });
  });

  it('lists pipelines with details and the X-Total count', async () => {
    const gitlab = load();

    fetchMock
      .mockResolvedValueOnce(json([{ id: 901 }, { id: 900 }], { headers: { 'X-Total': '37' } }))
      .mockResolvedValueOnce(json(apiPipeline()))
      .mockResolvedValueOnce(
        json(apiPipeline({ id: 900, iid: 16, status: 'failed', finished_at: '2026-10-18T10:09:00Z', duration: 535 })),
      );

    const { pipelines, total } = await gitlab.listPipelines(2, 10);

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://gitlab.example.com/api/v4/projects/qa%2Fautotests/pipelines?per_page=10&page=2',
    );
    expect(fetchMock.mock.calls[1][0]).toBe('https://gitlab.example.com/api/v4/projects/qa%2Fautotests/pipelines/901');
    expect(total).toBe(37);
    expect(pipelines.map((p) => [p.id, p.status, p.duration])).toEqual([
      [901, 'running', undefined],
      [900, 'failure', 535],
    ]);
  });

  it('falls back to the page length when X-Total is missing', async () => {
    const gitlab = load();

    fetchMock.mockResolvedValueOnce(json([])).mockResolvedValue(json(apiPipeline()));
    expect((await gitlab.listPipelines(1, 10)).total).toBe(0);
  });

  it('cancels and retries a pipeline', async () => {
    const gitlab = load();

    fetchMock.mockResolvedValueOnce(json(apiPipeline({ status: 'canceled' })));
    await gitlab.cancelPipeline(901);
    fetchMock.mockResolvedValueOnce(json(apiPipeline({ id: 902, status: 'pending' })));
    const retried = await gitlab.retryPipeline(901);

    expect(fetchMock.mock.calls.map(([url, init]) => `${init.method} ${url}`)).toEqual([
      'POST https://gitlab.example.com/api/v4/projects/qa%2Fautotests/pipelines/901/cancel',
      'POST https://gitlab.example.com/api/v4/projects/qa%2Fautotests/pipelines/901/retry',
    ]);
    expect(retried.id).toBe(902);
  });

  it.each([
    ['created', 'pending'],
    ['waiting_for_resource', 'pending'],
    ['preparing', 'pending'],
    ['pending', 'pending'],
    ['scheduled', 'pending'],
    ['manual', 'pending'],
    ['running', 'running'],
    ['success', 'success'],
    ['failed', 'failure'],
    ['canceled', 'killed'],
    ['canceling', 'killed'],
    ['skipped', 'skipped'],
  ])('maps GitLab status %s to %s', (from, to) => {
    expect(load().toRunStatus(from)).toBe(to);
  });

  it('reports HTTP errors without leaking the token', async () => {
    const gitlab = load();

    fetchMock.mockResolvedValueOnce(new Response(`<html>502 Bad Gateway for token ${TOKEN}</html>`, { status: 502 }));

    const error = await gitlab.createPipeline({ env: 'prod' }).catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/^GitLab API 502: /);
    expect((error as Error).message).not.toContain(TOKEN);
  });

  it('reports network errors without leaking the token', async () => {
    const gitlab = load();

    fetchMock.mockRejectedValueOnce(new TypeError(`fetch failed (${TOKEN})`));

    const error = (await gitlab.listPipelines(1, 10).catch((e: Error) => e)) as Error;

    expect(error.message).toContain('fetch failed');
    expect(error.message).not.toContain(TOKEN);
  });
});
