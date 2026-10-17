'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

import { PageHeader } from '@/app/components/page-header';
import { Segmented } from '@/app/components/ui/segmented';

type Tab = 'manual' | 'automated';

// Test Runs: manual runs (test management) and automated runs (Drone) share
// one page header with a tab switch.
export default function RunsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const t = useTranslations('tm.runs');
  const pathname = usePathname();
  const router = useRouter();
  const tab: Tab = pathname?.startsWith('/runs/automated') ? 'automated' : 'manual';

  return (
    <div className="flex flex-col rr-enter">
      <PageHeader
        actions={
          <Segmented
            options={[
              { key: 'manual', label: t('manual') },
              { key: 'automated', label: t('automated') },
            ]}
            value={tab}
            onChange={(next: Tab) => router.push(`/runs/${next}`)}
          />
        }
        title={t('title')}
      />
      {children}
    </div>
  );
}
