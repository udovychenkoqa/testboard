export type ApiErrorKind = 'unreachable' | 'forbidden' | 'notFound' | 'server';

export interface ApiErrorInfo {
  kind: ApiErrorKind;
  // Human-readable server message, when the body carried one.
  detail?: string;
}

const MAX_DETAIL = 200;

// Node's fetch/undici failures when the server can't reach an upstream
// (Drone, Anthropic, …): DNS, refused connection, timeouts.
const UNREACHABLE = /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|UND_ERR_CONNECT/i;

const extractMessage = (body: string): string | undefined => {
  const text = body.trim();

  if (!text || text.startsWith('<')) return undefined;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const value = parsed.error ?? parsed.message ?? parsed.reason;

    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  } catch {
    return text;
  }
};

const truncate = (text: string) => (text.length > MAX_DETAIL ? `${text.slice(0, MAX_DETAIL - 1)}…` : text);

// Turns a failed API response into something a toast can say in words
// instead of dumping the raw body.
export const describeApiError = (status: number, body: string): ApiErrorInfo => {
  const message = extractMessage(body);

  if (message && UNREACHABLE.test(message)) return { kind: 'unreachable' };
  if (status === 401 || status === 403) return { kind: 'forbidden' };

  const detail = message ? truncate(message) : undefined;

  if (status === 404) return detail ? { kind: 'notFound', detail } : { kind: 'notFound' };

  return detail ? { kind: 'server', detail } : { kind: 'server' };
};
