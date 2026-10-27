'use client';

import { useMutation as useTanStackMutation, UseMutationOptions } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

import { withBase } from '../lib/url';

import { useApiErrorToast } from './useApiErrorToast';

type MutationFnParams<TVariables> = {
  body?: TVariables;
  path?: string;
};

const useMutation = <TData = unknown, TVariables = unknown>(
  url: string,
  options?: Omit<UseMutationOptions<TData, Error, MutationFnParams<TVariables>>, 'mutationFn'> & {
    method?: string;
  },
) => {
  const session = useSession();
  const apiToken = session?.data?.user?.apiToken;
  const showApiError = useApiErrorToast();

  return useTanStackMutation<TData, Error, MutationFnParams<TVariables>>({
    mutationFn: async ({ body, path }: MutationFnParams<TVariables>) => {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (apiToken) {
        headers.Authorization = apiToken;
      }

      const fullPath = withBase(path ?? url);
      const response = await fetch(fullPath, {
        headers,
        body: body ? JSON.stringify(body) : undefined,
        method: options?.method ?? 'POST',
      });
      const respText = await response.text();

      if (!response.ok) {
        showApiError(response.status, respText);
        throw new Error(`Request failed (${response.status}): ${respText}`);
      }
      console.log(`[useMutation] response: ${respText}`);

      return JSON.parse(respText);
    },
    ...options,
  });
};

export default useMutation;
