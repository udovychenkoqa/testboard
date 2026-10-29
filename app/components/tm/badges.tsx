'use client';

import type { Automation, Priority } from '@/app/lib/tm/constants';

import { useTranslations } from 'next-intl';
import { Bot, Hand, Wrench } from 'lucide-react';

const PRIORITY_CLASS: Record<Priority, string> = {
  high: 'bg-danger/10 text-danger',
  medium: 'bg-warning/15 text-warning',
  low: 'bg-default-100 text-default-500',
};

export const PriorityBadge: React.FC<{ value: Priority }> = ({ value }) => {
  const t = useTranslations('tm.fields.priority');

  return (
    <span className={`inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-medium ${PRIORITY_CLASS[value]}`}>
      {t(value)}
    </span>
  );
};

const AUTOMATION_ICON = { manual: Hand, automated: Bot, to_automate: Wrench } as const;

export const AutomationBadge: React.FC<{ value: Automation }> = ({ value }) => {
  const t = useTranslations('tm.fields.automation');
  const Icon = AUTOMATION_ICON[value];

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11.5px] ${value === 'automated' ? 'text-primary' : 'text-default-500'}`}
    >
      <Icon size={12} />
      {t(value)}
    </span>
  );
};
