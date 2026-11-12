import { z } from 'zod';

import { DEFAULT_INPUTS, DEV_CORES, ENVIRONMENTS, SUITES, suitesFor } from './inputs';

export const triggerInputs = z
  .object({
    env: z.enum(ENVIRONMENTS).default(DEFAULT_INPUTS.env),
    suite: z.enum(SUITES).default(DEFAULT_INPUTS.suite),
    // Long enough for a filter of several dozen selected cases.
    tag: z.string().trim().max(400).default(DEFAULT_INPUTS.tag),
    dev_branch: z.string().trim().max(200).default(DEFAULT_INPUTS.dev_branch),
    dev_core: z.enum(DEV_CORES).default(DEFAULT_INPUTS.dev_core),
    force_snapshots_recollection: z.boolean().default(DEFAULT_INPUTS.force_snapshots_recollection),
    skip_visual_checks: z.boolean().default(DEFAULT_INPUTS.skip_visual_checks),
    testboard_run: z
      .string()
      .trim()
      .regex(/^(new|\d+)?$/, "'', 'new' or a run id")
      .default(DEFAULT_INPUTS.testboard_run),
  })
  // The same rules the pipeline enforces, so a bad choice fails here instead of in a started pipeline.
  .refine((inputs) => suitesFor(inputs.env).includes(inputs.suite), {
    path: ['suite'],
    message: 'only the smoke suite may run on prod',
  })
  .refine((inputs) => inputs.env !== 'dev-dynamic' || !!inputs.dev_branch, {
    path: ['dev_branch'],
    message: 'dev-dynamic needs the branch to test',
  });

export const pipelineId = z.object({ id: z.number().int().positive() });
