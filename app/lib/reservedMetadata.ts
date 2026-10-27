// Identity and size fields are assigned by the server. Uploaders and report-generation callers may add
// free-form metadata (job, env, funnel, ...) but must not overwrite these, or a result could
// shadow another result id, or point a report row at an off-site reportUrl.
const RESERVED_KEYS = new Set(['resultID', 'reportID', 'reportUrl', 'createdAt', 'size', 'sizeBytes']);

export const stripReservedMetadata = <T extends Record<string, unknown>>(input: T): Partial<T> =>
  Object.fromEntries(Object.entries(input).filter(([key]) => !RESERVED_KEYS.has(key))) as Partial<T>;
