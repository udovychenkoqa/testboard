'use client';

import { FC, useState } from 'react';
import { HeroUIProvider } from '@heroui/system';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { ThemeProviderProps } from 'next-themes/dist/types';
import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { withBase } from '../lib/url';

export const Providers: FC<ThemeProviderProps> = ({ children, ...themeProps }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
          },
        },
      }),
  );

  return (
    // HeroUI 2.7 re-runs a popover's open animation from its first frame when the overlay repositions
    // (~300 ms after opening) and again on close, so menus, selects and panels visibly flashed. Without the
    // animations they appear and disappear in place.
    <HeroUIProvider disableAnimation>
      <NextThemesProvider
        {...themeProps}
        // additional mapping to handle theme names from playwright trace view
        value={{
          'light-mode': 'light',
          'dark-mode': 'dark',
        }}
      >
        <QueryClientProvider client={queryClient}>
          <SessionProvider basePath={withBase('/api/auth')}>{children}</SessionProvider>
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </NextThemesProvider>
    </HeroUIProvider>
  );
};
