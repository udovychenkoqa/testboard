'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Switch,
} from '@heroui/react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Bell, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { withBase } from '@/app/lib/url';
import { SlackIcon } from '@/app/components/icons';
import { BlockSkeleton } from '@/app/components/ui/skeletons';
import { useDateLabels } from '@/app/components/date-format';
import { formatAgo } from '@/i18n/dates';

const WebhookRowIcon: React.FC = () => (
  <svg aria-hidden className="shrink-0" fill="none" height="16" viewBox="0 0 24 24" width="16">
    <path
      className="stroke-default-600"
      d="M10 15a2 2 0 1 0 4 0M12 3a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5l2.5 4.5M12 3a4 4 0 0 0-4 4c0 1.5.8 2.8 2 3.5L7.5 15M12 3v0M4.5 15a4 4 0 1 0 6 3.5h6a4 4 0 1 0-1-3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'slack' | 'webhook';
  url: string;
  condition: 'always' | 'has_failures' | 'has_failures_or_recovered';
  project?: string;
  enabled?: boolean;
  includeAiSummary?: boolean;
}

export interface NotificationsConfig {
  enabled: boolean;
  baseUrl?: string;
  channels: NotificationChannel[];
}

const CONDITIONS: NotificationChannel['condition'][] = ['always', 'has_failures', 'has_failures_or_recovered'];

interface DeliveryLogEntry {
  at: string;
  reportId: string;
  channel: string;
  outcome: 'sent' | 'skipped' | 'error';
  detail: string;
}

const OUTCOME_DOT: Record<DeliveryLogEntry['outcome'], string> = {
  sent: '#639922',
  skipped: '#97a0b0',
  error: '#E24B4A',
};

const TEMPLATE = '24px 1fr 96px 190px 150px 116px';

const NotificationsCard: React.FC<{
  config: NotificationsConfig;
  isSaving: boolean;
  onSave: (next: NotificationsConfig) => void;
}> = ({ config, isSaving, onSave }) => {
  const { intl, ago } = useDateLabels();
  const t = useTranslations('settings.notifications');
  const tc = useTranslations('common');
  const session = useSession();
  const EMPTY_DRAFT: NotificationChannel = {
    id: '',
    name: '',
    type: 'slack',
    url: '',
    condition: 'has_failures_or_recovered',
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<NotificationChannel>(EMPTY_DRAFT);
  const isEditingChannel = !!draft.id;

  const [logOpen, setLogOpen] = useState(false);
  const [entries, setEntries] = useState<DeliveryLogEntry[] | null>(null);

  // Loaded eagerly (not lazily on toggle) — the footer aggregate and the
  // per-channel "last delivery" column both need it up front.
  useEffect(() => {
    const apiToken = session?.data?.user?.apiToken;
    const headers: HeadersInit = apiToken ? { Authorization: apiToken } : {};

    fetch(withBase(`/api/notifications/log?t=${Date.now()}`), { headers, cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => setEntries(data.entries ?? []))
      .catch(() => setEntries([]));
  }, [session?.data?.user?.apiToken]);

  const lastByChannel = useMemo(() => {
    const map = new Map<string, DeliveryLogEntry>();

    for (const entry of entries ?? []) {
      // entries are assumed newest-first; first sighting per channel wins.
      if (!map.has(entry.channel)) map.set(entry.channel, entry);
    }

    return map;
  }, [entries]);

  const summary24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = (entries ?? []).filter((e) => new Date(e.at).getTime() >= cutoff);

    return {
      sent: recent.filter((e) => e.outcome === 'sent').length,
      skipped: recent.filter((e) => e.outcome === 'skipped').length,
      error: recent.filter((e) => e.outcome === 'error').length,
    };
  }, [entries]);

  const openAdd = () => {
    setDraft(EMPTY_DRAFT);
    setIsModalOpen(true);
  };

  const openEdit = (channel: NotificationChannel) => {
    setDraft(channel);
    setIsModalOpen(true);
  };

  const submitChannel = () => {
    if (!draft.name.trim() || !draft.url.trim()) {
      toast.error(t('required'));

      return;
    }
    const channel = {
      ...draft,
      name: draft.name.trim(),
      url: draft.url.trim(),
      project: draft.project?.trim() || undefined,
    };

    if (isEditingChannel) {
      onSave({ ...config, channels: config.channels.map((c) => (c.id === channel.id ? channel : c)) });
    } else {
      onSave({ ...config, channels: [...config.channels, { ...channel, id: crypto.randomUUID(), enabled: true }] });
    }
    setIsModalOpen(false);
    setDraft(EMPTY_DRAFT);
  };

  const labelClasses = { label: 'text-[10px] uppercase tracking-wide', inputWrapper: 'h-8 min-h-8' };

  return (
    <section className="scroll-mt-3 overflow-hidden rounded-xl border border-divider bg-content1" id="notifications">
      <div className="flex h-10 items-center gap-2 border-b border-divider px-4">
        <Bell className="text-primary" size={15} />
        <span className="text-[13px] font-semibold">{t('title')}</span>
        <span
          className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ${
            config.enabled ? 'bg-success/15 text-success' : 'bg-default-100 text-default-500'
          }`}
        >
          {config.enabled ? tc('enabled') : tc('disabled')}
        </span>
        <div className="ml-auto flex items-center gap-2.5">
          <Switch
            isDisabled={isSaving}
            isSelected={config.enabled}
            size="sm"
            onValueChange={(enabled) => onSave({ ...config, enabled })}
          />
          <Button className="h-[26px] min-w-0 px-2.5 text-xs" color="primary" size="sm" onPress={openAdd}>
            {t('addChannel')}
          </Button>
        </div>
      </div>

      {config.channels.length === 0 ? (
        <p className="p-4 text-[12.5px] italic text-default-500">{t('noChannels')}</p>
      ) : (
        <div className="w-full overflow-x-auto">
          <div className="min-w-max">
            {config.channels.map((channel) => {
              const isOn = channel.enabled !== false;
              const last = lastByChannel.get(channel.name);

              return (
                <div
                  key={channel.id}
                  className={`grid h-[46px] items-center gap-2 border-b border-divider px-3 last:border-0 ${
                    isOn ? '' : 'opacity-55'
                  }`}
                  style={{ gridTemplateColumns: TEMPLATE }}
                >
                  <span className="flex h-[24px] w-[24px] items-center justify-center rounded bg-default-100">
                    {channel.type === 'slack' ? <SlackIcon size={14} /> : <WebhookRowIcon />}
                  </span>
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-[12.5px] font-medium">{channel.name}</p>
                    <p className="truncate font-mono text-[10.5px] text-default-400">{channel.url}</p>
                  </div>
                  <span className="w-fit rounded-md bg-default-100 px-1.5 py-0.5 text-[10.5px] text-default-600">
                    {channel.type === 'slack' ? 'Slack' : 'Webhook'}
                  </span>
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-[12px]">
                      {t(`conditions.${channel.condition}`)}
                      {channel.type === 'slack' && channel.includeAiSummary ? t('withAi') : ''}
                    </p>
                    {channel.project && <p className="truncate text-[10.5px] text-default-400">{channel.project}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {last ? (
                      <>
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: OUTCOME_DOT[last.outcome] }}
                        />
                        <span className="truncate text-default-500">
                          {last.outcome === 'error'
                            ? t('error', { detail: last.detail })
                            : formatAgo(new Date(last.at), ago)}
                        </span>
                      </>
                    ) : (
                      <span className="text-default-400">—</span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    <Switch
                      isSelected={isOn}
                      size="sm"
                      onValueChange={(enabled) =>
                        onSave({
                          ...config,
                          channels: config.channels.map((c) => (c.id === channel.id ? { ...c, enabled } : c)),
                        })
                      }
                    />
                    <Button
                      className="h-[26px] min-w-0 px-2 text-[11px]"
                      size="sm"
                      variant="flat"
                      onPress={() => openEdit(channel)}
                    >
                      {t('edit')}
                    </Button>
                    <Button
                      isIconOnly
                      aria-label={t('deleteChannel')}
                      className="h-[26px] w-[26px] min-w-0"
                      size="sm"
                      variant="light"
                      onPress={() =>
                        onSave({ ...config, channels: config.channels.filter((c) => c.id !== channel.id) })
                      }
                    >
                      <Trash2 className="text-default-400 hover:text-danger" size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="border-t border-divider px-4 py-2.5">
        <button
          className="inline-flex items-center gap-1 text-[12px] text-default-500 hover:text-foreground"
          type="button"
          onClick={() => setLogOpen((v) => !v)}
        >
          {logOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {t('log')}
          {entries && (
            <span className="ml-1 font-mono text-[11px] text-default-400">
              {t('log24h', { sent: summary24h.sent, skipped: summary24h.skipped, error: summary24h.error })}
            </span>
          )}
        </button>

        {logOpen && (
          <div className="mt-2 flex max-h-[280px] flex-col gap-1 overflow-y-auto">
            {entries === null && <BlockSkeleton lines={3} />}
            {entries?.length === 0 && <p className="text-[11.5px] text-default-400">{t('noEntries')}</p>}
            {entries?.map((entry, index) => (
              <div key={`${entry.at}-${index}`} className="flex items-start gap-2 py-1 text-[11.5px]">
                <span className="w-[130px] shrink-0 text-default-400">{new Date(entry.at).toLocaleString(intl)}</span>
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full mt-1"
                  style={{ backgroundColor: OUTCOME_DOT[entry.outcome] }}
                />
                <span className="shrink-0 font-medium">{entry.channel}</span>
                <span className="text-default-500">{entry.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} size="lg" onOpenChange={setIsModalOpen}>
        <ModalContent>
          <ModalHeader className="flex-col gap-1">
            {isEditingChannel ? t('editChannel') : t('addChannel')}
            <p className="text-sm font-normal text-default-500">{t('modalDescription')}</p>
          </ModalHeader>
          <ModalBody className="gap-3">
            <Select
              classNames={labelClasses}
              label={t('type')}
              labelPlacement="outside"
              selectedKeys={[draft.type]}
              size="sm"
              onSelectionChange={(keys) => {
                const type = Array.from(keys)[0] as NotificationChannel['type'];

                if (type) setDraft({ ...draft, type });
              }}
            >
              <SelectItem key="slack">Slack (incoming webhook)</SelectItem>
              <SelectItem key="webhook">Webhook (POST JSON)</SelectItem>
            </Select>
            <Input
              classNames={labelClasses}
              label={t('name')}
              labelPlacement="outside"
              placeholder="#automation-tests"
              size="sm"
              value={draft.name}
              onValueChange={(name) => setDraft({ ...draft, name })}
            />
            <Input
              classNames={labelClasses}
              description={draft.type === 'slack' ? t('slackHint') : t('webhookHint')}
              label={draft.type === 'slack' ? t('slackUrl') : t('webhookUrl')}
              labelPlacement="outside"
              placeholder="https://hooks.slack.com/services/..."
              size="sm"
              value={draft.url}
              onValueChange={(url) => setDraft({ ...draft, url })}
            />
            <Select
              classNames={labelClasses}
              description={t('conditionHint')}
              label={t('whenToSend')}
              labelPlacement="outside"
              selectedKeys={[draft.condition]}
              size="sm"
              onSelectionChange={(keys) => {
                const condition = Array.from(keys)[0] as NotificationChannel['condition'];

                if (condition) setDraft({ ...draft, condition });
              }}
            >
              {CONDITIONS.map((key) => ({ key, label: t(`conditions.${key}`) })).map(({ key, label }) => (
                <SelectItem key={key}>{label}</SelectItem>
              ))}
            </Select>
            <Input
              classNames={labelClasses}
              description={t('projectFilterHint')}
              label={t('projectFilter')}
              labelPlacement="outside"
              size="sm"
              value={draft.project ?? ''}
              onValueChange={(project) => setDraft({ ...draft, project: project || undefined })}
            />
            {draft.type === 'slack' && (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-divider px-3 py-2">
                <div className="flex flex-col">
                  <span className="text-[12.5px]">{t('includeAi')}</span>
                  <span className="text-[11px] text-default-500">{t('includeAiHint')}</span>
                </div>
                <Switch
                  isSelected={!!draft.includeAiSummary}
                  size="sm"
                  onValueChange={(includeAiSummary) => setDraft({ ...draft, includeAiSummary })}
                />
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={() => setIsModalOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button color="primary" isLoading={isSaving} onPress={submitChannel}>
              {isEditingChannel ? tc('save') : tc('add')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </section>
  );
};

export default NotificationsCard;
