'use client';

import { useSession } from 'next-auth/react';

import { useAuthConfig } from '@/app/hooks/useAuthConfig';
import { can, type Capability } from '@/app/lib/access';

// Whether to show a control. The API enforces the same rule (middleware + access.ts); this only hides
// buttons the user couldn't use anyway. Open mode (no auth configured) allows everything.
export const useCan = (capability: Capability): boolean => {
  const { data: session } = useSession();
  const { authRequired } = useAuthConfig();

  return authRequired === false || can(session?.user?.role, capability);
};
