'use client';

import { useState } from 'react';
import { Input, Switch } from '@heroui/react';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Segmented } from '@/app/components/ui/segmented';
import { useDateLabels } from '@/app/components/date-format';

export type Frequency = 'daily' | 'weekly' | 'custom';

// Weekday names in the UI language; 2026-01-04 is a Sunday (cron weekday 0).
const weekdayName = (index: number, intl: string): string => {
  const name = new Date(2026, 0, 4 + index).toLocaleDateString(intl, { weekday: 'long' });

  return name[0].toUpperCase() + name.slice(1);
};

const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'custom'];

export interface ScheduleState {
  frequency: Frequency;
  time: string; // HH:MM
  weekday: string; // 0..6, cron convention (0 = Sunday)
  raw: string; // used only for frequency=custom
}

// "33 3 * * *" → daily at 03:33; "0 6 * * 1" → weekly on Monday.
// Anything fancier (steps, ranges, lists) stays as a raw cron in custom mode.
export const parseCron = (cron: string): ScheduleState => {
  const fallback: ScheduleState = { frequency: 'custom', time: '03:00', weekday: '1', raw: cron };
  const parts = cron.trim().split(/\s+/);

  if (parts.length !== 5) return fallback;
  const [min, hour, dom, month, dow] = parts;

  if (!/^\d{1,2}$/.test(min) || !/^\d{1,2}$/.test(hour) || dom !== '*' || month !== '*') return fallback;
  const time = `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;

  if (dow === '*') return { frequency: 'daily', time, weekday: '1', raw: cron };
  if (/^[0-6]$/.test(dow)) return { frequency: 'weekly', time, weekday: dow, raw: cron };

  return fallback;
};

export const buildCron = (s: ScheduleState): string => {
  if (s.frequency === 'custom') return s.raw.trim();
  const [hour, min] = s.time.split(':');

  return `${Number(min)} ${Number(hour)} * * ${s.frequency === 'weekly' ? s.weekday : '*'}`;
};

export interface ScheduleLabels {
  daily: (time: string) => string;
  weekly: (day: string, time: string) => string;
  cron: (cron: string) => string;
  weekday: (index: number) => string;
}

export const describeSchedule = (s: ScheduleState, labels: ScheduleLabels): string => {
  if (s.frequency === 'custom') return labels.cron(s.raw.trim() || '—');
  if (s.frequency === 'weekly') return labels.weekly(labels.weekday(Number(s.weekday)), s.time);

  return labels.daily(s.time);
};

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[10px] uppercase tracking-wide text-default-400">{children}</span>
);

interface RuleProps {
  title: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  days: string;
  onDaysChange: (v: string) => void;
  onDaysBlur: () => void;
  schedule: ScheduleState;
  onScheduleChange: (v: ScheduleState) => void;
  isSaving: boolean;
}

const CleanupRule: React.FC<RuleProps> = ({
  title,
  description,
  enabled,
  onEnabledChange,
  days,
  onDaysChange,
  onDaysBlur,
  schedule,
  onScheduleChange,
  isSaving,
}) => {
  const t = useTranslations('settings.cleanup');
  const tc = useTranslations('common');
  const { intl } = useDateLabels();
  const scheduleLabels: ScheduleLabels = {
    daily: (time) => t('describeDaily', { time }),
    weekly: (day, time) => t('describeWeekly', { day, time }),
    cron: (cron) => t('describeCron', { cron }),
    weekday: (index) => weekdayName(index, intl),
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-semibold">{title}</p>
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ${
              enabled ? 'bg-success/15 text-success' : 'bg-default-100 text-default-500'
            }`}
          >
            {enabled ? tc('enabled') : tc('disabled')}
          </span>
        </div>
        <Switch isDisabled={isSaving} isSelected={enabled} size="sm" onValueChange={onEnabledChange} />
      </div>
      <p className="text-[11.5px] text-default-500">{description}</p>

      <div className="grid grid-cols-[80px_auto_1fr] gap-3 items-start">
        <div className="flex flex-col gap-1">
          <FieldLabel>{t('keepFor')}</FieldLabel>
          <Input
            classNames={{ inputWrapper: 'h-8 min-h-8' }}
            endContent={<span className="text-[11px] text-default-400">{t('days')}</span>}
            isDisabled={!enabled}
            size="sm"
            type="number"
            value={days}
            variant="bordered"
            onBlur={onDaysBlur}
            onValueChange={onDaysChange}
          />
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel>{t('frequency')}</FieldLabel>
          <Segmented
            className={!enabled ? 'pointer-events-none opacity-50' : ''}
            options={FREQUENCIES.map((key) => ({ key, label: t(key === 'custom' ? 'cron' : key) }))}
            value={schedule.frequency}
            onChange={(frequency) => onScheduleChange({ ...schedule, frequency })}
          />
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel>
            {schedule.frequency === 'weekly' ? t('day') : schedule.frequency === 'custom' ? t('cron') : t('time')}
          </FieldLabel>
          {schedule.frequency === 'weekly' ? (
            <select
              className="h-8 w-full max-w-[180px] rounded-lg border border-default-200 bg-content2 px-2 text-[12.5px] outline-none disabled:opacity-50"
              disabled={!enabled}
              value={schedule.weekday}
              onChange={(e) => onScheduleChange({ ...schedule, weekday: e.target.value })}
            >
              {[0, 1, 2, 3, 4, 5, 6].map((index) => (
                <option key={index} value={String(index)}>
                  {weekdayName(index, intl)}
                </option>
              ))}
            </select>
          ) : schedule.frequency === 'custom' ? (
            <Input
              classNames={{ inputWrapper: 'h-8 min-h-8' }}
              isDisabled={!enabled}
              placeholder="33 3 * * *"
              size="sm"
              value={schedule.raw}
              variant="bordered"
              onValueChange={(raw) => onScheduleChange({ ...schedule, raw })}
            />
          ) : (
            <Input
              className="max-w-[120px]"
              classNames={{ inputWrapper: 'h-8 min-h-8' }}
              isDisabled={!enabled}
              size="sm"
              type="time"
              value={schedule.time}
              variant="bordered"
              onValueChange={(time) => onScheduleChange({ ...schedule, time: time || '03:00' })}
            />
          )}
        </div>
      </div>
      <p className="font-mono text-[11.5px] text-default-400">{describeSchedule(schedule, scheduleLabels)}</p>
    </div>
  );
};

interface CleanupCardProps {
  resultDays: string;
  resultEnabled: boolean;
  resultSchedule: ScheduleState;
  reportDays: string;
  reportEnabled: boolean;
  reportSchedule: ScheduleState;
  isSaving: boolean;
  onChange: (next: {
    resultDays: string;
    resultEnabled: boolean;
    resultSchedule: ScheduleState;
    reportDays: string;
    reportEnabled: boolean;
    reportSchedule: ScheduleState;
  }) => void;
}

export function CleanupCard(props: Readonly<CleanupCardProps>) {
  const t = useTranslations('settings.cleanup');
  const { resultDays, resultEnabled, resultSchedule, reportDays, reportEnabled, reportSchedule, isSaving, onChange } =
    props;

  // Local text state so the days field feels responsive; the parent commits
  // (and persists) on blur / schedule change / switch toggle.
  const [localResultDays, setLocalResultDays] = useState(resultDays);
  const [localReportDays, setLocalReportDays] = useState(reportDays);

  const commit = (patch: Partial<Parameters<typeof onChange>[0]>) =>
    onChange({
      resultDays: localResultDays,
      resultEnabled,
      resultSchedule,
      reportDays: localReportDays,
      reportEnabled,
      reportSchedule,
      ...patch,
    });

  return (
    <section className="scroll-mt-3 overflow-hidden rounded-xl border border-divider bg-content1" id="cleanup">
      <div className="flex h-10 items-center gap-2 border-b border-divider px-4">
        <Trash2 className="text-primary" size={15} />
        <span className="text-[13px] font-semibold">{t('title')}</span>
        <span className="font-mono text-[11px] text-default-400">{t('subtitle')}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y divide-divider md:divide-y-0 md:divide-x">
        <CleanupRule
          days={localResultDays}
          description={t('resultsDescription')}
          enabled={resultEnabled}
          isSaving={isSaving}
          schedule={resultSchedule}
          title={t('results')}
          onDaysBlur={() => commit({ resultDays: localResultDays })}
          onDaysChange={setLocalResultDays}
          onEnabledChange={(v) => commit({ resultEnabled: v })}
          onScheduleChange={(v) => commit({ resultSchedule: v })}
        />
        <CleanupRule
          days={localReportDays}
          description={t('reportsDescription')}
          enabled={reportEnabled}
          isSaving={isSaving}
          schedule={reportSchedule}
          title={t('reports')}
          onDaysBlur={() => commit({ reportDays: localReportDays })}
          onDaysChange={setLocalReportDays}
          onEnabledChange={(v) => commit({ reportEnabled: v })}
          onScheduleChange={(v) => commit({ reportSchedule: v })}
        />
      </div>
    </section>
  );
}
