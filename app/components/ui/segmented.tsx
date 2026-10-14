'use client';

interface SegmentedOption<T extends string> {
  key: T;
  label: React.ReactNode;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

// Compact segmented control (Failures · All · By file, etc). ~24px tall.
export function Segmented<T extends string>({ options, value, onChange, className }: SegmentedProps<T>) {
  return (
    <div className={`inline-flex gap-0.5 rounded-lg bg-default-100 p-0.5 ${className ?? ''}`} role="tablist">
      {options.map((opt) => {
        const active = opt.key === value;

        return (
          <button
            key={opt.key}
            aria-selected={active}
            className={`h-[24px] rounded-md px-2.5 text-[11.5px] transition-colors ${
              active ? 'bg-content1 font-semibold text-foreground shadow-sm' : 'text-default-500 hover:text-foreground'
            }`}
            role="tab"
            type="button"
            onClick={() => onChange(opt.key)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
