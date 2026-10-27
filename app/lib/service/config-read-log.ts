import { noConfigErr } from '@/app/lib/config';

type Out = Pick<Console, 'log' | 'error'>;

// A missing config.json is the normal state of a fresh install (defaults are
// used until Settings saves one) — say so once per process, not as an error
// on every request. Real read failures are still errors, every time.
export const createConfigReadLogger = (out: Out = console) => {
  let reportedMissing = false;

  return (error: Error | null | undefined) => {
    if (!error) return;
    if (error.message === noConfigErr) {
      if (!reportedMissing) out.log('[service] no config.json yet — using defaults until Settings saves one');
      reportedMissing = true;

      return;
    }
    out.error(`[service] getConfig | error: ${error.message}`);
  };
};
