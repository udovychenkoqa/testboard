'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { LOCALES, type Locale } from '@/i18n/locale';
import { setLocale } from '@/app/lib/locale-actions';

// Writes the cookie, then re-renders the current route on the server in the
// new language — no full reload, URL unchanged.
export const useSwitchLocale = () => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const switchTo = (locale: Locale) =>
    startTransition(async () => {
      const { ok } = await setLocale(locale);

      if (ok) router.refresh();
    });

  return { switchTo, isPending };
};

// Compact EN / UK segmented toggle (user menu and login page corner).
export const LanguageSwitch: React.FC<{ className?: string }> = ({ className }) => {
  const current = useLocale() as Locale;
  const t = useTranslations('languages');
  const { switchTo, isPending } = useSwitchLocale();

  return (
    <div
      aria-label={t(current)}
      className={`inline-flex rounded-lg bg-default-100 p-0.5 ${className ?? ''}`}
      role="group"
    >
      {LOCALES.map((locale) => (
        <button
          key={locale}
          aria-pressed={locale === current}
          className={`h-6 rounded-md px-2 text-[11px] font-semibold uppercase transition-colors disabled:opacity-60 ${
            locale === current ? 'bg-content1 text-foreground shadow-sm' : 'text-default-500 hover:text-foreground'
          }`}
          disabled={isPending}
          title={t(locale)}
          type="button"
          onClick={() => locale !== current && switchTo(locale)}
        >
          {locale}
        </button>
      ))}
    </div>
  );
};
