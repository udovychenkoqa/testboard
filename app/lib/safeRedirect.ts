// callbackUrl comes from the query string, so only same-origin relative paths may be followed.
// Rejects javascript:, absolute URLs, `//host` and `/\host` (browsers treat `\` as `/`).
export const safeCallbackPath = (raw: string | null | undefined, fallback = '/'): string => {
  if (!raw) return fallback;

  let decoded: string;

  try {
    decoded = decodeURI(raw);
  } catch {
    return fallback;
  }

  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\')) return fallback;

  return decoded;
};
