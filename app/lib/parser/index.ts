import JSZip from 'jszip';

import { type ReportInfo, type ReportTest, ReportTestOutcome } from './types';
import { findTraceAttachment } from './trace-evidence';

import { withError } from '@/app/lib/withError';

export * from './types';
export * from './trace-evidence';

const base64Prefix = 'data:application/zip;base64,';

/**
 * Decodes the base64-encoded zip embedded in a Playwright HTML report and
 * returns the loaded archive. Exported so callers (reportSummary.ts) can load
 * it once and reuse the same instance for both `getFailureDetails()` and
 * per-cluster trace extraction, instead of re-decoding a potentially large
 * base64 report twice.
 */
export const loadReportZip = async (html: string): Promise<JSZip> => {
  const pattern = new RegExp(`${base64Prefix}([^";\\s]+)(?=[";\\s]|$)`);
  const matches = RegExp(pattern).exec(html);
  const match = matches?.at(0) ?? '';
  const base64String = match.replace(base64Prefix, '').replace('</script>', '').trim();

  if (!base64String) {
    throw Error('[report parser] no data found in the html report');
  }

  const zipData = Buffer.from(base64String, 'base64');

  const { result: zip, error } = await withError(JSZip.loadAsync(zipData));

  if (error) {
    throw Error(`[report parser] failed to load zip file: ${error.message}`);
  }

  if (!zip) {
    throw Error('[report parser] parsed report data is empty');
  }

  return zip;
};

/**
 *
 * @param html HTML string of the Playwright report
 * @description Parses the HTML report to extract the base64 encoded report data, decodes it
 * There are two possible formats (at the moment):
 * @example <script>window.playwrightReportBase64 = "...";</script>
 * @example <script id="playwrightReportBase64" type="application/zip">"..."</script>
 * @returns
 */

export const parse = async (html: string): Promise<ReportInfo> => {
  const zip = await loadReportZip(html);

  const reportFile = zip.file('report.json');

  if (!reportFile) {
    throw Error('[report parser] no report.json file found in the zip');
  }

  const reportJson = await reportFile.async('string');

  return JSON.parse(reportJson);
};

export const parseHtmlReport = async (html: string) => {
  try {
    return await parse(html);
  } catch (e: unknown) {
    if (e instanceof Error) {
      console.error(e.message);
    }

    return null;
  }
};

export interface TestFailure {
  testId: string;
  title: string;
  projectName: string;
  location: string;
  errors: string[];
  screenshot?: { mediaType: string; base64: string };
  traceAttachmentPath?: string;
  // Text attachments the test itself produced (e.g. a `testInfo.attach`ed log
  // analysis or Playwright's `error-context`) — often the real diagnostic
  // signal for data/backend-driven tests that never touch the UI.
  textAttachments?: { name: string; content: string }[];
}

// Cap each text attachment fed to the LLM — the "AI Log Sentinel" report and
// error-context are a few KB, but guard against a pathological multi-MB dump
// blowing the prompt budget. Middle is dropped so head + tail both survive.
const TEXT_ATTACHMENT_MAX_CHARS = 6000;

// Attachment names that are metadata/telemetry, not failure evidence — e.g.
// `ai-stats` (token/cost accounting emitted by the tests' own AI tooling).
// Matched case-insensitively as a substring so `ai-stats`, `ai-stats-2`, etc.
// are all skipped. Keep this tight: only genuinely non-diagnostic names.
const NOISE_ATTACHMENT_NAMES = ['ai-stats'];

const isNoiseAttachment = (name: string): boolean => {
  const lower = name.toLowerCase();

  return NOISE_ATTACHMENT_NAMES.some((noise) => lower.includes(noise));
};

// Text-ish attachments worth feeding to the model as evidence. Images/video go
// through the screenshot path; the trace zip is handled separately.
const isTextAttachment = (contentType?: string): boolean =>
  !!contentType && (contentType.startsWith('text/') || contentType === 'application/json');

const clampText = (text: string): string =>
  text.length <= TEXT_ATTACHMENT_MAX_CHARS
    ? text
    : `${text.slice(0, TEXT_ATTACHMENT_MAX_CHARS / 2)}\n…[truncated]…\n${text.slice(-TEXT_ATTACHMENT_MAX_CHARS / 2)}`;

/**
 * `report.json` (the overview `parse()` reads) only carries `attachments` per
 * result — no error text. Playwright's HTML report defers the full per-test
 * detail (errors, steps) to a companion `{fileId}.json` inside the same zip,
 * lazy-loaded by the browser when a file is expanded. We read those directly
 * to feed real failure messages into the AI report summary.
 *
 * Takes an already-loaded zip (see `loadReportZip`) rather than raw HTML, so
 * the caller can reuse the same instance for trace extraction afterwards.
 * Only fetches the per-file JSON for files that actually have a failing/flaky
 * test — clean runs cost nothing extra.
 */
export const getFailureDetails = async (zip: JSZip, report: ReportInfo): Promise<TestFailure[]> => {
  const failing = report.files.flatMap((file) =>
    file.tests
      .filter((test) => test.outcome === ReportTestOutcome.Unexpected || test.outcome === ReportTestOutcome.Flaky)
      .map((test) => ({ file, test })),
  );

  if (failing.length === 0) {
    return [];
  }

  const neededFileIds = new Set(failing.map(({ file }) => file.fileId));
  const perFileTests = new Map<string, ReportTest[]>();

  for (const fileId of neededFileIds) {
    const entry = zip.file(`${fileId}.json`);

    if (!entry) {
      continue;
    }

    const { result: parsed, error } = await withError(entry.async('string').then((s) => JSON.parse(s)));

    if (error) {
      console.error(`[report parser] failed to parse ${fileId}.json: ${error.message}`);
      continue;
    }

    perFileTests.set(fileId, parsed?.tests ?? []);
  }

  const results: TestFailure[] = [];

  for (const { file, test } of failing) {
    const fullTest = perFileTests.get(file.fileId)?.find((t) => t.testId === test.testId);

    const errors = (fullTest?.results ?? [])
      .flatMap((result) => result.errors ?? [])
      .map((error) => error.message)
      .filter((message): message is string => !!message);

    // Last image attachment across this test's results — most likely the
    // failure-moment screenshot (Playwright's auto screenshot-on-failure, or
    // the last of a walk-test's manual per-slide captures). Some failures
    // (locator waits stuck on the wrong UI state) have no useful error text
    // at all — the screenshot is the only real diagnostic signal for those.
    const imageAttachment = test.results
      .flatMap((result) => result.attachments)
      .filter((attachment) => attachment.contentType?.startsWith('image/'))
      .pop();

    let screenshot: TestFailure['screenshot'];

    if (imageAttachment) {
      const entry = zip.file(imageAttachment.path);

      if (entry) {
        const buffer = await entry.async('nodebuffer');

        screenshot = { mediaType: imageAttachment.contentType, base64: buffer.toString('base64') };
      }
    }

    // Text attachments (log analysis, error-context, JSON dumps) the test
    // attached — deduped by name (keep the last, matching the screenshot
    // convention) and read from the zip. These carry the real diagnosis for
    // data/backend tests whose own error text is a generic assertion.
    const textAttachmentMeta = new Map<string, ReportTest['results'][number]['attachments'][number]>();

    for (const attachment of test.results.flatMap((result) => result.attachments)) {
      if (isTextAttachment(attachment.contentType) && attachment.path && !isNoiseAttachment(attachment.name)) {
        textAttachmentMeta.set(attachment.name, attachment);
      }
    }

    const textAttachments: TestFailure['textAttachments'] = [];

    for (const attachment of textAttachmentMeta.values()) {
      const entry = zip.file(attachment.path);

      if (!entry) continue;
      const { result: content } = await withError(entry.async('string'));

      if (content?.trim()) {
        textAttachments.push({ name: attachment.name, content: clampText(content.trim()) });
      }
    }

    results.push({
      testId: test.testId,
      title: test.title,
      projectName: test.projectName,
      location: `${test.location.file}:${test.location.line}:${test.location.column}`,
      errors: errors.length > 0 ? errors : ['(no error message captured)'],
      screenshot,
      traceAttachmentPath: findTraceAttachment(test)?.path,
      textAttachments: textAttachments.length > 0 ? textAttachments : undefined,
    });
  }

  return results;
};
