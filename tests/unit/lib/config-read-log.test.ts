import { createConfigReadLogger } from '@/app/lib/service/config-read-log';
import { noConfigErr } from '@/app/lib/config';

const makeConsole = () => ({ log: jest.fn(), error: jest.fn() });

describe('config read logging', () => {
  it('reports a missing config.json once, as info', () => {
    const out = makeConsole();
    const report = createConfigReadLogger(out);

    report(new Error(noConfigErr));
    report(new Error(noConfigErr));
    report(new Error(noConfigErr));

    expect(out.log).toHaveBeenCalledTimes(1);
    expect(out.log.mock.calls[0][0]).toMatch(/config\.json/);
    expect(out.error).not.toHaveBeenCalled();
  });

  it('keeps reporting real read failures as errors, every time', () => {
    const out = makeConsole();
    const report = createConfigReadLogger(out);

    report(new Error('EACCES: permission denied'));
    report(new Error('Unexpected token } in JSON'));

    expect(out.error).toHaveBeenCalledTimes(2);
    expect(out.error.mock.calls[0][0]).toContain('EACCES');
  });

  it('stays quiet when there is no error', () => {
    const out = makeConsole();
    const report = createConfigReadLogger(out);

    report(undefined);
    report(null);

    expect(out.log).not.toHaveBeenCalled();
    expect(out.error).not.toHaveBeenCalled();
  });
});
