import { Skeleton } from '@heroui/react';

// Loading placeholder for tables — a few shimmering rows instead of a lone
// spinner, so the layout doesn't jump when data arrives.
export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => (
  <div className="w-full flex flex-col gap-3 py-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton className="h-4 w-16 rounded-md" />
        <Skeleton className="h-4 flex-1 rounded-md" />
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-4 w-20 rounded-md" />
      </div>
    ))}
  </div>
);
