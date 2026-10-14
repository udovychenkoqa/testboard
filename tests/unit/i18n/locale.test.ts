import { intlLocale, isLocale, resolveLocale } from '@/i18n/locale';

describe('resolveLocale', () => {
  it('uses a valid cookie over the header', () => {
    expect(resolveLocale('uk', 'en-US,en;q=0.9')).toBe('uk');
    expect(resolveLocale('en', 'uk-UA,uk;q=0.9')).toBe('en');
  });

  it.each(['de', 'UK', '../x', '', '  '])('ignores invalid cookie %p', (cookie) => {
    expect(resolveLocale(cookie, 'uk-UA')).toBe('uk');
    expect(resolveLocale(cookie, 'en')).toBe('en');
  });

  it.each([
    ['uk-UA,uk;q=0.9,en;q=0.8', 'uk'],
    ['uk', 'uk'],
    ['UK-ua', 'uk'],
    ['ru,uk;q=0.8', 'en'],
    ['en-US,uk;q=0.9', 'en'],
    ['en;q=0.5,uk;q=0.9', 'uk'],
    ['*', 'en'],
    ['', 'en'],
  ])('header %p → %p', (header, expected) => {
    expect(resolveLocale(undefined, header)).toBe(expected);
  });

  it('falls back to en without a header', () => {
    expect(resolveLocale(undefined, null)).toBe('en');
    expect(resolveLocale(undefined, undefined)).toBe('en');
  });
});

describe('isLocale / intlLocale', () => {
  it('accepts only supported locales', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('uk')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('maps to Intl locales', () => {
    expect(intlLocale('en')).toBe('en-GB');
    expect(intlLocale('uk')).toBe('uk');
  });
});
