'use server';

import { cookies } from 'next/headers';

import { isLocale, LOCALE_COOKIE } from '@/i18n/locale';

const ONE_YEAR = 60 * 60 * 24 * 365;

// Persists the viewer's language choice; anything but a supported locale is
// rejected so a crafted value can never reach the messages import.
export async function setLocale(locale: string): Promise<{ ok: boolean }> {
  if (!isLocale(locale)) return { ok: false };
  cookies().set(LOCALE_COOKIE, locale, { maxAge: ONE_YEAR, path: '/', sameSite: 'lax' });

  return { ok: true };
}
