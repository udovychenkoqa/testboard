import { suiteTotals } from '@/app/lib/tm/suiteTotals';

const suite = (id: number, parentId: number | null, caseCount: number) => ({
  id,
  parentId,
  name: `s${id}`,
  position: id,
  caseCount,
});

describe('suiteTotals', () => {
  it('adds every nested suite to its ancestors', () => {
    const totals = suiteTotals([suite(1, null, 0), suite(2, 1, 10), suite(3, 1, 2), suite(4, 3, 5)]);

    expect(totals.get(1)).toBe(17);
    expect(totals.get(3)).toBe(7);
    expect(totals.get(2)).toBe(10);
  });

  it("counts a parent's own cases too", () => {
    expect(suiteTotals([suite(1, null, 3), suite(2, 1, 4)]).get(1)).toBe(7);
  });

  it('keeps sibling trees apart', () => {
    const totals = suiteTotals([suite(1, null, 0), suite(2, 1, 6), suite(3, null, 0), suite(4, 3, 7)]);

    expect(totals.get(1)).toBe(6);
    expect(totals.get(3)).toBe(7);
  });

  it('ignores a parent that is missing from the list', () => {
    expect(suiteTotals([suite(2, 99, 4)]).get(2)).toBe(4);
  });
});
