'use client';

import { useTranslations } from 'next-intl';

// Full-area loader: the Testboard mark with its trend line drawing in, centred
// in the content area. Animations live in globals.css (rr-loader-*), with a
// plain pulse under prefers-reduced-motion.
export const PageLoader: React.FC<{ label?: string }> = ({ label }) => {
  const t = useTranslations('common');

  return (
    <div aria-busy="true" className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-3" role="status">
      <svg aria-hidden className="rr-loader" fill="none" height={44} viewBox="0 0 64 64" width={44}>
        <rect className="fill-[#4f46e5] dark:fill-[#6366f1]" height="64" rx="14" width="64" />
        <polyline
          className="rr-loader-line"
          pathLength={100}
          points="12,44 24,32 34,39 48,20"
          stroke="#ffffff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="6"
        />
        <circle className="rr-loader-dot" cx="48" cy="20" fill="#97C459" r="6" />
      </svg>
      <span className={label ? 'text-xs text-default-400' : 'sr-only'}>{label ?? t('loading')}</span>
    </div>
  );
};
