'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';

export interface GridColumn {
  key: string;
  label?: React.ReactNode;
  sortable?: boolean;
  align?: 'start' | 'center' | 'end';
}

interface DataGridProps {
  // CSS grid-template-columns string, shared by header and every row.
  template: string;
  columns: GridColumn[];
  sortColumn?: string;
  sortDirection?: 'ascending' | 'descending';
  onSort?: (key: string) => void;
  children: React.ReactNode;
  className?: string;
}

const alignClass = (a?: GridColumn['align']) =>
  a === 'end' ? 'justify-end text-right' : a === 'center' ? 'justify-center text-center' : 'justify-start';

// Thin CSS-grid table: sticky header with click-to-sort + a body of GridRow.
// Replaces HeroUI Table where two-line cells / left accents are needed.
export const DataGrid: React.FC<DataGridProps> = ({
  template,
  columns,
  sortColumn,
  sortDirection,
  onSort,
  children,
  className,
}) => (
  <div className={`w-full overflow-x-auto ${className ?? ''}`}>
    <div className="min-w-max">
      <div
        className="grid items-center h-8 px-3 bg-content1 border-b border-divider sticky top-0 z-10"
        style={{ gridTemplateColumns: template }}
      >
        {columns.map((col) => {
          const active = sortColumn === col.key;

          return col.sortable ? (
            <button
              key={col.key}
              className={`flex items-center gap-1 text-[10px] uppercase tracking-[.1em] text-default-400 hover:text-default-600 ${alignClass(col.align)}`}
              type="button"
              onClick={() => onSort?.(col.key)}
            >
              {col.label}
              {active && (sortDirection === 'ascending' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
            </button>
          ) : (
            <div
              key={col.key}
              className={`flex items-center text-[10px] uppercase tracking-[.1em] text-default-400 ${alignClass(col.align)}`}
            >
              {col.label}
            </div>
          );
        })}
      </div>
      <div>{children}</div>
    </div>
  </div>
);

interface GridRowProps {
  template: string;
  accent?: string; // left border colour; falsy = transparent
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}

export const GridRow: React.FC<GridRowProps> = ({ template, accent, onClick, className, children }) => (
  <div
    className={`grid items-center px-3 border-b border-divider transition-colors ${
      onClick ? 'cursor-pointer hover:bg-default-50' : ''
    } ${className ?? ''}`}
    role={onClick ? 'button' : undefined}
    style={{ gridTemplateColumns: template, borderLeft: `2px solid ${accent || 'transparent'}` }}
    onClick={onClick}
  >
    {children}
  </div>
);
