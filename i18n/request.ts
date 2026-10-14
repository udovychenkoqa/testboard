import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

import { LOCALE_COOKIE, resolveLocale } from './locale';

// Per-request locale for next-intl (no /uk URL prefixes): explicit cookie
// choice first, then the browser's top Accept-Language preference.
export default getRequestConfig(async () => {
  const locale = resolveLocale(cookies().get(LOCALE_COOKIE)?.value, headers().get('accept-language'));

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
