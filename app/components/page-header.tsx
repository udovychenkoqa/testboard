import { type ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  // Muted mono subtitle (e.g. "42 total · 1.2 GB") or a breadcrumb node.
  subtitle?: ReactNode;
  actions?: ReactNode;
}

// Shared 52px page header — every screen opens with this.
export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => (
  <header className="h-[52px] shrink-0 flex items-center justify-between gap-4 px-5 border-b border-divider">
    <div className="flex items-center gap-3 min-w-0">
      <h1 className="text-[15px] font-semibold tracking-[-0.01em] truncate">{title}</h1>
      {subtitle && <span className="font-mono text-xs text-default-400 truncate">{subtitle}</span>}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </header>
);
