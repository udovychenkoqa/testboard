'use client';

import { Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import { ChevronDown } from 'lucide-react';

interface FilterChipProps {
  label: string;
  value?: React.ReactNode; // current selection, e.g. "All"
  children: React.ReactNode; // popover content (menu / picker)
  className?: string;
}

// Toolbar dropdown-chip: "Project: All ▾". 30px, opens a popover with content.
export const FilterChip: React.FC<FilterChipProps> = ({ label, value, children, className }) => (
  <Popover placement="bottom-start">
    <PopoverTrigger>
      <button
        className={`inline-flex items-center gap-1.5 h-[30px] rounded-lg border border-default-200 bg-content1 px-2.5 text-xs text-default-600 transition-colors hover:bg-default-100 ${className ?? ''}`}
        type="button"
      >
        <span className="text-default-400">{label}:</span>
        <span className="font-medium text-foreground">{value}</span>
        <ChevronDown className="text-default-400" size={13} />
      </button>
    </PopoverTrigger>
    <PopoverContent className="p-1">{children}</PopoverContent>
  </Popover>
);
