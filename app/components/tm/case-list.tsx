'use client';

import { Checkbox } from '@heroui/react';

import { AutomationBadge, PriorityBadge } from '@/app/components/tm/badges';
import type { CaseListItem } from '@/app/lib/tm/cases';

interface CaseListProps {
  cases: CaseListItem[];
  selected: Set<number>;
  activeId: number | null;
  canEdit: boolean;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  onOpen: (id: number) => void;
}

export const CaseList: React.FC<CaseListProps> = ({ cases, selected, activeId, canEdit, onToggle, onToggleAll, onOpen }) => (
  <ul className="flex flex-col divide-y divide-divider rounded-lg border border-divider bg-content1">
    {canEdit && (
      <li className="flex h-9 items-center gap-3 px-3">
        <Checkbox
          isIndeterminate={selected.size > 0 && selected.size < cases.length}
          isSelected={cases.length > 0 && selected.size === cases.length}
          size="sm"
          onValueChange={onToggleAll}
        />
      </li>
    )}
    {cases.map((c) => (
      <li
        key={c.id}
        className={`flex min-h-[44px] cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-default-50 ${
          activeId === c.id ? 'bg-primary/5' : ''
        } ${c.status === 'deprecated' ? 'opacity-60' : ''}`}
        onClick={() => onOpen(c.id)}
      >
        {canEdit && (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox isSelected={selected.has(c.id)} size="sm" onValueChange={() => onToggle(c.id)} />
          </div>
        )}
        <span className="w-16 shrink-0 font-mono text-[11.5px] text-default-400">{c.label}</span>
        <span className={`min-w-[96px] flex-1 truncate text-[13px] ${c.status === 'draft' ? 'italic' : ''}`}>{c.title}</span>
        <div className="hidden shrink-0 items-center gap-1 md:flex">
          {c.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-md bg-default-100 px-1.5 py-px text-[11px] text-default-500">
              {tag}
            </span>
          ))}
        </div>
        <div className="hidden w-[118px] shrink-0 justify-end sm:flex">
          <AutomationBadge value={c.automation} />
        </div>
        <div className="flex w-[78px] shrink-0 justify-end">
          <PriorityBadge value={c.priority} />
        </div>
      </li>
    ))}
  </ul>
);
