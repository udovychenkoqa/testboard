// Inputs of the autotests GitLab pipeline (`spec.inputs` in its .gitlab-ci.yml) that Testboard sends. The
// pipeline's Qase inputs are left out: the autotests report to Testboard, not Qase. Client-safe: the run form
// and the server schema both read from here, so a change to the pipeline is updated in one place.

export const ENVIRONMENTS = ['prod', 'stage', 'dev'] as const;
export const MODES = ['by tag', 'smoke', 'regression'] as const;
export const TAG_PRESETS = ['@smoke', '@core-regression', '@api', '@visual'] as const;

export type Environment = (typeof ENVIRONMENTS)[number];
export type Mode = (typeof MODES)[number];

export interface TriggerInputs {
  env: Environment;
  mode: Mode;
  tag: string;
  force_snapshots_recollection: boolean;
  skip_visual_checks: boolean;
}

export const DEFAULT_INPUTS: TriggerInputs = {
  env: 'prod',
  mode: 'by tag',
  tag: '@smoke',
  force_snapshots_recollection: false,
  skip_visual_checks: true,
};
