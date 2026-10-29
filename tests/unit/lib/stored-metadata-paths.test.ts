jest.mock('@/app/lib/storage', () => ({ storage: {} }));
jest.mock('@/app/lib/parser', () => ({ loadReportZip: jest.fn(), getFailureDetails: jest.fn() }));

import { getOrBuildReportFailures } from '@/app/lib/analytics/failures';

describe('stored report metadata paths', () => {
  it('returns nothing instead of touching a path outside REPORTS_FOLDER', async () => {
    const report = { stats: { unexpected: 1, flaky: 0 } } as never;

    await expect(getOrBuildReportFailures('r1', '../../outside/', report)).resolves.toEqual([]);
    await expect(getOrBuildReportFailures('../../r1', 'p/', report)).resolves.toEqual([]);
  });
});
