'use client';

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { FileText, FileBarChart, TrendingUp, CirclePlay, Settings, type LucideIcon } from 'lucide-react';

import { useAuthConfig } from '../hooks/useAuthConfig';

import { Logo } from '@/app/components/logo';
import { UserMenu } from '@/app/components/user-menu';
import useQuery from '@/app/hooks/useQuery';

interface ServerInfo {
  numOfReports: number;
  numOfResults: number;
}

interface BuildsResponse {
  enabled: boolean;
  builds?: { status: string }[];
}

interface NavEntry {
  href: string;
  labelKey: 'reports' | 'results' | 'trends' | 'runTests';
  icon: LucideIcon;
}

const NAV: NavEntry[] = [
  { href: '/reports', labelKey: 'reports', icon: FileText },
  { href: '/results', labelKey: 'results', icon: FileBarChart },
  { href: '/trends', labelKey: 'trends', icon: TrendingUp },
  { href: '/run-tests', labelKey: 'runTests', icon: CirclePlay },
];

export const Aside: React.FC = () => {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const session = useSession();
  const { authRequired } = useAuthConfig();
  const isAuthenticated = authRequired === false || session.status === 'authenticated';
  const isAdmin = authRequired === false || session.data?.user?.role === 'admin';

  const { data: serverInfo } = useQuery<ServerInfo>('/api/info', { enabled: isAuthenticated });
  const { data: projects } = useQuery<string[]>('/api/report/projects', { enabled: isAuthenticated });
  const { data: builds } = useQuery<BuildsResponse>('/api/autotests/builds?page=1', {
    enabled: isAuthenticated,
    refetchInterval: (query) =>
      query.state.data?.builds?.some((b) => b.status === 'running' || b.status === 'pending') ? 10_000 : 30_000,
  });

  const hasActiveBuild = !!builds?.builds?.some((b) => b.status === 'running' || b.status === 'pending');
  // Report detail highlights Reports.
  const isActive = (href: string) => pathname === href || (href === '/reports' && !!pathname?.startsWith('/report/'));

  const count = (href: string) =>
    href === '/reports' ? serverInfo?.numOfReports : href === '/results' ? serverInfo?.numOfResults : undefined;

  return (
    <aside className="w-[216px] shrink-0 h-full bg-content1 border-r border-divider flex flex-col p-3">
      {/* Brand */}
      <NextLink className="flex items-center gap-2.5 px-2 pb-5 pt-1" href="/reports">
        <Logo size={26} />
        <span className="text-sm font-semibold">Testboard</span>
      </NextLink>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5">
        {NAV.map(({ href, labelKey, icon: Icon }) => {
          const active = isActive(href);
          const c = count(href);

          return (
            <NextLink
              key={href}
              aria-disabled={!isAuthenticated}
              className={`flex items-center gap-2.5 h-[34px] rounded-lg px-2 transition-colors ${
                active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-default-100'
              } ${!isAuthenticated ? 'pointer-events-none opacity-50' : ''}`}
              href={href}
            >
              <Icon size={16} strokeWidth={1.7} />
              <span className="text-[13px] font-medium">{t(labelKey)}</span>
              {href === '/run-tests' && hasActiveBuild && (
                <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
              )}
              {c !== undefined && c > 0 && (
                <span className="ml-auto font-mono text-[11px] text-default-400 tabular-nums">{c}</span>
              )}
            </NextLink>
          );
        })}
      </nav>

      {/* Projects */}
      {!!projects?.length && (
        <div className="mt-5 flex flex-col gap-0.5">
          <p className="px-2 mb-1 text-[10px] uppercase tracking-[.12em] text-default-400">{t('projects')}</p>
          {projects.slice(0, 8).map((project) => (
            <div key={project} className="flex items-center gap-2.5 h-[30px] px-2">
              <span className="w-1.5 h-1.5 rounded-full bg-default-300 shrink-0" />
              <span className="text-[13px] text-default-600 truncate">{project}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer: settings (admin) + user */}
      <div className="mt-auto pt-4 border-t border-divider flex flex-col gap-0.5">
        {isAdmin && (
          <NextLink
            className={`flex items-center gap-2.5 h-[34px] rounded-lg px-2 transition-colors ${
              pathname === '/settings' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-default-100'
            }`}
            href="/settings"
          >
            <Settings size={16} strokeWidth={1.7} />
            <span className="text-[13px] font-medium">{t('settings')}</span>
          </NextLink>
        )}
        <UserMenu />
      </div>
    </aside>
  );
};
