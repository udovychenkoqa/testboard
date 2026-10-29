import { type TestFailure } from '../parser';

/**
 * Lean equivalent of upstream v6's deterministic buildClusters() (failure-clustering/),
 * scoped to a single report (no SQLite, no cross-report history — upstream's version
 * tracks clusters over time; we only ever look at one report's failures at once).
 *
 * Groups failures by two signals, in priority order:
 * 1. Same location (file:line:column) — same code line failing in >1 test is a
 *    strong, unambiguous signal of one shared cause.
 * 2. Same normalized error message head — catches a shared cause hitting
 *    different test files (e.g. one broken backend endpoint failing several
 *    unrelated specs), where location alone wouldn't group them.
 *
 * Anything matching neither is its own isolated singleton cluster.
 */
export type ClusterReason = 'same_location' | 'same_error' | 'isolated';

export interface FailureCluster {
  signature: string;
  reason: ClusterReason;
  tests: TestFailure[];
}

const normalizeErrorHead = (error: string): string => {
  return (error.split('\n')[0] ?? '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    // No \b — digits are often glued to a unit (30000ms, 60s) with no word
    // boundary between digit and letter, so \b\d+\b would silently miss them.
    .replace(/\d+/g, '<n>')
    .trim();
};

export const clusterFailures = (failures: TestFailure[]): FailureCluster[] => {
  const byLocation = new Map<string, TestFailure[]>();

  for (const failure of failures) {
    byLocation.set(failure.location, [...(byLocation.get(failure.location) ?? []), failure]);
  }

  const clusters: FailureCluster[] = [];
  const consumed = new Set<string>();

  for (const [location, tests] of byLocation) {
    if (tests.length > 1) {
      clusters.push({ signature: location, reason: 'same_location', tests });
      tests.forEach((test) => consumed.add(test.testId));
    }
  }

  const remaining = failures.filter((failure) => !consumed.has(failure.testId));
  const byErrorHead = new Map<string, TestFailure[]>();

  for (const failure of remaining) {
    const head = normalizeErrorHead(failure.errors[0] ?? '');

    byErrorHead.set(head, [...(byErrorHead.get(head) ?? []), failure]);
  }

  for (const [head, tests] of byErrorHead) {
    clusters.push({ signature: head, reason: tests.length > 1 ? 'same_error' : 'isolated', tests });
  }

  // Largest (highest-impact) cluster first.
  return clusters.sort((a, b) => b.tests.length - a.tests.length);
};
