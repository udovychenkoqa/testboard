import path from 'node:path';

/**
 * Joins `segments` onto `root` and guarantees the result stays inside `root`.
 * Request-controlled ids, project names and file names go through here before
 * they reach fs calls, so `../` (raw or decoded from %2F) cannot escape.
 */
export const resolveInside = (root: string, ...segments: string[]): string => {
  const base = path.resolve(root);
  const target = path.resolve(base, ...segments);

  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error('Path escapes the allowed folder');
  }

  return target;
};
