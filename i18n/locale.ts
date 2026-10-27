export const LOCALES = ['en', 'uk'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

// Highest-weighted Accept-Language entry; ties keep header order.
const topLanguage = (header: string): string | undefined =>
  header
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));

      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.slice(2)) || 0 : 1, index };
    })
    .filter((entry) => entry.tag && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)[0]?.tag;

// Cookie (an explicit choice) wins; otherwise Ukrainian only when it's the
// viewer's top browser preference.
export const resolveLocale = (cookie: string | undefined, acceptLanguage: string | null | undefined): Locale => {
  if (isLocale(cookie)) return cookie;
  const top = acceptLanguage ? topLanguage(acceptLanguage) : undefined;

  return top?.startsWith('uk') ? 'uk' : DEFAULT_LOCALE;
};

// Intl locale used for dates: en-GB gives "8 Jul" and 24h time.
export const intlLocale = (locale: Locale): string => (locale === 'uk' ? 'uk' : 'en-GB');
