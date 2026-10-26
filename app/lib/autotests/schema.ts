import { z } from 'zod';

import { DEFAULT_INPUTS, ENVIRONMENTS, MODES } from './inputs';

export const triggerInputs = z.object({
  env: z.enum(ENVIRONMENTS).default(DEFAULT_INPUTS.env),
  mode: z.enum(MODES).default(DEFAULT_INPUTS.mode),
  tag: z.string().trim().max(200).default(DEFAULT_INPUTS.tag),
  force_snapshots_recollection: z.boolean().default(DEFAULT_INPUTS.force_snapshots_recollection),
  skip_visual_checks: z.boolean().default(DEFAULT_INPUTS.skip_visual_checks),
  testboard_run: z
    .string()
    .trim()
    .regex(/^(new|\d+)?$/, "'', 'new' or a run id")
    .default(DEFAULT_INPUTS.testboard_run),
});

export const pipelineId = z.object({ id: z.number().int().positive() });
