'use client';

import { Server, Trash2, Zap, Bell, Users, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface Section {
  // Label comes from messages: settings.rail.<id>
  id: 'server' | 'cleanup' | 'automation' | 'notifications' | 'users';
  icon: LucideIcon;
  count?: number;
}

export const SECTIONS: Section[] = [
  { id: 'server', icon: Server },
  { id: 'cleanup', icon: Trash2 },
  { id: 'automation', icon: Zap },
  { id: 'notifications', icon: Bell },
  { id: 'users', icon: Users },
];

// Row height (h-8) + gap (gap-0.5) — the active pill slides by this step.
const ROW_STEP = 34;

interface SectionRailProps {
  activeSection: string;
  counts?: Record<string, number>;
  onNavigate: (id: string) => void;
}

export function SectionRail({ activeSection, counts, onNavigate }: Readonly<SectionRailProps>) {
  const t = useTranslations('settings.rail');
  const activeIndex = Math.max(
    0,
    SECTIONS.findIndex((s) => s.id === activeSection),
  );

  return (
    <nav aria-label={t('aria')} className="w-[188px] shrink-0 border-r border-divider p-4 px-3">
      <p className="mb-1 px-2 text-[10px] uppercase tracking-[.12em] text-default-400">{t('onThisPage')}</p>
      <ul className="relative flex flex-col gap-0.5">
        {/* One pill that glides between rows instead of each row toggling its own background. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-8 rounded-lg bg-primary/10 transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateY(${activeIndex * ROW_STEP}px)` }}
        >
          <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary" />
        </span>
        {SECTIONS.map((section) => {
          const active = activeSection === section.id;
          const Icon = section.icon;
          const count = counts?.[section.id];

          return (
            <li key={section.id} className="relative">
              <button
                aria-current={active ? 'location' : undefined}
                className={`flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors ${
                  active ? 'text-primary' : 'text-default-600 hover:bg-default-100'
                }`}
                type="button"
                onClick={() => onNavigate(section.id)}
              >
                <Icon size={14} />
                <span className="truncate">{t(section.id)}</span>
                {count !== undefined && (
                  <span
                    className={`ml-auto font-mono text-[10.5px] tabular-nums ${active ? 'text-primary' : 'text-default-400'}`}
                  >
                    {count}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
