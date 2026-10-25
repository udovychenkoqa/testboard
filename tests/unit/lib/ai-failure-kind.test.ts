import { aiFailureKind } from '@/app/lib/ai/failure-kind';

describe('aiFailureKind', () => {
  it.each([
    [
      'Anthropic API 401: {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_1"}',
      'auth',
    ],
    ['Anthropic API 403: {"type":"error","error":{"type":"permission_error","message":"no access"}}', 'forbidden'],
    [
      'Anthropic API 400: {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}',
      'billing',
    ],
    ['Anthropic API 404: {"type":"error","error":{"type":"not_found_error","message":"model: claude-x"}}', 'model'],
    ['Anthropic API 429: {"type":"error","error":{"type":"rate_limit_error","message":"slow down"}}', 'rateLimit'],
    ['Anthropic API 529: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}', 'unavailable'],
    ['Anthropic API 500: {"type":"error","error":{"type":"api_error","message":"boom"}}', 'unavailable'],
    ['Anthropic API request failed: fetch failed', 'network'],
    ['Anthropic API request failed: This operation was aborted', 'network'],
    ['Anthropic API 400: {"type":"error","error":{"type":"invalid_request_error","message":"prompt is too long"}}', 'badRequest'],
    ['failed to read data/reports/x/index.html: ENOENT', 'readReport'],
    ['failed to write summary: EACCES', 'writeSummary'],
    ['LLM returned no content', 'emptyResponse'],
    ['Anthropic API returned no text content', 'emptyResponse'],
    ['something nobody expected', 'unknown'],
    ['', 'unknown'],
  ])('%s → %s', (reason, kind) => {
    expect(aiFailureKind(reason)).toBe(kind);
  });
});
