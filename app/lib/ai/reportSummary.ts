import type JSZip from 'jszip';

import fs from 'node:fs/promises';

import { resolveInside } from '../safePath';
import { REPORTS_FOLDER } from '../storage/constants';
import {
  getFailureDetails,
  loadReportZip,
  extractTraceEvidence,
  type ReportInfo,
  type TestFailure,
  type TraceEvidence,
} from '../parser';
import { storage } from '../storage';
import { withError } from '../withError';

import { circuitFor } from './circuitBreaker';
import { clusterFailures, type FailureCluster } from './clustering';
import { fitClustersToBudget, MAX_CLUSTERS_FOR_DEEP_ANALYSIS, truncateMiddle } from './promptBudget';

import { env } from '@/app/config/env';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const REPORT_SUMMARY_MAX_TOKENS = 1500;
const DEEP_ANALYSIS_MAX_TOKENS = 400;
const AI_SUMMARY_FILENAME = 'ai-summary.md';
const REQUEST_TIMEOUT_MS = 30_000;
// Retry only transient failures (network blips, 429, 5xx) — retrying a bad
// API key or malformed request just burns time for the same guaranteed failure.
const RETRY_DELAYS_MS = [1_000, 3_000, 8_000];

class RetryableAnthropicError extends Error {
  constructor(
    message: string,
    public readonly isRateLimit = false,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

export class CircuitOpenError extends Error {
  constructor(public readonly retryInMs: number) {
    super(`circuit breaker open, retry in ${retryInMs}ms`);
  }
}

// In-process concurrency gate: caps how many Anthropic calls run at once
// across ALL report generations in this Node process (both the per-cluster
// deep-analysis calls and the final report-summary call share this one gate).
// Guards against burst LLM calls when several independent test runs
// (different funnels/envs) finish around the same time — each triggers its
// own generateReport() with zero coordination otherwise. Not a queue: excess
// calls just wait in-memory for a free slot, nothing persisted, lost on
// process restart (acceptable — a lost AI summary just means the report
// shows without one, and the UI's Regenerate button covers that).
const MAX_CONCURRENT_LLM_CALLS = 2;
let activeLlmCalls = 0;
const waitingForSlot: Array<() => void> = [];

const acquireLlmSlot = (): Promise<void> => {
  if (activeLlmCalls < MAX_CONCURRENT_LLM_CALLS) {
    activeLlmCalls++;

    return Promise.resolve();
  }

  return new Promise((resolve) => {
    waitingForSlot.push(() => {
      activeLlmCalls++;
      resolve();
    });
  });
};

const releaseLlmSlot = (): void => {
  activeLlmCalls--;
  waitingForSlot.shift()?.();
};

interface ContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: { type: 'base64'; media_type: string; data: string };
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generalized single Anthropic call — used for both the per-cluster deep
 * analysis and the report-summary call, so retry/circuit-breaker/concurrency
 * logic below lives in one place instead of being duplicated per call site.
 */
// Model comes from config.json (Settings → Автоматизація) with the
// ANTHROPIC_MODEL env value as fallback — switchable without a redeploy.
const resolveModel = async (): Promise<string> => {
  const { result: config } = await storage.readConfigFile();

  return config?.ai?.model || env.ANTHROPIC_MODEL;
};

const callAnthropicOnce = async (
  model: string,
  systemPrompt: string,
  content: ContentBlock[],
  maxTokens: number,
): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY!,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content }],
      }),
      signal: controller.signal,
    });
  } catch (error) {
    // Network error / timeout — transient, worth retrying.
    throw new RetryableAnthropicError(`Anthropic API request failed: ${(error as Error).message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const message = `Anthropic API ${response.status}: ${text.slice(0, 500)}`;

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;

      throw new RetryableAnthropicError(message, true, Number.isFinite(retryAfterMs) ? retryAfterMs : undefined);
    }

    // 5xx (server-side) is transient; other 4xx (bad key, malformed request)
    // will fail identically on every retry.
    if (response.status >= 500) {
      throw new RetryableAnthropicError(message);
    }

    throw new Error(message);
  }

  const json = (await response.json()) as AnthropicResponse;
  const text = json.content?.find((block) => block.type === 'text')?.text;

  if (!text) {
    throw new Error('Anthropic API returned no text content');
  }

  return text;
};

const callAnthropic = async (systemPrompt: string, content: ContentBlock[], maxTokens: number): Promise<string> => {
  const model = await resolveModel();
  const breaker = circuitFor(model);

  if (!breaker.shouldAttempt()) {
    throw new CircuitOpenError(breaker.msUntilRetry());
  }

  for (let attempt = 0; ; attempt++) {
    try {
      const result = await callAnthropicOnce(model, systemPrompt, content, maxTokens);

      breaker.onSuccess();

      return result;
    } catch (error) {
      const isLastAttempt = attempt >= RETRY_DELAYS_MS.length;
      const isRetryable = error instanceof RetryableAnthropicError;

      if (isLastAttempt || !isRetryable) {
        // Non-retryable (bad key, malformed request) intentionally doesn't
        // trip the breaker — it fails loudly every time by design, see
        // circuitBreaker.ts. Exhausted retries of a transient failure do.
        if (isRetryable) {
          breaker.onFailure(error.isRateLimit, error.retryAfterMs);
        }

        throw error;
      }

      const delay = RETRY_DELAYS_MS[attempt];

      console.warn(`[ai-summary] retrying Anthropic call in ${delay}ms (attempt ${attempt + 1}): ${error.message}`);
      await sleep(delay);
    }
  }
};

const callAnthropicWithSlot = async (
  systemPrompt: string,
  content: ContentBlock[],
  maxTokens: number,
): Promise<string> => {
  await acquireLlmSlot();

  try {
    return await callAnthropic(systemPrompt, content, maxTokens);
  } finally {
    releaseLlmSlot();
  }
};

// ── Stage 1: per-cluster deep analysis ──────────────────────────────────────
// Lean equivalent of upstream v6's per-test analysis task, but scoped to one
// representative test PER CLUSTER instead of every failing test — a shared
// fixture taking down 50 tests is still one cluster, one deep-analysis call,
// not 50. See app/lib/ai/clustering.ts for how clusters are formed.

const DEEP_ANALYSIS_SYSTEM_PROMPT = `You are diagnosing a single Playwright test failure in depth (it represents other failures sharing the same cause, if any).

How you work:
- Name the concrete root cause: the specific file, fixture, locator, or backend behavior at fault.
- When the test attached its own diagnostic report or context (e.g. a log-analysis attachment, error-context) treat it as PRIMARY evidence — for data/backend-driven tests that never touch the UI, that attachment IS the finding; summarize the concrete cause it names (specific service, error signature, upstream) instead of guessing from the assertion text.
- When a screenshot is attached, use it as primary evidence — a timeout/click error often looks generic in text alone, but the screenshot can show the actual UI state (wrong tab/panel selected, unexpected modal, empty form) that explains it.
- When network activity is attached, check it before trusting the error message: a 4xx/5xx response just before the failure is often the real cause even when the test's own error looks like a generic timeout.
- Console errors and the action log are secondary evidence — use them to confirm a theory, not to invent a new one.
- Respond in 2-4 sentences, plain text, no markdown headers: the root cause, then a concrete fix (file/locator/signature in backticks where relevant).
- Respond in English. Keep file paths, locators, error signatures, and code identifiers verbatim (don't paraphrase them).`;

const formatNetworkEvidence = (events: TraceEvidence['networkEvents']): string | null => {
  if (events.length === 0) {
    return null;
  }

  return events
    .map((e) => {
      const status = e.status ? ` -> ${e.status}` : e.failureText ? ` -> FAILED (${e.failureText})` : '';

      return `${e.method} ${e.url}${status}${e.responseBody ? `\n  body: ${e.responseBody}` : ''}`;
    })
    .join('\n');
};

const formatConsoleEvidence = (events: TraceEvidence['consoleEvents']): string | null => {
  if (events.length === 0) {
    return null;
  }

  return events.map((e) => `[${e.level}] ${e.text}`).join('\n');
};

const formatActionEvidence = (events: TraceEvidence['actionLog']): string | null => {
  if (events.length === 0) {
    return null;
  }

  return events
    .map((e) => `${e.action}${e.target ? ` on \`${e.target}\`` : ''}${e.error ? ` — ${e.error}` : ''}`)
    .join('\n');
};

const buildDeepAnalysisContent = (cluster: FailureCluster, evidence: TraceEvidence | null): ContentBlock[] => {
  const representative = cluster.tests[0];
  const sharedNote =
    cluster.tests.length > 1 ? ` (representative of ${cluster.tests.length} tests failing the same way)` : '';

  const text = `Test: "${representative.title}"${sharedNote}
Location: \`${representative.location}\`
Error: ${representative.errors.join(' | ')}`;

  const blocks: ContentBlock[] = [{ type: 'text', text }];

  // Test-produced text attachments (log analysis, error-context) go in FIRST,
  // before the trace evidence — for backend/data tests this is the real finding
  // and the prompt tells the model to treat it as primary evidence.
  for (const attachment of representative.textAttachments ?? []) {
    blocks.push({ type: 'text', text: `Attachment "${attachment.name}":\n${attachment.content}` });
  }

  if (representative.screenshot) {
    blocks.push({ type: 'text', text: 'Screenshot at failure:' });
    blocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: representative.screenshot.mediaType,
        data: representative.screenshot.base64,
      },
    });
  }

  const networkText = evidence && formatNetworkEvidence(evidence.networkEvents);
  const consoleText = evidence && formatConsoleEvidence(evidence.consoleEvents);
  const actionText = evidence && formatActionEvidence(evidence.actionLog);

  if (networkText) {
    blocks.push({ type: 'text', text: `Network activity (secrets redacted):\n${networkText}` });
  }

  if (consoleText) {
    blocks.push({ type: 'text', text: `Console log:\n${consoleText}` });
  }

  if (actionText) {
    blocks.push({ type: 'text', text: `Recent actions leading to failure:\n${actionText}` });
  }

  return blocks;
};

/** Never throws — a failed deep analysis just means that cluster falls back
 * to its raw error text in the report summary, not that the whole report fails. */
const runDeepAnalysis = async (cluster: FailureCluster, zip: JSZip): Promise<string | undefined> => {
  const tracePath = cluster.tests[0].traceAttachmentPath;
  const evidence = tracePath ? await extractTraceEvidence(zip, tracePath) : null;

  const { result, error } = await withError(
    callAnthropicWithSlot(
      DEEP_ANALYSIS_SYSTEM_PROMPT,
      buildDeepAnalysisContent(cluster, evidence),
      DEEP_ANALYSIS_MAX_TOKENS,
    ),
  );

  if (error) {
    console.warn(`[ai-summary] deep analysis failed for cluster "${cluster.signature}": ${error.message}`);

    return undefined;
  }

  return result ?? undefined;
};

// ── Stage 2: report summary over pre-clustered, pre-analyzed input ─────────

const REPORT_SUMMARY_SYSTEM_PROMPT = `You are a QA lead reviewing a single Playwright CI run. The failures arrive already grouped by shared cause (same code location, or same error signature), and the top clusters already carry a deep root-cause analysis — you explain and prioritize, you don't group from scratch.

How you work:
- Lead with the clusters that already have a deep analysis attached — trust and summarize it, don't second-guess it.
- For clusters without a deep analysis (below the analysis cutoff), work from the raw representative error alone.
- Name the concrete fix target - file, locator, error signature - in backticks.
- Favor density over completeness: interpret, don't restate the raw list.
- Respond as plain Markdown starting at the Verdict line; keep the response out of a code fence.
- Every test you name MUST use the exact markdown link form \`[test title](testref:TEST_ID)\`, taking TEST_ID verbatim from that test's \`[testId: ...]\` tag in the data. Do not invent IDs and do not link a test that has no tag.
- Respond in English. Keep the verdict token on line 1 (isolated/clustered/widespread/systemic) lowercase, exactly as specified. Keep file paths, locators, error signatures, and code identifiers verbatim (don't paraphrase them). Keep the section headings (## Failure Patterns, ## Recommendations) as written.`;

interface ClusterWithAnalysis extends FailureCluster {
  analysis?: string;
}

const clusterReasonLabel: Record<FailureCluster['reason'], string> = {
  same_location: 'Shared failure location',
  same_error: 'Shared error signature',
  isolated: 'Isolated failure',
};

const buildReportSummaryContent = (
  project: string | undefined,
  clusters: ClusterWithAnalysis[],
  totalFailures: number,
  omittedCount: number,
): ContentBlock[] => {
  const clusterBlocks = clusters
    .map((cluster, i) => {
      const representative = cluster.tests[0];
      const testTags = cluster.tests.map((t) => `[testId: ${t.testId}]`).join(' ');
      const header = `${i + 1}. **${clusterReasonLabel[cluster.reason]}** (${cluster.tests.length} test(s)) — \`${representative.location}\``;
      const testLine = `   Representative: **${representative.title}** ${testTags}`;
      const body = cluster.analysis
        ? `   Analysis: ${cluster.analysis}`
        : `   Error: ${truncateMiddle(representative.errors.join(' | '), 300)}`;

      return `${header}\n${testLine}\n${body}`;
    })
    .join('\n\n');

  const omittedNote =
    omittedCount > 0
      ? `\n\n[…${omittedCount} more failure cluster(s) omitted to fit prompt budget — summary may be incomplete…]`
      : '';

  const text = `Summarize the failures in this run${project ? ` — project "${project}"` : ''}: ${totalFailures} failing/flaky test(s) across ${clusters.length + omittedCount} cluster(s)${omittedCount > 0 ? ` (showing first ${clusters.length})` : ''}:

${clusterBlocks}${omittedNote}

Output format:
1. Line 1, exactly \`**Verdict:** <token>\`, lowercase, one of: \`isolated\` (≤2 unrelated failures), \`clustered\` (1-2 dominant shared causes), \`widespread\` (many unrelated causes), \`systemic\` (one root cause across most failures).
2. Blank line, then a 1-3 sentence plain-English summary naming the most important cause.
3. \`## Failure Patterns\` — dominant clusters, what's concretely broken.
4. \`## Recommendations\` — ordered by impact, name concrete files/locators/signatures.

Keep it under 300 words total.`;

  return [{ type: 'text', text }];
};

export type AiSummaryResult =
  | { status: 'generated' }
  | { status: 'skipped_disabled' }
  | { status: 'skipped_clean' }
  | { status: 'skipped_unsupported_storage' }
  | { status: 'circuit_open'; retryInMs: number }
  | { status: 'failed'; reason: string };

const AI_STATUS_FILENAME = 'ai-summary-status.json';

/**
 * Persists the outcome for statuses worth surfacing later (via the UI's
 * Regenerate flow) — NOT for skipped_disabled/skipped_unsupported_storage,
 * which are static server config rather than a per-report fact, and NOT for
 * skipped_clean, which is the expected, unremarkable common case (a clean
 * pass never having a summary isn't something to explain to the user).
 */
const writeStatus = async (
  projectPath: string,
  reportId: string,
  result: AiSummaryResult,
): Promise<AiSummaryResult> => {
  if (
    result.status === 'skipped_disabled' ||
    result.status === 'skipped_unsupported_storage' ||
    result.status === 'skipped_clean'
  ) {
    return result;
  }

  // projectPath/reportId come from stored metadata; resolveInside keeps a tampered value from leaving REPORTS_FOLDER.
  const { error } = await withError(
    (async () =>
      fs.writeFile(
        resolveInside(REPORTS_FOLDER, projectPath, reportId, AI_STATUS_FILENAME),
        JSON.stringify({ ...result, updatedAt: new Date().toISOString() }),
        'utf-8',
      ))(),
  );

  if (error) {
    console.error(`[ai-summary] failed to write status for report ${reportId}: ${error.message}`);
  }

  return result;
};

/**
 * AI failure summary for a report — only runs when there are failures (a
 * clean 100% pass run costs nothing) and only when ANTHROPIC_API_KEY is
 * configured (opt-in, off by default). Writes `ai-summary.md` next to
 * `index.html` inside the report folder — the existing `/api/serve` route
 * already serves any file under REPORTS_FOLDER, so no new route is needed.
 *
 * Two-stage: failures are deterministically clustered first (clustering.ts,
 * no LLM), then the top clusters each get an expensive deep-analysis call
 * (with the representative test's screenshot, if any), and finally one
 * report-summary call describes the already-clustered, already-analyzed
 * input instead of grouping raw failures from scratch itself. Bounds API
 * cost by distinct-cause count, not raw failure count — a shared fixture
 * taking down 50 tests is still one cluster, one deep-analysis call.
 *
 * Called two ways: fire-and-forget from service.generateReport() right after
 * a report is created (caller doesn't await the result, just logs on reject),
 * and awaited from POST /api/report/[id]/ai-summary for the UI's manual
 * "Regenerate" action — that route DOES care about the returned status.
 *
 * fs-only for now: writes directly via node fs rather than through the Storage
 * abstraction (which has no generic "write arbitrary file into report folder"
 * method). Our deploy only runs DATA_STORAGE=fs; s3/azure just skip with a log.
 */
export const generateReportAiSummary = async (
  reportId: string,
  projectPath: string,
  report: ReportInfo,
): Promise<AiSummaryResult> => {
  if (!env.ANTHROPIC_API_KEY) {
    return { status: 'skipped_disabled' };
  }

  const hasFailures = report.stats.unexpected > 0 || report.stats.flaky > 0;

  if (!hasFailures) {
    return { status: 'skipped_clean' };
  }

  if (env.DATA_STORAGE !== 'fs') {
    console.warn('[ai-summary] skipping: only DATA_STORAGE=fs is supported for now');

    return { status: 'skipped_unsupported_storage' };
  }

  const relativeIndexPath = `${projectPath}${reportId}/index.html`;

  const { result: html, error: readError } = await withError(
    storage.readFile(relativeIndexPath, 'text/html') as Promise<string>,
  );

  if (readError || !html) {
    const reason = `failed to read ${relativeIndexPath}: ${readError?.message}`;

    console.error(`[ai-summary] ${reason}`);

    return writeStatus(projectPath, reportId, { status: 'failed', reason });
  }

  const zip = await loadReportZip(html);
  const failures: TestFailure[] = await getFailureDetails(zip, report);

  if (failures.length === 0) {
    // hasFailures said otherwise but per-file JSON had nothing usable —
    // shouldn't normally happen, but if it does there's genuinely nothing to summarize.
    return { status: 'skipped_clean' };
  }

  const { clusters: budgetedClusters, omittedCount } = fitClustersToBudget(clusterFailures(failures));

  const deepAnalysisTargets = budgetedClusters.slice(0, MAX_CLUSTERS_FOR_DEEP_ANALYSIS);
  const analyses = await Promise.all(deepAnalysisTargets.map((cluster) => runDeepAnalysis(cluster, zip)));

  const clustersWithAnalysis: ClusterWithAnalysis[] = budgetedClusters.map((cluster, i) => ({
    ...cluster,
    analysis: i < analyses.length ? analyses[i] : undefined,
  }));

  const { result: markdown, error: llmError } = await withError(
    callAnthropicWithSlot(
      REPORT_SUMMARY_SYSTEM_PROMPT,
      buildReportSummaryContent(report.projectNames?.[0], clustersWithAnalysis, failures.length, omittedCount),
      REPORT_SUMMARY_MAX_TOKENS,
    ),
  );

  if (llmError instanceof CircuitOpenError) {
    return writeStatus(projectPath, reportId, { status: 'circuit_open', retryInMs: llmError.retryInMs });
  }

  if (llmError || !markdown) {
    const reason = llmError?.message ?? 'LLM returned no content';

    console.error(`[ai-summary] LLM call failed for report ${reportId}: ${reason}`);

    return writeStatus(projectPath, reportId, { status: 'failed', reason });
  }

  const { error: writeError } = await withError(
    (async () =>
      fs.writeFile(resolveInside(REPORTS_FOLDER, projectPath, reportId, AI_SUMMARY_FILENAME), markdown, 'utf-8'))(),
  );

  if (writeError) {
    const reason = `failed to write summary: ${writeError.message}`;

    console.error(`[ai-summary] ${reason} (report ${reportId})`);

    return writeStatus(projectPath, reportId, { status: 'failed', reason });
  }

  console.log(
    `[ai-summary] generated for report ${reportId} (${failures.length} failing tests, ${budgetedClusters.length} clusters, ${analyses.filter(Boolean).length} deep-analyzed)`,
  );

  return writeStatus(projectPath, reportId, { status: 'generated' });
};
