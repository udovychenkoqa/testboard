import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { type AddressInfo } from 'node:net';

import type { FullConfig } from '@playwright/test/reporter';

import TestboardReporter from '@/packages/reporter/src';

interface Seen {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: string;
}

// A stand-in Testboard: records every request and answers like the real server.
const startServer = async (
  opts: { uploadStatus?: number; generateStatus?: number; generatedReport?: unknown } = {},
) => {
  const seen: Seen[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];

    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      seen.push({ method: req.method!, url: req.url!, headers: req.headers, body: Buffer.concat(chunks).toString() });
      res.setHeader('Content-Type', 'application/json');
      if (req.url!.startsWith('/api/result/upload')) {
        res.statusCode = opts.uploadStatus ?? 200;
        res.end(
          res.statusCode === 200
            ? JSON.stringify({ data: { resultID: 'r-1', generatedReport: opts.generatedReport ?? null } })
            : 'boom',
        );
      } else {
        res.statusCode = opts.generateStatus ?? 200;
        res.end(res.statusCode === 200 ? JSON.stringify({ reportUrl: '/api/serve/p/rep-1/index.html' }) : 'nope');
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return { url, seen, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
};

const blob = () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'tb-reporter-'));
  const file = path.join(dir, 'blob.zip');

  writeFileSync(file, 'PK-fake-zip');

  return file;
};

const config = (shard: FullConfig['shard'] = null) => ({ version: '1.64.1', shard }) as unknown as FullConfig;

const field = (body: string, name: string) => {
  const match = body.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)\\r\\n`));

  return match?.[1];
};

describe('TestboardReporter', () => {
  let server: Awaited<ReturnType<typeof startServer>>;

  afterEach(async () => {
    await server?.close();
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('uploads the blob with details, auth and size', async () => {
    server = await startServer();
    const reportPath = blob();
    const reporter = new TestboardReporter({
      url: `${server.url}/`,
      token: 'tok',
      reportPath,
      resultDetails: { env: 'prod', testRun: 'p-42', project: 'hanimax', username: 'ci' },
      triggerReportGeneration: false,
    });

    reporter.onBegin(config());
    await reporter.onEnd();

    expect(server.seen).toHaveLength(1);
    const [upload] = server.seen;

    expect(upload.method).toBe('PUT');
    expect(upload.url).toBe(`/api/result/upload?fileContentLength=${'PK-fake-zip'.length}`);
    expect(upload.headers.authorization).toBe('tok');
    expect(upload.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
    expect(field(upload.body, 'env')).toBe('prod');
    expect(field(upload.body, 'testRun')).toBe('p-42');
    expect(field(upload.body, 'project')).toBe('hanimax');
    expect(field(upload.body, 'playwrightVersion')).toBe('1.64.1');
    expect(field(upload.body, 'triggerReportGeneration')).toBe('false');
    expect(upload.body).toContain('name="file"; filename="blob.zip"');
    expect(upload.body).toContain('PK-fake-zip');
  });

  it('adds shard fields and leaves generation to the server when sharded', async () => {
    server = await startServer({ generatedReport: { reportUrl: '/api/serve/p/rep-9/index.html' } });
    const reporter = new TestboardReporter({ url: server.url, reportPath: blob(), resultDetails: { testRun: 't' } });

    reporter.onBegin(config({ current: 2, total: 2 }));
    await reporter.onEnd();

    expect(server.seen).toHaveLength(1);
    expect(field(server.seen[0].body, 'shardCurrent')).toBe('2');
    expect(field(server.seen[0].body, 'shardTotal')).toBe('2');
    expect(field(server.seen[0].body, 'triggerReportGeneration')).toBe('true');
    expect(server.seen[0].headers.authorization).toBeUndefined();
  });

  it('calls generate once when not sharded', async () => {
    server = await startServer();
    const reporter = new TestboardReporter({
      url: server.url,
      token: 'tok',
      reportPath: blob(),
      resultDetails: { project: 'hanimax', username: 'ci' },
      triggerReportGeneration: true,
    });

    reporter.onBegin(config());
    await reporter.onEnd();

    expect(server.seen.map((s) => `${s.method} ${s.url.split('?')[0]}`)).toEqual([
      'PUT /api/result/upload',
      'POST /api/report/generate',
    ]);
    const generate = server.seen[1];

    expect(generate.headers.authorization).toBe('tok');
    expect(JSON.parse(generate.body)).toEqual({
      resultsIds: ['r-1'],
      project: 'hanimax',
      username: 'ci',
      playwrightVersion: '1.64.1',
      triggerReportGeneration: 'true',
    });
  });

  it('throws when the blob is missing', async () => {
    server = await startServer();
    const reporter = new TestboardReporter({ url: server.url, reportPath: 'does/not/exist.zip' });

    reporter.onBegin(config());
    await expect(reporter.onEnd()).rejects.toThrow('[TestboardReporter]');
    expect(server.seen).toHaveLength(0);
  });

  it('throws when the upload fails', async () => {
    server = await startServer({ uploadStatus: 500 });
    const reporter = new TestboardReporter({ url: server.url, reportPath: blob() });

    reporter.onBegin(config());
    await expect(reporter.onEnd()).rejects.toThrow(/\[TestboardReporter\] Upload failed 500: boom/);
  });

  it('throws when report generation fails', async () => {
    server = await startServer({ generateStatus: 500 });
    const reporter = new TestboardReporter({ url: server.url, reportPath: blob(), resultDetails: { username: 'ci' } });

    reporter.onBegin(config());
    await expect(reporter.onEnd()).rejects.toThrow(/\[TestboardReporter\] Report generation failed 500: nope/);
  });

  it('does nothing when disabled', async () => {
    server = await startServer();
    const reporter = new TestboardReporter({ enabled: false, url: '', reportPath: '' });

    reporter.onBegin(config());
    await reporter.onEnd();
    expect(server.seen).toHaveLength(0);
  });

  it('requires url and reportPath when enabled', () => {
    expect(() => new TestboardReporter({ url: '', reportPath: 'x.zip' })).toThrow('url is required');
    expect(() => new TestboardReporter({ url: 'http://x', reportPath: '' })).toThrow('reportPath is required');
  });
});
