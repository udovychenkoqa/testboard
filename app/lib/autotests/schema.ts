import { z } from 'zod';

import { DEFAULT_INPUTS, ENVIRONMENTS, MODES } from './inputs';

export const triggerInputs = z.object({
  env: z.enum(ENVIRONMENTS).default(DEFAULT_INPUTS.env),
  mode: z.enum(MODES).default(DEFAULT_INPUTS.mode),
  tag: z.string().trim().max(200).default(DEFAULT_INPUTS.tag),
  qase_run_id: z.string().trim().regex(/^\d*$/, 'digits only').default(DEFAULT_INPUTS.qase_run_id),
  qase_id: z
    .string()
    .trim()
    .regex(/^[\d,\s]*$/, 'case ids separated by commas')
    .default(DEFAULT_INPUTS.qase_id),
  force_snapshots_recollection: z.boolean().default(DEFAULT_INPUTS.force_snapshots_recollection),
  skip_visual_checks: z.boolean().default(DEFAULT_INPUTS.skip_visual_checks),
});

export const pipelineId = z.object({ id: z.number().int().positive() });
