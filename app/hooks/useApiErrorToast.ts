'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { describeApiError } from '@/app/lib/api-error';

// Shows a failed API response as a titled toast in the UI language instead
// of the raw response body.
export const useApiErrorToast = () => {
  const t = useTranslations('errors');

  return useCallback(
    (status: number, body: string) => {
      const { kind, detail } = describeApiError(status, body);
      // Same failure from several queries/retries collapses into one toast.
      const id = `api-error:${kind}:${detail ?? ''}`;

      if (kind === 'unreachable') {
        toast.error(t('unreachableTitle'), { id, description: t('unreachableDescription') });
      } else if (kind === 'forbidden') {
        toast.error(t('forbiddenTitle'), { id, description: t('forbiddenDescription') });
      } else {
        toast.error(t(kind === 'notFound' ? 'notFoundTitle' : 'serverTitle'), { id, description: detail });
      }
    },
    [t],
  );
};
