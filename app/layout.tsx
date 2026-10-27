import '@/app/styles/globals.css';
import { Metadata, Viewport } from 'next';
import clsx from 'clsx';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';

import { Providers } from './providers';

import { siteConfig } from '@/app/config/site';
import { fontSans, fontMono } from '@/app/config/fonts';
import { Aside } from '@/app/components/aside';
import { Toaster } from '@/app/components/ui/toaster';
import { withBase } from '@/app/lib/url';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');

  return {
    title: {
      default: siteConfig.name,
      template: `%s - ${siteConfig.name}`,
    },
    description: t('description'),
    icons: {
      // Favicon ships with the app (public/favicon.svg, lives in git) — the
      // old data-volume/config upload path is gone, branding changes go
      // through code review like everything else.
      icon: withBase('/favicon.svg'),
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  return {
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: 'white' },
      { media: '(prefers-color-scheme: dark)', color: 'black' },
    ],
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html suppressHydrationWarning lang={locale}>
      <head>
        <base href={withBase()} />
      </head>
      <body className={clsx('min-h-screen bg-background font-sans antialiased', fontSans.variable, fontMono.variable)}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers attribute="class" defaultTheme="dark">
            <div className="flex h-screen overflow-hidden">
              <Aside />
              <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
                {children}
                <Toaster />
              </main>
            </div>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
