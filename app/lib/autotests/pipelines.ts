import { type TmDb } from '@/app/lib/tm/db';
import { now } from '@/app/lib/tm/errors';
import { type PipelineInputs } from '@/app/lib/gitlab';

export interface PipelineRecord {
  startedBy: string | null;
  inputs: PipelineInputs;
}

// Remembers who started a pipeline from Testboard and with what inputs, so the runs list can show the
// person (not the token owner) and rerun with the same inputs.
export const recordPipeline = (
  db: TmDb,
  record: { pipelineId: number; startedBy: string | null; inputs: PipelineInputs },
): void => {
  db.prepare(
    'INSERT OR REPLACE INTO autotest_pipelines (pipeline_id, started_by, inputs, created_at) VALUES (?, ?, ?, ?)',
  ).run(record.pipelineId, record.startedBy, JSON.stringify(record.inputs), now());
};

export const getPipelineRecords = (db: TmDb, ids: number[]): Map<number, PipelineRecord> => {
  if (!ids.length) return new Map();
  const rows = db
    .prepare(
      `SELECT pipeline_id, started_by, inputs FROM autotest_pipelines WHERE pipeline_id IN (${ids.map(() => '?').join(',')})`,
    )
    .all(...ids) as { pipeline_id: number; started_by: string | null; inputs: string }[];

  return new Map(rows.map((row) => [row.pipeline_id, { startedBy: row.started_by, inputs: JSON.parse(row.inputs) }]));
};
