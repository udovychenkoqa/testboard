'use client';

import PageLayout from '@/app/components/page-layout';
import Reports from '@/app/components/reports';

export default function ReportsPage() {
  return <PageLayout render={({ info, onUpdate }) => <Reports info={info} onChange={onUpdate} />} />;
}
