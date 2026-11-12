'use client';

import { useCan } from '@/app/hooks/useCan';
import { CAPABILITIES } from '@/app/lib/access';

// Whether to show test-management edit controls (see useCan).
export const useCanManageCases = (): boolean => useCan(CAPABILITIES.manageCases);
