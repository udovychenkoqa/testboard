'use client';

import { useSession } from 'next-auth/react';

import { useAuthConfig } from '@/app/hooks/useAuthConfig';
import { ROLES } from '@/app/lib/access';

// Whether to show test-management edit controls. The API enforces the same
// rule (manage:cases); this only hides buttons a viewer couldn't use anyway.
export const useCanManageCases = (): boolean => {
  const { data: session } = useSession();
  const { authRequired } = useAuthConfig();
  const role = session?.user?.role;

  return authRequired === false || role === ROLES.admin || role === ROLES.tester;
};
