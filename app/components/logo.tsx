// Brand mark only — an upward trend line ending in a passing (green) point on
// an indigo tile. The "Testboard" wordmark lives as HTML text in the sidebar
// (see aside.tsx).
export const Logo: React.FC<{ size?: number }> = ({ size = 26 }) => (
  <svg fill="none" height={size} viewBox="0 0 64 64" width={size} xmlns="http://www.w3.org/2000/svg">
    <rect className="fill-[#4f46e5] dark:fill-[#6366f1]" height="64" rx="14" width="64" />
    <polyline
      points="12,44 24,32 34,39 48,20"
      stroke="#ffffff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="6"
    />
    <circle cx="48" cy="20" fill="#97C459" r="6" />
  </svg>
);
