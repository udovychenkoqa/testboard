import type { SuiteNode } from './suites';

// A suite's own cases plus those of every suite below it. Client-safe: SuiteNode is a type-only import.
export const suiteTotals = (suites: SuiteNode[]): Map<number, number> => {
  const parentOf = new Map(suites.map((s) => [s.id, s.parentId]));
  const totals = new Map(suites.map((s) => [s.id, 0]));

  for (const s of suites) {
    // Walk up from each suite; `seen` guards against a cycle in bad data.
    const seen = new Set<number>();

    for (let id: number | null = s.id; id !== null && totals.has(id) && !seen.has(id); id = parentOf.get(id) ?? null) {
      seen.add(id);
      totals.set(id, (totals.get(id) ?? 0) + s.caseCount);
    }
  }

  return totals;
};
