import { Suspense } from 'react';

import RunTests from '@/app/components/run-tests';
import { PageLoader } from '@/app/components/ui/page-loader';

// Autotest triggering (GitLab pipelines) — any signed-in user; /api/autotests/trigger is
// gated by the run:tests capability.
export default function AutomatedRunsPage() {
  // RunTests reads ?cases=… (useSearchParams), which needs a suspense boundary.
  return (
    <Suspense fallback={<PageLoader />}>
      <RunTests embedded />
    </Suspense>
  );
}
