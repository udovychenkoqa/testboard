'use client';

import { Switch } from '@heroui/react';
import { Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Segmented } from '@/app/components/ui/segmented';

const MODEL_OPTIONS = [
  { key: 'claude-haiku-4-5-20251001', label: 'Haiku' },
  { key: 'claude-sonnet-5', label: 'Sonnet' },
  { key: 'claude-opus-4-8', label: 'Opus' },
];

interface AutomationCardProps {
  autoAnalyze: boolean;
  aiModel: string;
  isSaving: boolean;
  onChange: (next: { autoAnalyzeEnabled: boolean; model: string }) => void;
}

export function AutomationCard({ autoAnalyze, aiModel, isSaving, onChange }: Readonly<AutomationCardProps>) {
  const t = useTranslations('settings.automation');

  return (
    <section className="scroll-mt-3 overflow-hidden rounded-xl border border-divider bg-content1" id="automation">
      <div className="flex h-10 items-center gap-2 border-b border-divider px-4">
        <Zap className="text-primary" size={15} />
        <span className="text-[13px] font-semibold">{t('title')}</span>
      </div>

      <div className="flex items-center justify-between gap-4 border-b border-divider px-4 py-3">
        <div>
          <p className="text-[12.5px] font-medium">{t('aiTitle')}</p>
          <p className="text-[11.5px] text-default-500">{t('aiDescription')}</p>
        </div>
        <Switch
          isDisabled={isSaving}
          isSelected={autoAnalyze}
          size="sm"
          onValueChange={(enabled) => onChange({ autoAnalyzeEnabled: enabled, model: aiModel })}
        />
      </div>

      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div>
          <p className="text-[12.5px] font-medium">{t('modelTitle')}</p>
          <p className="text-[11.5px] text-default-500">{t('modelDescription')}</p>
        </div>
        <Segmented
          className={isSaving ? 'pointer-events-none opacity-50' : ''}
          options={MODEL_OPTIONS}
          value={aiModel}
          onChange={(model) => onChange({ autoAnalyzeEnabled: autoAnalyze, model })}
        />
      </div>
    </section>
  );
}
