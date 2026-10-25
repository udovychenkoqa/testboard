import { ZodError } from 'zod';

// Shared responses for the /api/autotests routes.
export const notConfigured = () =>
  Response.json({ error: 'Running autotests through GitLab is not configured on this server' }, { status: 503 });

export const upstreamError = (error: unknown) => {
  if (error instanceof ZodError) {
    const issue = error.issues[0];

    return Response.json({ error: `${issue.path.join('.') || 'body'}: ${issue.message}` }, { status: 400 });
  }

  return Response.json({ error: error instanceof Error ? error.message : 'GitLab request failed' }, { status: 502 });
};

export const readBody = async (req: Request): Promise<unknown> => {
  try {
    return await req.json();
  } catch {
    return {};
  }
};
