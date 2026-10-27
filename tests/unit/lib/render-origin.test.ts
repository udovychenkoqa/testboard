import { resolveRenderOrigin } from '@/app/lib/renderOrigin';

const headers = (values: Record<string, string>) => new Headers(values);

describe('resolveRenderOrigin', () => {
  const previous = { ...process.env };

  beforeEach(() => {
    process.env.AUTH_URL = 'https://qa.example.com';
    delete process.env.NEXTAUTH_URL;
    process.env.PORT = '3000';
  });

  afterEach(() => {
    process.env = { ...previous };
  });

  it('keeps the configured public host and https', () => {
    expect(resolveRenderOrigin(headers({ host: 'qa.example.com', 'x-forwarded-proto': 'https' })).origin).toBe(
      'https://qa.example.com',
    );
  });

  it.each(['evil.example', '169.254.169.254', 'qa.example.com@evil.example', 'x/../y'])(
    'falls back to localhost for host %s',
    (host) => {
      expect(resolveRenderOrigin(headers({ host })).origin).toBe('http://localhost:3000');
    },
  );

  it('never takes a non-http scheme from X-Forwarded-Proto', () => {
    const { origin } = resolveRenderOrigin(headers({ host: 'qa.example.com', 'x-forwarded-proto': 'file:///etc/x#' }));

    expect(origin).toBe('http://qa.example.com');
  });
});
