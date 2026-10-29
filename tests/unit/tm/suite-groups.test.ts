import { groupBySuite } from '@/app/lib/tm/suite-groups';

const suites = [
  { id: 4, parentId: null, name: 'Design', position: 0, caseCount: 1 },
  { id: 6, parentId: 4, name: 'Admin', position: 1, caseCount: 2 },
  { id: 5, parentId: 4, name: 'Form', position: 0, caseCount: 1 },
  { id: 9, parentId: null, name: 'Cart', position: 1, caseCount: 1 },
];
const c = (id: number, suiteId: number) => ({ id, suiteId });

describe('groupBySuite', () => {
  it('groups cases by suite in tree order with the full suite path', () => {
    const groups = groupBySuite([c(1, 6), c(2, 9), c(3, 4), c(4, 5), c(5, 6)], suites);

    expect(groups.map((g) => [g.suiteId, g.path, g.cases.map((x) => x.id)])).toEqual([
      [4, 'Design', [3]],
      [5, 'Design / Form', [4]],
      [6, 'Design / Admin', [1, 5]],
      [9, 'Cart', [2]],
    ]);
  });

  it('keeps cases of an unknown suite at the end', () => {
    expect(groupBySuite([c(1, 77)], suites).map((g) => [g.suiteId, g.path])).toEqual([[77, '']]);
  });
});
