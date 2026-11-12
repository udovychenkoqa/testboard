'use client';

import type { CaseChange, CaseHistoryEntry } from '@/app/lib/tm/caseHistory';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight, History } from 'lucide-react';

import FormattedDate from '@/app/components/date-format';
import { PersonAvatar } from '@/app/components/person-avatar';
import { usePeople } from '@/app/hooks/usePeople';
import useQuery from '@/app/hooks/useQuery';

type Step = { action: string; expected: string };

const ENUM_FIELDS = ['priority', 'status', 'automation'] as const;

// Who changed what in a case, newest first. Closed by default: most visits to a case are to read or edit it.
export const CaseHistory: React.FC<{ caseId: number }> = ({ caseId }) => {
  const t = useTranslations('tm');
  const { nameOf, profileOf } = usePeople();
  const [open, setOpen] = useState(false);
  const { data: entries = [] } = useQuery<CaseHistoryEntry[]>(`/api/tm/cases/${caseId}/history`, { enabled: open });

  // Enum values read as their labels ("Високий"), free text as typed, an emptied field as a dash.
  const text = (change: CaseChange, value: unknown): string => {
    const isEnum = (ENUM_FIELDS as readonly string[]).includes(change.field);

    if (isEnum && typeof value === 'string') return t(`fields.${change.field}.${value}` as 'fields.priority.high');
    if (Array.isArray(value)) return value.length ? value.join(', ') : '—';

    return String(value ?? '') || '—';
  };

  const fieldLabel = (field: CaseChange['field']) =>
    (ENUM_FIELDS as readonly string[]).includes(field)
      ? t(`fields.${field}.label` as 'fields.priority.label')
      : t(`fields.${field}` as 'fields.title');

  const renderChange = (change: CaseChange) => {
    if (change.field === 'steps') {
      const from = change.from as Step[];
      const to = change.to as Step[];

      return (
        <details>
          <summary className="cursor-pointer text-default-600">
            {t('history.steps', { from: from.length, to: to.length })}
          </summary>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-default-500">
            {to.map((step, index) => (
              <li key={index}>
                {step.action}
                {step.expected && <span className="text-default-400"> → {step.expected}</span>}
              </li>
            ))}
          </ol>
        </details>
      );
    }

    return (
      <span className="break-words">
        <span className="text-default-400 line-through">{text(change, change.from)}</span>{' '}
        <span className="text-default-400">→</span> <span className="text-foreground">{text(change, change.to)}</span>
      </span>
    );
  };

  return (
    <section className="rounded-lg border border-divider">
      <button
        aria-expanded={open}
        className="flex h-9 w-full items-center gap-2 px-3 text-left text-[12.5px] font-medium text-default-600"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <History size={13} />
        {t('history.title')}
      </button>
      {open && (
        <div className="border-t border-divider">
          {entries.length === 0 ? (
            <p className="px-3 py-2.5 text-[12px] text-default-400">{t('history.empty')}</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="flex gap-2.5 border-b border-divider px-3 py-2.5 last:border-0">
                <PersonAvatar
                  avatarUpdatedAt={profileOf(entry.changedBy)?.avatarUpdatedAt}
                  className="mt-0.5 h-[22px] w-[22px] shrink-0 text-[10px]"
                  email={entry.changedBy}
                  name={nameOf(entry.changedBy)}
                />
                <div className="min-w-0 flex-1 text-[12px]">
                  <p className="text-default-500">
                    <span className="font-medium text-foreground">{nameOf(entry.changedBy)}</span> ·{' '}
                    <FormattedDate relativeDay date={new Date(entry.changedAt)} />
                  </p>
                  <ul className="mt-1 space-y-1">
                    {entry.changes.map((change) => (
                      <li key={change.field} className="flex gap-2">
                        <span className="w-28 shrink-0 text-default-500">{fieldLabel(change.field)}</span>
                        <div className="min-w-0 flex-1">{renderChange(change)}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
};
