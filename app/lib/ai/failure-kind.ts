// Client-safe: turns the raw reason stored with a failed AI summary (e.g. "Anthropic API 401: {...json...}")
// into a kind the UI can explain in plain words. Works on reasons already saved by older versions too.

export type AiFailureKind =
  | 'auth'
  | 'forbidden'
  | 'billing'
  | 'model'
  | 'rateLimit'
  | 'unavailable'
  | 'network'
  | 'badRequest'
  | 'readReport'
  | 'writeSummary'
  | 'emptyResponse'
  | 'unknown';

export const aiFailureKind = (reason: string): AiFailureKind => {
  const status = Number(reason.match(/^Anthropic API (\d{3})\b/)?.[1]);

  if (/credit balance|billing/i.test(reason)) return 'billing';
  if (status === 401 || /authentication_error|x-api-key/i.test(reason)) return 'auth';
  if (status === 403 || /permission_error/i.test(reason)) return 'forbidden';
  if (status === 404 || /not_found_error/i.test(reason)) return 'model';
  if (status === 429 || /rate_limit/i.test(reason)) return 'rateLimit';
  if (status >= 500 || /overloaded/i.test(reason)) return 'unavailable';
  if (status === 400 || /invalid_request_error/i.test(reason)) return 'badRequest';
  if (/^Anthropic API request failed/i.test(reason)) return 'network';
  if (/^failed to read /i.test(reason)) return 'readReport';
  if (/^failed to write summary/i.test(reason)) return 'writeSummary';
  if (/no (text )?content/i.test(reason)) return 'emptyResponse';

  return 'unknown';
};
