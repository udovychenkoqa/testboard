'use client';

import { FC } from 'react';
import { useTheme } from 'next-themes';
import { useIsSSR } from '@react-aria/ssr';
import { Sun, Moon } from 'lucide-react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';

export interface ThemeSwitchProps {
  className?: string;
}

// Segmented pill toggle (sun / moon). Small enough to live inside the user
// dropdown as well as standalone.
export const ThemeSwitch: FC<ThemeSwitchProps> = ({ className }) => {
  const t = useTranslations('themeSwitch');
  const { theme: themeName, setTheme } = useTheme();
  const isSSR = useIsSSR();

  const theme = themeName?.replace('-mode', '');
  const isLight = theme === 'light' || isSSR;

  const segment = (active: boolean) =>
    clsx(
      'flex items-center justify-center h-6 w-7 rounded-full transition-colors cursor-pointer',
      active ? 'bg-content1 text-foreground shadow-sm' : 'bg-transparent text-default-500 hover:text-default-700',
    );

  return (
    <div
      aria-label={t('theme')}
      className={clsx('inline-flex items-center gap-0.5 rounded-full bg-default-200 p-0.5', className)}
      role="group"
    >
      <button
        aria-label={t('light')}
        aria-pressed={isLight}
        className={segment(isLight)}
        type="button"
        onClick={() => setTheme('light-mode')}
      >
        <Sun size={14} />
      </button>
      <button
        aria-label={t('dark')}
        aria-pressed={!isLight}
        className={segment(!isLight)}
        type="button"
        onClick={() => setTheme('dark-mode')}
      >
        <Moon size={14} />
      </button>
    </div>
  );
};
