// What Testboard sends to the autotests GitLab pipeline (playwright-hanimax): its `variables` from
// .gitlab-ci.yml, under the same names. Client-safe: the run form and the server schema both read from here,
// so a change to the pipeline is updated in one place.

export const ENVIRONMENTS = ['dev', 'dev-dynamic', 'prod'] as const;
export const SUITES = ['smoke', 'regression', 'funnel', 'all'] as const;
export const DEV_CORES = ['static', 'branch'] as const;
export const TAG_PRESETS = ['@payment', '@marketing', '@visual'] as const;

export type Environment = (typeof ENVIRONMENTS)[number];
export type Suite = (typeof SUITES)[number];
export type DevCore = (typeof DEV_CORES)[number];

export interface TriggerInputs {
  env: Environment;
  suite: Suite;
  // Optional tag or title filter inside the suite; commas mean OR (the pipeline turns it into a --grep).
  tag: string;
  // env = dev-dynamic only: the hanimax-web branch whose environment to test, and which core it talks to.
  dev_branch: string;
  dev_core: DevCore;
  force_snapshots_recollection: boolean;
  skip_visual_checks: boolean;
  // Testboard run the results go into: '' none, 'new' create one, or an in-progress run id.
  testboard_run: string;
}

export const DEFAULT_INPUTS: TriggerInputs = {
  env: 'dev',
  suite: 'smoke',
  tag: '',
  dev_branch: '',
  dev_core: 'static',
  force_snapshots_recollection: false,
  skip_visual_checks: true,
  testboard_run: '',
};

// The pipeline refuses anything but the read-only smoke suite on prod.
export const suitesFor = (env: Environment): readonly Suite[] => (env === 'prod' ? ['smoke'] : SUITES);

const VARIABLE_NAMES: [keyof TriggerInputs, string][] = [
  ['env', 'ENV'],
  ['dev_branch', 'DEV_BRANCH'],
  ['dev_core', 'DEV_CORE'],
  ['suite', 'SUITE'],
  ['tag', 'TAG'],
  ['skip_visual_checks', 'SKIP_VISUAL_CHECKS'],
  ['force_snapshots_recollection', 'FORCE_SNAPSHOTS_RECOLLECTION'],
  ['testboard_run', 'TESTBOARD_RUN'],
];

const BRANCH_ONLY = new Set<keyof TriggerInputs>(['dev_branch', 'dev_core']);

// GitLab takes pipeline variables as { key, value } strings. Partial on purpose: a rerun replays whatever an
// older record stored.
export const toPipelineVariables = (inputs: Partial<TriggerInputs>): { key: string; value: string }[] =>
  VARIABLE_NAMES.filter(
    ([field]) => inputs[field] !== undefined && (!BRANCH_ONLY.has(field) || inputs.env === 'dev-dynamic'),
  ).map(([field, key]) => ({ key, value: String(inputs[field]) }));

// A filter that runs exactly the tests of the given cases. Test titles start with the case label
// ("HM-36 the header menu opens"); the lookahead keeps HM-3 from also matching HM-36.
export const casesFilter = (labels: string[]): string => labels.map((label) => `${label}(?![0-9])`).join(', ');
