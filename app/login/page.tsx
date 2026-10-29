import { Suspense } from 'react';

import LoginForm from '@/app/components/login-form';
import { PageLoader } from '@/app/components/ui/page-loader';

export default async function LoginPage() {
  // useSearchParams() should be wrapped in a suspense boundary.
  // Read more: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
  return (
    <Suspense fallback={<PageLoader />}>
      <LoginForm />
    </Suspense>
  );
}
