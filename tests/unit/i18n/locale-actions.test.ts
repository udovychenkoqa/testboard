const set = jest.fn();

jest.mock('next/headers', () => ({ cookies: () => ({ set }) }));

import { setLocale } from '@/app/lib/locale-actions';

describe('setLocale', () => {
  beforeEach(() => set.mockClear());

  it('stores a supported locale in the cookie', async () => {
    await expect(setLocale('uk')).resolves.toEqual({ ok: true });
    expect(set).toHaveBeenCalledWith(
      'NEXT_LOCALE',
      'uk',
      expect.objectContaining({ path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 }),
    );
  });

  it.each(['de', '', 'UK', '../x'])('rejects %p without touching the cookie', async (value) => {
    await expect(setLocale(value)).resolves.toEqual({ ok: false });
    expect(set).not.toHaveBeenCalled();
  });
});
