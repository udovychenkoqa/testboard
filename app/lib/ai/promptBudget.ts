import { type FailureCluster } from './clustering';

/**
 * Lean equivalent of upstream v6's promptBudget.ts, adapted to our flat
 * single-block prompts (no SegmentedPrompt structure — we don't need it
 * since we build plain strings, not upstream's multi-segment cacheable prompt).
 *
 * Guards the real risk for us: a "walk" test that fails deep into a long
 * quiz run can carry a giant stack trace, and a report with many distinct
 * failure clusters (rare, but possible on a genuinely widespread breakage)
 * can blow past a sane prompt size before we ever call the API.
 */
const MAX_ERROR_CHARS = 500;
const MAX_CLUSTERS_IN_PROMPT = 40;
// How many clusters get an expensive per-cluster deep-dive call (with the
// representative's screenshot, when available) before the report-summary
// call. Bounded independent of raw failure count — a shared-fixture failure
// taking down 50 tests is still just ONE cluster, ONE deep-analysis call.
export const MAX_CLUSTERS_FOR_DEEP_ANALYSIS = 5;

export const truncateMiddle = (text: string, maxChars: number): string => {
  if (text.length <= maxChars) {
    return text;
  }

  const keep = Math.floor((maxChars - 20) / 2);

  return `${text.slice(0, keep)}\n[…truncated…]\n${text.slice(-keep)}`;
};

export interface BudgetedClusters {
  clusters: FailureCluster[];
  omittedCount: number;
}

export const fitClustersToBudget = (clusters: FailureCluster[]): BudgetedClusters => {
  const truncated = clusters.map((cluster) => ({
    ...cluster,
    tests: cluster.tests.map((test) => ({ ...test, errors: test.errors.map((e) => truncateMiddle(e, MAX_ERROR_CHARS)) })),
  }));

  if (truncated.length <= MAX_CLUSTERS_IN_PROMPT) {
    return { clusters: truncated, omittedCount: 0 };
  }

  return {
    clusters: truncated.slice(0, MAX_CLUSTERS_IN_PROMPT),
    omittedCount: truncated.length - MAX_CLUSTERS_IN_PROMPT,
  };
};
