'use client';

import { useQueryClient } from '@tanstack/react-query';

import useMutation from '@/app/hooks/useMutation';

// useMutation for /api/tm that refreshes every test-management query on success.
export const useTmMutation = <TData = unknown, TBody = unknown>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  onSuccess?: (data: TData) => void,
) => {
  const queryClient = useQueryClient();

  return useMutation<TData, TBody>(url, {
    method,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey.some((k) => typeof k === 'string' && k.startsWith('/api/tm')),
      });
      onSuccess?.(data);
    },
  });
};
