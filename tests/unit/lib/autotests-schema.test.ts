import { casesFilter, DEFAULT_INPUTS, toPipelineVariables } from '@/app/lib/autotests/inputs';
import { pipelineId, triggerInputs } from '@/app/lib/autotests/schema';

describe('trigger inputs', () => {
  it('fills defaults from the autotests pipeline', () => {
    expect(triggerInputs.parse({})).toEqual({
      env: 'dev',
      suite: 'smoke',
      tag: '',
      dev_branch: '',
      dev_core: 'static',
      force_snapshots_recollection: false,
      skip_visual_checks: true,
      testboard_run: '',
    });
    expect(triggerInputs.parse({})).toEqual(DEFAULT_INPUTS);
  });

  it('accepts every option the pipeline accepts', () => {
    const parsed = triggerInputs.parse({
      env: 'dev-dynamic',
      suite: 'regression',
      tag: '@payment, @marketing',
      dev_branch: 'feature/HM-289_reg-funnel',
      dev_core: 'branch',
      force_snapshots_recollection: true,
      skip_visual_checks: false,
    });

    expect(parsed.suite).toBe('regression');
    expect(parsed.tag).toBe('@payment, @marketing');
    expect(parsed.dev_branch).toBe('feature/HM-289_reg-funnel');
  });

  it.each([
    [{ env: 'stage' }],
    [{ suite: 'nightly' }],
    [{ tag: 'x'.repeat(401) }],
    [{ skip_visual_checks: 'yes' }],
    [{ dev_core: 'both' }],
  ])('rejects %j', (input) => {
    expect(triggerInputs.safeParse(input).success).toBe(false);
  });

  it('allows only the smoke suite on prod (the pipeline refuses the rest)', () => {
    expect(triggerInputs.safeParse({ env: 'prod', suite: 'smoke' }).success).toBe(true);
    expect(triggerInputs.safeParse({ env: 'prod', suite: 'regression' }).success).toBe(false);
    expect(triggerInputs.safeParse({ env: 'prod', suite: 'all' }).success).toBe(false);
  });

  it('needs a branch for dev-dynamic', () => {
    expect(triggerInputs.safeParse({ env: 'dev-dynamic' }).success).toBe(false);
    expect(triggerInputs.safeParse({ env: 'dev-dynamic', dev_branch: 'feature/x' }).success).toBe(true);
  });

  it.each(['', 'new', '42'])('accepts testboard_run %j', (value) => {
    expect(triggerInputs.parse({ testboard_run: value }).testboard_run).toBe(value);
  });

  it.each(['abc', '-1', '4 2'])('rejects testboard_run %j', (value) => {
    expect(triggerInputs.safeParse({ testboard_run: value }).success).toBe(false);
  });

  it('does not send Qase inputs: the autotests report to Testboard, not Qase', () => {
    expect(triggerInputs.parse({ qase_run_id: '123', qase_id: '356' })).not.toHaveProperty('qase_run_id');
    expect(triggerInputs.parse({ qase_run_id: '123', qase_id: '356' })).not.toHaveProperty('qase_id');
  });

  it('parses a pipeline id', () => {
    expect(pipelineId.parse({ id: 901 })).toEqual({ id: 901 });
    expect(pipelineId.safeParse({ id: -1 }).success).toBe(false);
    expect(pipelineId.safeParse({}).success).toBe(false);
  });
});

describe('pipeline variables', () => {
  it('names the inputs as the autotests pipeline does', () => {
    expect(toPipelineVariables({ ...DEFAULT_INPUTS, tag: '@payment', testboard_run: 'new' })).toEqual([
      { key: 'ENV', value: 'dev' },
      { key: 'SUITE', value: 'smoke' },
      { key: 'TAG', value: '@payment' },
      { key: 'SKIP_VISUAL_CHECKS', value: 'true' },
      { key: 'FORCE_SNAPSHOTS_RECOLLECTION', value: 'false' },
      { key: 'TESTBOARD_RUN', value: 'new' },
    ]);
  });

  it('sends the branch settings only for dev-dynamic', () => {
    const variables = toPipelineVariables({
      ...DEFAULT_INPUTS,
      env: 'dev-dynamic',
      dev_branch: 'feature/x',
      dev_core: 'branch',
    });

    expect(variables).toContainEqual({ key: 'DEV_BRANCH', value: 'feature/x' });
    expect(variables).toContainEqual({ key: 'DEV_CORE', value: 'branch' });
  });

  it('skips what an older stored run does not have', () => {
    expect(toPipelineVariables({ env: 'prod' })).toEqual([{ key: 'ENV', value: 'prod' }]);
  });
});

describe('casesFilter', () => {
  it('matches exactly the given cases in test titles', () => {
    const filter = casesFilter(['HM-3', 'HM-40']);

    expect(filter).toBe('HM-3(?![0-9]), HM-40(?![0-9])');

    // The pipeline turns ", " into "|" and uses the result as a Playwright --grep.
    const grep = new RegExp(filter.replace(/\s*,\s*/g, '|'));

    expect(grep.test('HM-3 the header menu opens')).toBe(true);
    expect(grep.test('HM-40, HM-11 rails list serials')).toBe(true);
    expect(grep.test('HM-36 the header menu opens')).toBe(false);
    expect(grep.test('HM-400 something else')).toBe(false);
  });
});
