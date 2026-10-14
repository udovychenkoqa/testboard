'use client';
import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { formatRelativeDay, type AgoLabels, type DateLabels, type HeadingLabels } from '@/i18n/dates';
import { intlLocale, type Locale } from '@/i18n/locale';

// Intl locale + translated "Today / Yesterday / … ago" labels for the
// pure helpers in i18n/dates.ts.
export const useDateLabels = () => {
  const t = useTranslations('dates');
  const locale = useLocale() as Locale;

  return useMemo(() => {
    const relative: DateLabels = {
      today: (time) => t('today', { time }),
      yesterday: (time) => t('yesterday', { time }),
    };
    const heading: HeadingLabels = {
      today: (day) => t('todayDay', { day }),
      yesterday: (day) => t('yesterdayDay', { day }),
    };
    const ago: AgoLabels = {
      justNow: t('justNow'),
      minutes: (count) => t('minutesAgo', { count }),
      hours: (count) => t('hoursAgo', { count }),
      days: (count) => t('daysAgo', { count }),
    };

    return { intl: intlLocale(locale), relative, heading, ago };
  }, [t, locale]);
};

/**
 * Specific method for date formatting on the client
 * as server locale and client locale may not match
 */
export default function FormattedDate({
  date,
  options,
  relativeDay,
}: {
  date: Date;
  options?: Intl.DateTimeFormatOptions;
  relativeDay?: boolean;
}) {
  const { intl, relative } = useDateLabels();
  const [formattedDate, setFormattedDate] = useState('');
  // Full timestamp on hover when a shorter format is shown.
  const [fullDate, setFullDate] = useState<string>();

  useEffect(() => {
    const d = new Date(date);

    setFormattedDate(relativeDay ? formatRelativeDay(d, intl, relative) : d.toLocaleString(intl, options));
    setFullDate(options || relativeDay ? d.toLocaleString(intl) : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, relativeDay, intl, relative, JSON.stringify(options)]);

  return (
    <span className="whitespace-nowrap" title={fullDate}>
      {formattedDate}
    </span>
  );
}
