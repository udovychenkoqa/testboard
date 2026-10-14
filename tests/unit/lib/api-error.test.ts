import { describeApiError } from '@/app/lib/api-error';

describe('describeApiError', () => {
  it('recognises an unreachable upstream (Node fetch failure)', () => {
    expect(describeApiError(502, '{"error":"fetch failed"}')).toEqual({ kind: 'unreachable' });
    expect(describeApiError(500, '{"error":"getaddrinfo ENOTFOUND drone.example"}')).toEqual({ kind: 'unreachable' });
    expect(describeApiError(500, '{"error":"connect ECONNREFUSED 127.0.0.1:80"}')).toEqual({ kind: 'unreachable' });
  });

  it('pulls the message out of a JSON error body', () => {
    expect(describeApiError(500, '{"error":"failed to save config: disk full"}')).toEqual({
      kind: 'server',
      detail: 'failed to save config: disk full',
    });
    expect(describeApiError(400, '{"message":"bad tag"}')).toEqual({ kind: 'server', detail: 'bad tag' });
  });

  it('keeps a short plain-text body as the detail', () => {
    expect(describeApiError(500, 'failed to list report files: nope')).toEqual({
      kind: 'server',
      detail: 'failed to list report files: nope',
    });
  });

  it('drops HTML error pages and empty bodies', () => {
    expect(describeApiError(500, '<!DOCTYPE html><html>…</html>')).toEqual({ kind: 'server' });
    expect(describeApiError(500, '')).toEqual({ kind: 'server' });
  });

  it('flags auth and missing resources by status', () => {
    expect(describeApiError(403, '{"error":"forbidden"}')).toEqual({ kind: 'forbidden' });
    expect(describeApiError(404, '{"error":"ResultID with not found: x"}')).toEqual({
      kind: 'notFound',
      detail: 'ResultID with not found: x',
    });
  });

  it('truncates very long details', () => {
    const detail = describeApiError(500, JSON.stringify({ error: 'x'.repeat(500) })).detail ?? '';

    expect(detail.length).toBeLessThanOrEqual(200);
    expect(detail.endsWith('…')).toBe(true);
  });
});
