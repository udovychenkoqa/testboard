'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { SectionRail, SECTIONS } from './section-rail';
import { ServerCard } from './server-card';
import { CleanupCard, parseCron, buildCron, type ScheduleState } from './cleanup-card';
import { AutomationCard } from './automation-card';
import NotificationsCard, { type NotificationsConfig } from './notifications-card';
import { AccessCard } from './access-card';

import { withBase } from '@/app/lib/url';
import { PageHeader } from '@/app/components/page-header';
import { SettingsSkeleton } from '@/app/components/ui/skeletons';
import { useDateLabels } from '@/app/components/date-format';

interface ConfigResponse {
  title: string;
  authRequired?: boolean;
  dataStorage?: string;
  serverCache?: boolean;
  cron?: {
    resultExpireDays?: number;
    resultExpireCronSchedule?: string;
    reportExpireDays?: number;
    reportExpireCronSchedule?: string;
  };
}

interface ServerInfo {
  dataFolderSizeinMB: string;
  numOfResults: number;
  resultsFolderSizeinMB: string;
  numOfReports: number;
  reportsFolderSizeinMB: string;
  availableSpace?: string;
}

const EMPTY_NOTIFICATIONS: NotificationsConfig = { enabled: false, channels: [] };
const DEFAULT_RESULT_SCHEDULE: ScheduleState = { frequency: 'daily', time: '03:33', weekday: '1', raw: '' };
const DEFAULT_REPORT_SCHEDULE: ScheduleState = { frequency: 'daily', time: '04:44', weekday: '1', raw: '' };

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SaveIndicator: React.FC<{ state: SaveState; lastSavedAt: Date | null }> = ({ state, lastSavedAt }) => {
  const { intl } = useDateLabels();
  const t = useTranslations('settings.page');

  if (state === 'idle' && !lastSavedAt) return null;

  const dot = state === 'saving' ? 'bg-warning' : state === 'error' ? 'bg-danger' : 'bg-success';
  const label =
    state === 'saving'
      ? t('saving')
      : state === 'error'
        ? t('notSaved')
        : lastSavedAt
          ? t('saved', { time: lastSavedAt.toLocaleTimeString(intl, { hour: '2-digit', minute: '2-digit' }) })
          : null;

  if (!label) return null;

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-default-500">
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${state === 'saving' ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  );
};

export default function SettingsPage() {
  const t = useTranslations('settings.page');
  const session = useSession();
  const apiToken = session?.data?.user?.apiToken;

  const [isPending, setIsPending] = useState(true);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [envInfo, setEnvInfo] = useState<{ authRequired?: boolean; dataStorage?: string } | null>(null);

  const [resultExpireDays, setResultExpireDays] = useState('');
  const [resultEnabled, setResultEnabled] = useState(false);
  const [reportExpireDays, setReportExpireDays] = useState('');
  const [reportEnabled, setReportEnabled] = useState(false);
  const [resultSchedule, setResultSchedule] = useState<ScheduleState>(DEFAULT_RESULT_SCHEDULE);
  const [reportSchedule, setReportSchedule] = useState<ScheduleState>(DEFAULT_REPORT_SCHEDULE);
  const [isSavingCleanup, setIsSavingCleanup] = useState(false);

  const [notifications, setNotifications] = useState<NotificationsConfig>(EMPTY_NOTIFICATIONS);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [aiModel, setAiModel] = useState('claude-sonnet-5');
  const [isSavingAi, setIsSavingAi] = useState(false);

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const withIndicator = async (fn: () => Promise<void>) => {
    setSaveState('saving');
    try {
      await fn();
      setSaveState('saved');
      setLastSavedAt(new Date());
    } catch (error) {
      setSaveState('error');
      throw error;
    }
  };

  // Direct no-store fetch instead of useQuery: the '/api/config' query key is
  // shared with other components and a cached/stale response here silently
  // reverts the form to old values after a page refresh.
  const loadConfig = useCallback(async () => {
    const headers: HeadersInit = {};

    if (apiToken) headers.Authorization = apiToken;

    try {
      const response = await fetch(withBase(`/api/config?t=${Date.now()}`), { headers, cache: 'no-store' });

      if (!response.ok) throw new Error(await response.text());
      const config: ConfigResponse = await response.json();

      setEnvInfo({ authRequired: config.authRequired, dataStorage: config.dataStorage });

      const infoResponse = await fetch(withBase(`/api/info?t=${Date.now()}`), { headers, cache: 'no-store' });

      if (infoResponse.ok) setServerInfo(await infoResponse.json());

      const resultDays = config.cron?.resultExpireDays;
      const reportDays = config.cron?.reportExpireDays;

      setResultExpireDays(resultDays ? String(resultDays) : '');
      setResultEnabled(!!resultDays);
      setReportExpireDays(reportDays ? String(reportDays) : '');
      setReportEnabled(!!reportDays);
      if (config.cron?.resultExpireCronSchedule) setResultSchedule(parseCron(config.cron.resultExpireCronSchedule));
      if (config.cron?.reportExpireCronSchedule) setReportSchedule(parseCron(config.cron.reportExpireCronSchedule));
      setNotifications((config as { notifications?: NotificationsConfig }).notifications ?? EMPTY_NOTIFICATIONS);
      const aiConfig = (config as { ai?: { autoAnalyzeEnabled?: boolean; model?: string } }).ai;

      setAutoAnalyze(aiConfig?.autoAnalyzeEnabled !== false);
      setAiModel(aiConfig?.model || 'claude-sonnet-5');
    } catch (error) {
      toast.error(t('readFailed', { error: (error as Error).message }));
    } finally {
      setIsPending(false);
    }
  }, [apiToken]);

  useEffect(() => {
    if (session.status === 'loading') return;
    loadConfig();
  }, [loadConfig, session.status]);

  const persistCleanup = async (snapshot: {
    resultDays: string;
    resultEnabled: boolean;
    resultSchedule: ScheduleState;
    reportDays: string;
    reportEnabled: boolean;
    reportSchedule: ScheduleState;
  }) => {
    setResultExpireDays(snapshot.resultDays);
    setResultEnabled(snapshot.resultEnabled);
    setResultSchedule(snapshot.resultSchedule);
    setReportExpireDays(snapshot.reportDays);
    setReportEnabled(snapshot.reportEnabled);
    setReportSchedule(snapshot.reportSchedule);

    setIsSavingCleanup(true);
    try {
      await withIndicator(async () => {
        const form = new FormData();

        form.append('resultExpireDays', snapshot.resultEnabled ? snapshot.resultDays.trim() : '');
        form.append('resultExpireCronSchedule', buildCron(snapshot.resultSchedule));
        form.append('reportExpireDays', snapshot.reportEnabled ? snapshot.reportDays.trim() : '');
        form.append('reportExpireCronSchedule', buildCron(snapshot.reportSchedule));

        const headers: HeadersInit = {};

        if (apiToken) headers.Authorization = apiToken;

        const response = await fetch(withBase('/api/config'), { method: 'PATCH', body: form, headers });

        if (!response.ok) throw new Error(await response.text());
      });
    } catch (error) {
      toast.error(t('saveFailed', { error: (error as Error).message }));
    } finally {
      setIsSavingCleanup(false);
    }
  };

  const saveAi = async (next: { autoAnalyzeEnabled: boolean; model: string }) => {
    setIsSavingAi(true);
    try {
      await withIndicator(async () => {
        const form = new FormData();

        form.append('ai', JSON.stringify(next));
        const headers: HeadersInit = {};

        if (apiToken) headers.Authorization = apiToken;
        const response = await fetch(withBase('/api/config'), { method: 'PATCH', body: form, headers });

        if (!response.ok) throw new Error(await response.text());
        setAutoAnalyze(next.autoAnalyzeEnabled);
        setAiModel(next.model);
      });
    } catch (error) {
      toast.error(t('saveFailed', { error: (error as Error).message }));
    } finally {
      setIsSavingAi(false);
    }
  };

  const saveNotifications = async (next: NotificationsConfig) => {
    setIsSavingNotifications(true);
    try {
      await withIndicator(async () => {
        const form = new FormData();

        form.append('notifications', JSON.stringify(next));
        const headers: HeadersInit = {};

        if (apiToken) headers.Authorization = apiToken;

        const response = await fetch(withBase('/api/config'), { method: 'PATCH', body: form, headers });

        if (!response.ok) throw new Error(await response.text());
        setNotifications(next);
      });
    } catch (error) {
      toast.error(t('saveFailed', { error: (error as Error).message }));
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const [activeSection, setActiveSection] = useState('server');
  const scrollRef = useRef<HTMLDivElement>(null);
  // While a rail click is smooth-scrolling, the scroll-spy stays quiet so the
  // active item doesn't flicker through every section in between.
  const spyLockedRef = useRef(false);

  const navigateTo = useCallback((id: string, behavior: ScrollBehavior = 'smooth') => {
    const container = scrollRef.current;
    const target = document.getElementById(id);

    if (!container || !target) return;

    spyLockedRef.current = true;
    setActiveSection(id);
    window.history.replaceState(null, '', `#${id}`);

    const unlock = () => {
      spyLockedRef.current = false;
      container.removeEventListener('scrollend', unlock);
    };

    container.addEventListener('scrollend', unlock);
    // Fallback for browsers without `scrollend`, and for no-op scrolls.
    window.setTimeout(unlock, 900);
    container.scrollTo({ top: target.offsetTop - 12, behavior });

    // Re-trigger the flash even when clicking the same section twice.
    target.classList.remove('rr-flash');
    void target.offsetWidth;
    target.classList.add('rr-flash');
    target.addEventListener('animationend', () => target.classList.remove('rr-flash'), { once: true });
  }, []);

  useEffect(() => {
    const container = scrollRef.current;

    if (!container || isPending) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (spyLockedRef.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { root: container, rootMargin: '-20% 0px -60% 0px' },
    );

    for (const id of SECTIONS.map((s) => s.id)) {
      const el = document.getElementById(id);

      if (el) observer.observe(el);
    }

    // The last section can't reach the spy band, so the bottom of the page
    // counts as being on it.
    const onScroll = () => {
      if (spyLockedRef.current) return;
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 4) {
        setActiveSection(SECTIONS[SECTIONS.length - 1].id);
      }
    };

    container.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      container.removeEventListener('scroll', onScroll);
    };
  }, [serverInfo, isPending]);

  // Deep link: /settings#notifications opens on that section once it renders.
  useEffect(() => {
    if (isPending) return;
    const id = window.location.hash.slice(1);

    if (SECTIONS.some((s) => s.id === id)) navigateTo(id, 'auto');
  }, [isPending, navigateTo]);

  const [usersCount, setUsersCount] = useState(0);
  const counts = {
    notifications: notifications.channels.length,
    users: usersCount,
  };

  return (
    <div className="flex flex-col rr-enter">
      <PageHeader
        actions={<SaveIndicator lastSavedAt={lastSavedAt} state={saveState} />}
        subtitle={t('subtitle')}
        title={t('title')}
      />

      <div className="flex flex-1 overflow-hidden">
        <SectionRail activeSection={activeSection} counts={counts} onNavigate={navigateTo} />

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5">
          {isPending ? (
            <SettingsSkeleton />
          ) : (
            <div className="flex flex-col gap-4">
              <ServerCard envInfo={envInfo} serverInfo={serverInfo} />

              <CleanupCard
                isSaving={isSavingCleanup}
                reportDays={reportExpireDays}
                reportEnabled={reportEnabled}
                reportSchedule={reportSchedule}
                resultDays={resultExpireDays}
                resultEnabled={resultEnabled}
                resultSchedule={resultSchedule}
                onChange={persistCleanup}
              />

              <AutomationCard aiModel={aiModel} autoAnalyze={autoAnalyze} isSaving={isSavingAi} onChange={saveAi} />

              <NotificationsCard config={notifications} isSaving={isSavingNotifications} onSave={saveNotifications} />

              <AccessCard apiToken={apiToken} authRequired={envInfo?.authRequired} onCountChange={setUsersCount} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
