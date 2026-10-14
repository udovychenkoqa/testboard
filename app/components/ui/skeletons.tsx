import { Skeleton } from '@heroui/react';

// Skeleton rows for the CSS-grid tables (Reports/Results/Run Tests history).
export const GridSkeleton: React.FC<{ rows?: number; rowHeight?: number }> = ({ rows = 8, rowHeight = 52 }) => (
  <div className="w-full">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 px-3 border-b border-divider" style={{ height: rowHeight }}>
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-3.5 flex-1 rounded-md" />
        <Skeleton className="h-3.5 w-20 rounded-md" />
        <Skeleton className="h-3.5 w-24 rounded-md" />
        <Skeleton className="h-3.5 w-16 rounded-md" />
      </div>
    ))}
  </div>
);

const SkeletonCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-lg border border-divider bg-content1 p-4">{children}</div>
);

// Mirrors the Trends page layout (stat cards → run health → sparklines →
// pass-rate chart) so nothing jumps when the data lands.
export const TrendsSkeleton: React.FC = () => (
  <div className="flex flex-col gap-4">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[55, 65, 50, 60].map((w) => (
        <SkeletonCard key={w}>
          <Skeleton className="h-2.5 rounded-md" style={{ width: `${w}%` }} />
          <Skeleton className="h-7 w-2/5 rounded-md mt-2" />
        </SkeletonCard>
      ))}
    </div>
    <SkeletonCard>
      <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
        <div className="min-w-[150px]">
          <Skeleton className="h-2.5 w-20 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md mt-2" />
          <Skeleton className="h-2.5 w-28 rounded-md mt-2" />
          <Skeleton className="h-5 w-28 rounded-full mt-2.5" />
        </div>
        <Skeleton className="h-10 flex-1 min-w-[260px] rounded-full" />
      </div>
    </SkeletonCard>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {[40, 30, 30].map((w, i) => (
        <SkeletonCard key={i}>
          <Skeleton className="h-2.5 rounded-md mb-2" style={{ width: `${w}%` }} />
          <Skeleton className="h-[80px] w-full rounded-md" />
        </SkeletonCard>
      ))}
    </div>
    <SkeletonCard>
      <Skeleton className="h-2.5 w-1/3 rounded-md mb-3" />
      <Skeleton className="h-[240px] w-full rounded-md" />
    </SkeletonCard>
  </div>
);

// Settings section cards: a header strip plus a few setting rows each.
export const SettingsSkeleton: React.FC = () => (
  <div className="flex flex-col gap-4">
    {[3, 2, 3].map((rows, i) => (
      <div key={i} className="rounded-lg border border-divider bg-content1">
        <div className="flex items-center justify-between border-b border-divider px-4 py-3">
          <Skeleton className="h-3.5 w-28 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
        {Array.from({ length: rows }).map((_, j) => (
          <div
            key={j}
            className="flex items-center justify-between gap-4 border-b border-divider px-4 py-3 last:border-0"
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-1/3 rounded-md" />
              <Skeleton className="h-2.5 w-2/3 rounded-md" />
            </div>
            <Skeleton className="h-6 w-24 rounded-md" />
          </div>
        ))}
      </div>
    ))}
  </div>
);

// Three grey blocks for the verdict strip / AI summary while loading.
export const BlockSkeleton: React.FC<{ lines?: number; className?: string }> = ({ lines = 3, className }) => (
  <div className={`flex flex-col gap-2 ${className ?? ''}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className="h-4 rounded-md" style={{ width: `${90 - i * 12}%` }} />
    ))}
  </div>
);
