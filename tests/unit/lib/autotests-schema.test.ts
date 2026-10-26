import { DEFAULT_INPUTS } from '@/app/lib/autotests/inputs';
import { pipelineId, triggerInputs } from '@/app/lib/autotests/schema';

describe('trigger inputs', () => {
  it('fills defaults from the autotests pipeline', () => {
    expect(triggerInputs.parse({})).toEqual({
      env: 'prod',
      mode: 'by tag',
      tag: '@smoke',
      force_snapshots_recollection: false,
      skip_visual_checks: true,
    });
    expect(triggerInputs.parse({})).toEqual(DEFAULT_INPUTS);
  });

  it('accepts every option the pipeline accepts', () => {
    const parsed = triggerInputs.parse({
      env: 'dev',
      mode: 'regression',
      tag: '@api, @visual',
      force_snapshots_recollection: true,
      skip_visual_checks: false,
    });

    expect(parsed.mode).toBe('regression');
    expect(parsed.tag).toBe('@api, @visual');
  });

  it.each([
    [{ env: 'test' }],
    [{ mode: 'nightly' }],
    [{ tag: 'x'.repeat(201) }],
    [{ skip_visual_checks: 'yes' }],
  ])('rejects %j', (input) => {
    expect(triggerInputs.safeParse(input).success).toBe(false);
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
