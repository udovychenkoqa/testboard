'use client';

import { useQuery as useTanStackQuery, UseQueryOptions } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { withQueryParams } from '../lib/network';
import { withBase } from '../lib/url';

import { useAuthConfig } from './useAuthConfig';
import { useApiErrorToast } from './useApiErrorToast';

const useQuery = <ReturnType>(
  path: string,
  options?: Omit<UseQueryOptions<ReturnType, Error>, 'queryKey' | 'queryFn'> & {
    dependencies?: unknown[];
    callback?: string;
    method?: string;
    body?: BodyInit | null;
  },
) => {
  const session = useSession();
  const router = useRouter();
  const { authRequired } = useAuthConfig();
  const showApiError = useApiErrorToast();
  const t = useTranslations('errors');

  useEffect(() => {
    // Don't redirect if auth is not required
    if (authRequired === false) {
      return;
    }

    // Don't redirect if we haven't determined auth requirements yet
    if (authRequired === null) {
      return;
    }

    if (session.status === 'unauthenticated') {
      // One toast however many queries on the page notice the expired session.
      toast.warning(t('unauthorized'), { id: 'unauthorized' });
      router.push(
        withQueryParams(
          withBase('/login'),
          options?.callback ? { callbackUrl: encodeURI(options.callback) } : { callbackUrl: encodeURI(withBase()) },
        ),
      );

      return;
    }

    if (session.status === 'loading') {
      return;
    }
  }, [session.status, authRequired]);

  return useTanStackQuery<ReturnType, Error>({
    queryKey: [path, ...(options?.dependencies ?? [])],
    queryFn: async () => {
      const headers: HeadersInit = {};

      if (session.data?.user?.apiToken) {
        headers.Authorization = session.data.user.apiToken;
      }

      const fullPath = withBase(path);
      const response = await fetch(fullPath, {
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
        method: options?.method ?? 'GET',
      });

      if (!response.ok && response.status !== 401) {
        // Read the body once — a second response.text() throws and hides the real error.
        const body = await response.text();

        showApiError(response.status, body);
        throw new Error(`Request failed (${response.status}): ${body}`);
      }

      return response.json();
    },
    enabled: authRequired === false || session.status === 'authenticated',
    ...options,
  });
};

export default useQuery;
