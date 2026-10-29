// Client-safe: splits a case list into per-suite groups in suite-tree order, so a parent suite's list shows
// which nested suite each case actually lives in.

interface SuiteLike {
  id: number;
  parentId: number | null;
  name: string;
  position: number;
}

export interface SuiteGroup<T> {
  suiteId: number;
  path: string;
  cases: T[];
}

export const groupBySuite = <T extends { suiteId: number }>(cases: T[], suites: SuiteLike[]): SuiteGroup<T>[] => {
  const byId = new Map(suites.map((s) => [s.id, s]));
  const children = new Map<number | null, SuiteLike[]>();

  for (const s of suites) children.set(s.parentId, [...(children.get(s.parentId) ?? []), s]);

  // Depth-first walk gives tree order: a suite, then its sub-suites by position.
  const order = new Map<number, number>();
  const walk = (parentId: number | null) =>
    (children.get(parentId) ?? [])
      .sort((a, b) => a.position - b.position)
      .forEach((s) => {
        order.set(s.id, order.size);
        walk(s.id);
      });

  walk(null);

  const pathOf = (id: number): string => {
    const names: string[] = [];

    for (let s = byId.get(id); s; s = s.parentId === null ? undefined : byId.get(s.parentId)) names.unshift(s.name);

    return names.join(' / ');
  };

  const groups = new Map<number, SuiteGroup<T>>();

  for (const item of cases) {
    if (!groups.has(item.suiteId))
      groups.set(item.suiteId, { suiteId: item.suiteId, path: pathOf(item.suiteId), cases: [] });
    groups.get(item.suiteId)!.cases.push(item);
  }

  return [...groups.values()].sort((a, b) => (order.get(a.suiteId) ?? Infinity) - (order.get(b.suiteId) ?? Infinity));
};
