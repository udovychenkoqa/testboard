type AuthConfig = typeof import('@/app/auth.config');

// next-auth ships ESM that Jest doesn't transform; the test only needs to know which providers are registered.
jest.mock('next-auth/providers/credentials', () => ({ __esModule: true, default: (o: { name: string }) => ({ name: o.name }) }));
jest.mock('next-auth/providers/google', () => ({ __esModule: true, default: () => ({ name: 'Google' }) }));

// env.ts reads process.env once at import, so each case loads a fresh copy of the config.
const providerIds = (vars: Record<string, string | undefined>): string[] => {
  const all = {
    API_TOKEN: 'ci-token',
    AUTH_SECRET: 'secret',
    AUTH_GOOGLE_ID: undefined,
    AUTH_GOOGLE_SECRET: undefined,
    AUTH_TOKEN_LOGIN: undefined,
    ...vars,
  };

  for (const [key, value] of Object.entries(all)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  let mod!: AuthConfig;

  jest.isolateModules(() => {
    mod = require('@/app/auth.config');
  });

  return (mod.authConfig.providers as { id?: string; name?: string }[]).map((p) => p.name ?? p.id ?? '');
};

describe('sign-in providers', () => {
  const google = { AUTH_GOOGLE_ID: 'id', AUTH_GOOGLE_SECRET: 'secret' };

  it('offers the API token when Google is off', () => {
    expect(providerIds({})).toEqual(['API Token']);
  });

  it('drops the API token once Google is on', () => {
    expect(providerIds(google)).toEqual(['Google']);
  });

  it('keeps it next to Google with AUTH_TOKEN_LOGIN', () => {
    expect(providerIds({ ...google, AUTH_TOKEN_LOGIN: 'true' })).toEqual(['Google', 'API Token']);
  });
});
