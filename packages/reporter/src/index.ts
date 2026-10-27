import type { FullConfig, Reporter } from '@playwright/test/reporter';

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

// Drop-in replacement for @cyborgtests/reporter-playwright-reports-server 2.6.1: same options, same
// requests, same failure behaviour (throws from onEnd), so switching between the two is a rename.

export interface TestboardReporterOptions {
  enabled?: boolean;
  url: string;
  reportPath: string;
  token?: string;
  requestTimeout?: number;
  resultDetails?: Record<string, string | undefined>;
  triggerReportGeneration?: boolean;
  blobUploadTimeout?: number;
  logProgress?: boolean;
}

const DEFAULT_OPTIONS = {
  enabled: true,
  resultDetails: {},
  triggerReportGeneration: true,
  requestTimeout: 60_000,
  blobUploadTimeout: 10 * 60_000,
  logProgress: false,
};

const PREFIX = '[TestboardReporter]';

const getUsername = (): string => {
  if (process.env.QA_USERNAME) return process.env.QA_USERNAME;
  try {
    return execSync('git config user.name', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

const makeBoundary = () => `----pwreporter-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;

const fieldPart = (boundary: string, name: string, value: string) =>
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`, 'utf8');

const fileHead = (boundary: string, fileName: string) =>
  Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      'Content-Type: application/zip\r\n\r\n',
    'utf8',
  );

// Streams the multipart body so large blobs never sit in memory.
async function* multipartStream(opts: {
  boundary: string;
  fields: Record<string, string>;
  filePath: string;
  fileName: string;
  totalBytes: number;
  logProgress: boolean;
}): AsyncGenerator<Buffer> {
  const { boundary, fields, filePath, fileName, totalBytes, logProgress } = opts;

  for (const [name, value] of Object.entries(fields)) yield fieldPart(boundary, name, value);
  yield fileHead(boundary, fileName);

  let sent = 0;
  let lastPct = -5;
  let lastTick = Date.now();

  for await (const chunk of fs.createReadStream(filePath, { highWaterMark: 512 * 1024 })) {
    if (logProgress && totalBytes > 0) {
      sent += chunk.length;
      const pct = Math.min(100, Math.floor((sent / totalBytes) * 100));

      if (Date.now() - lastTick >= 500 && pct >= lastPct + 2) {
        console.log(
          `${PREFIX} Upload: ${pct}% (${(sent / 1048576).toFixed(1)}/${(totalBytes / 1048576).toFixed(1)} MB)`,
        );
        lastPct = pct;
        lastTick = Date.now();
      }
    }
    yield chunk as Buffer;
  }
  yield Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
}

export default class TestboardReporter implements Reporter {
  private options: Required<Omit<TestboardReporterOptions, 'token'>> & { token?: string };
  private config?: FullConfig;
  private blobPath = '';
  private blobName = '';

  constructor(options: TestboardReporterOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options } as typeof this.options;
    if (this.options.enabled === false) return;
    if (!this.options.reportPath) throw new Error(`${PREFIX} reportPath is required, cannot run without it`);
    if (!this.options.url) throw new Error(`${PREFIX} url is required, cannot run without it`);
    // resolve, not join (Cyborg joins): identical for relative paths, and an absolute path also works.
    this.blobPath = path.resolve(process.cwd(), this.options.reportPath);
    this.blobName = path.basename(this.blobPath);
  }

  onBegin(config: FullConfig): void {
    this.config = config;
  }

  async onEnd(): Promise<void> {
    if (this.options.enabled === false) return;

    let size: number;

    try {
      size = (await fsp.stat(this.blobPath)).size;
    } catch (error) {
      console.error(error);
      throw new Error(`${PREFIX} Blob file not found or cannot be loaded. Results cannot be uploaded`);
    }

    const details: Record<string, string> = Object.fromEntries(
      Object.entries(this.options.resultDetails).map(([key, value]) => [key, value ?? '']),
    );

    if (!details.username) {
      const username = getUsername();

      if (username) details.username = username;
    }
    const version = this.config?.version ?? '';
    const shard = this.config?.shard;

    if (shard) {
      details.shardCurrent = String(shard.current);
      details.shardTotal = String(shard.total);
    }
    details.playwrightVersion = version;
    details.triggerReportGeneration = String(this.options.triggerReportGeneration ?? false);

    const boundary = makeBoundary();
    const baseUrl = this.options.url.replace(/\/$/, '');
    const headers: Record<string, string> = { 'Content-Type': `multipart/form-data; boundary=${boundary}` };

    if (this.options.token) headers.Authorization = this.options.token;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.blobUploadTimeout ?? this.options.requestTimeout ?? 10 * 60_000,
    );

    try {
      const response = await fetch(`${baseUrl}/api/result/upload?fileContentLength=${size}`, {
        method: 'PUT',
        headers,
        body: multipartStream({
          boundary,
          fields: details,
          filePath: this.blobPath,
          fileName: this.blobName || 'blob.zip',
          totalBytes: size,
          logProgress: !!this.options.logProgress,
        }) as unknown as BodyInit,
        signal: controller.signal,
        duplex: 'half',
      } as RequestInit);

      clearTimeout(timeout);
      if (!response.ok) {
        const text = await response.text().catch(() => '');

        throw new Error(`${PREFIX} Upload failed ${response.status}: ${text.slice(0, 500)}`);
      }

      const result = (
        (await response.json()) as { data: { resultID: string; generatedReport?: { reportUrl?: string } } }
      ).data;

      console.debug(`${PREFIX} blob result uploaded:`, result);
      if (result.generatedReport?.reportUrl) {
        console.log(`${PREFIX} HTML report: ${baseUrl}${result.generatedReport.reportUrl}`);
      }

      // Sharded runs: the server generates the report once every shard of the testRun has arrived.
      if (this.options.triggerReportGeneration && !shard) {
        const generate = await fetch(`${baseUrl}/api/report/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.options.token ? { Authorization: this.options.token } : {}),
          },
          body: JSON.stringify({ resultsIds: [result.resultID], ...details, playwrightVersion: version }),
          signal: controller.signal,
        });

        if (!generate.ok) {
          const text = await generate.text().catch(() => '');

          throw new Error(`${PREFIX} Report generation failed ${generate.status}: ${text.slice(0, 500)}`);
        }
        const report = (await generate.json()) as { reportUrl?: string };

        if (report?.reportUrl) console.log(`${PREFIX} HTML report: ${baseUrl}${report.reportUrl}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}
