import { getPipelineRecords, recordPipeline } from '@/app/lib/autotests/pipelines';
import { MIGRATIONS } from '@/app/lib/tm/migrations';
import { openDb, type TmDb } from '@/app/lib/tm/db';

describe('autotest pipeline records', () => {
  let db: TmDb;

  beforeEach(() => {
    db = openDb(':memory:');
  });

  afterEach(() => db.close());

  it('runs the migration that adds the table', () => {
    expect(MIGRATIONS.length).toBe(2);
    expect(db.pragma('user_version', { simple: true })).toBe(2);
  });

  it('stores who started a pipeline and with which inputs', () => {
    const inputs = { env: 'stage', mode: 'by tag', tag: '@smoke', skip_visual_checks: true };

    recordPipeline(db, { pipelineId: 901, startedBy: 'qa@hanimax.com', inputs });
    recordPipeline(db, { pipelineId: 902, startedBy: null, inputs: { env: 'prod' } });

    const records = getPipelineRecords(db, [901, 902, 999]);

    expect(records.get(901)).toEqual({ startedBy: 'qa@hanimax.com', inputs });
    expect(records.get(902)).toEqual({ startedBy: null, inputs: { env: 'prod' } });
    expect(records.has(999)).toBe(false);
  });

  it('returns an empty map for no ids', () => {
    expect(getPipelineRecords(db, []).size).toBe(0);
  });
});
