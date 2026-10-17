export type TmErrorCode = 'not_found' | 'conflict' | 'not_empty' | 'invalid';

// Domain errors from the test-management repositories; the API layer maps the
// code to an HTTP status (see http.ts).
export class TmError extends Error {
  constructor(
    public readonly code: TmErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TmError';
  }
}

export const now = () => new Date().toISOString();
