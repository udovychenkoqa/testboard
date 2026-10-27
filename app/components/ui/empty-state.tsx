import { type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: 'default' | 'success';
}

// Centered empty/success state: an icon tile with two faint "stacked cards"
// behind it, a title, a short explanation and optional action buttons.
export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action, tone = 'default' }) => {
  const tile =
    tone === 'success'
      ? 'bg-success/10 text-success ring-success/20'
      : 'bg-primary/10 text-primary ring-primary/20 dark:bg-primary/15';

  return (
    <div className="rr-enter flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      {Icon && (
        <div aria-hidden className="relative h-16 w-16">
          <span className="absolute inset-0 -translate-x-2.5 translate-y-0.5 -rotate-[12deg] rounded-2xl border border-default-200 bg-content1" />
          <span className="absolute inset-0 translate-x-2.5 translate-y-0.5 rotate-[9deg] rounded-2xl border border-default-200 bg-content1" />
          {/* Opaque base so the rotated cards don't show through the tint. */}
          <span className="absolute inset-0 rounded-2xl bg-content1 shadow-sm" />
          <span className={`absolute inset-0 flex items-center justify-center rounded-2xl ring-1 ${tile}`}>
            <Icon size={26} strokeWidth={1.75} />
          </span>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <p className="text-[15px] font-semibold text-foreground">{title}</p>
        {description && <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-default-500">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
};
