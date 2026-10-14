import { Suspense } from 'react';

import ReportAnalytics from '@/app/components/report-analytics';

export default function TrendsPage() {
  // Suspense — useSearchParams() у клієнтському компоненті вимагає boundary при SSR.
  return (
    <Suspense>
      <ReportAnalytics />
    </Suspense>
  );
}
