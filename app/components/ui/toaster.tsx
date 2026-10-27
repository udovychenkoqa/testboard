'use client';

import { Toaster as SonnerToaster } from 'sonner';
import { CircleAlert, CircleCheck, Info, Loader2, TriangleAlert } from 'lucide-react';

// App-styled toasts: a card like the rest of the UI (content1 surface,
// hairline border, shadow) with a status-coloured left edge and icon instead
// of sonner's full pastel fill. Status colours are the theme tokens, so light
// and dark both follow the Testboard palette. Sonner positions toasts
// absolutely itself — don't add `relative` here.
export const Toaster: React.FC = () => (
  <SonnerToaster
    closeButton
    gap={8}
    icons={{
      success: <CircleCheck className="text-success" size={18} />,
      error: <CircleAlert className="text-danger" size={18} />,
      warning: <TriangleAlert className="text-warning" size={18} />,
      info: <Info className="text-primary" size={18} />,
      loading: <Loader2 className="animate-spin text-default-400" size={18} />,
    }}
    position="bottom-right"
    toastOptions={{
      unstyled: true,
      classNames: {
        toast:
          'group flex w-[var(--width)] items-start gap-3 rounded-lg border border-divider border-l-[3px] bg-content1 py-3 pl-3.5 pr-9 text-foreground shadow-lg',
        icon: 'mt-px flex shrink-0 items-center',
        content: 'flex min-w-0 flex-col gap-0.5',
        title: 'text-[13px] font-semibold leading-snug',
        description: 'break-words text-[12px] leading-snug text-default-500',
        closeButton:
          '!left-auto !right-2 !top-2 !transform-none flex h-6 w-6 !border-0 !bg-transparent items-center justify-center rounded-md text-default-400 transition-colors hover:bg-default-100 hover:text-foreground [&>svg]:h-3 [&>svg]:w-3',
        actionButton:
          'ml-auto shrink-0 self-center rounded-md bg-primary px-2.5 py-1 text-[12px] font-medium text-primary-foreground',
        success: 'border-l-success',
        error: 'border-l-danger',
        warning: 'border-l-warning',
        info: 'border-l-primary',
      },
    }}
    visibleToasts={3}
  />
);
