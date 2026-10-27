'use client';

import { useMemo } from 'react';
import { Popover, PopoverTrigger, PopoverContent, RangeCalendar, Button } from '@heroui/react';
import { CalendarDate, type DateValue } from '@internationalized/date';
import { I18nProvider } from '@react-aria/i18n';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useDateLabels } from '@/app/components/date-format';

interface DateRangePickerProps {
  dateFrom?: string;
  dateTo?: string;
  label?: string;
  onDateFromChange?: (date: string) => void;
  onDateToChange?: (date: string) => void;
}

const toCalendarDate = (iso: string): CalendarDate => {
  const d = new Date(iso);

  return new CalendarDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};

const toIsoStartOfDay = (d: DateValue): string =>
  `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}T00:00:00.000Z`;

const toIsoEndOfDay = (d: DateValue): string =>
  `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}T23:59:59.999Z`;

// Range bounds are stored as UTC midnight / end-of-day, so format in UTC.
const formatShort = (iso: string, intl: string): string =>
  new Date(iso).toLocaleDateString(intl, { day: 'numeric', month: 'short', timeZone: 'UTC' });

export default function DateRangePicker({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: Readonly<DateRangePickerProps>) {
  const t = useTranslations('filters');
  const { intl } = useDateLabels();
  const value = useMemo(() => {
    if (!dateFrom || !dateTo) return null;
    try {
      return { start: toCalendarDate(dateFrom), end: toCalendarDate(dateTo) };
    } catch {
      return null;
    }
  }, [dateFrom, dateTo]);

  const label = value ? `${formatShort(dateFrom!, intl)} – ${formatShort(dateTo!, intl)}` : t('allTime');

  const handleChange = (range: { start: DateValue; end: DateValue } | null) => {
    if (!range) {
      onDateFromChange?.('');
      onDateToChange?.('');

      return;
    }

    onDateFromChange?.(toIsoStartOfDay(range.start));
    onDateToChange?.(toIsoEndOfDay(range.end));
  };

  return (
    <Popover placement="bottom-start">
      <PopoverTrigger>
        <button
          className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-default-200 bg-content1 px-2.5 text-xs text-default-600 transition-colors hover:bg-default-100"
          type="button"
        >
          <CalendarDays className="text-default-400" size={13} />
          <span className={value ? 'font-medium text-foreground' : 'text-default-400'}>{label}</span>
          <ChevronDown className="text-default-400" size={13} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-2">
        <I18nProvider locale={intl}>
          <RangeCalendar value={value as any} onChange={handleChange as any} />
        </I18nProvider>
        {value && (
          <Button
            className="w-full"
            size="sm"
            variant="light"
            onPress={() => {
              onDateFromChange?.('');
              onDateToChange?.('');
            }}
          >
            {t('clear')}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
