'use client';

import type { CaseListItem } from '@/app/lib/tm/cases';
import type { SuiteNode } from '@/app/lib/tm/suites';

import { Fragment, useMemo, useState } from 'react';
import { Checkbox } from '@heroui/react';
import { useTranslations } from 'next-intl';

import { AutomationBadge, PriorityBadge } from '@/app/components/tm/badges';
import { CASE_DRAG_TYPE } from '@/app/lib/tm/constants';
import { groupBySuite } from '@/app/lib/tm/suite-groups';

interface CaseListProps {
  cases: CaseListItem[];
  // Used to group the list under suite headers when it spans more than one suite.
  suites: SuiteNode[];
  selected: Set<number>;
  activeId: number | null;
  canEdit: boolean;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  onOpen: (id: number) => void;
}

export const CaseList: React.FC<CaseListProps> = ({
  cases,
  suites,
  selected,
  activeId,
  canEdit,
  onToggle,
  onToggleAll,
  onOpen,
}) => {
  const t = useTranslations('tm.cases');
  const [dragging, setDragging] = useState<Set<number>>(new Set());
  const groups = useMemo(() => groupBySuite(cases, suites), [cases, suites]);

  // Dragging a selected case takes the whole selection; an unselected one goes alone.
  const startDrag = (e: React.DragEvent, id: number) => {
    const ids = selected.has(id) ? [...selected] : [id];

    e.dataTransfer.setData(CASE_DRAG_TYPE, JSON.stringify(ids));
    e.dataTransfer.effectAllowed = 'move';
    if (ids.length > 1) {
      // Several cases: drag a small "N cases" pill instead of a snapshot of one row.
      const pill = document.createElement('div');

      pill.textContent = t('dragCount', { count: ids.length });
      pill.className = 'fixed -left-[999px] top-0 rounded-md bg-primary px-2 py-1 text-[12px] font-medium text-white';
      document.body.appendChild(pill);
      e.dataTransfer.setDragImage(pill, 12, 12);
      setTimeout(() => pill.remove(), 0);
    }
    setDragging(new Set(ids));
  };

  return (
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
      {groups.map((group) => (
        <Fragment key={group.suiteId}>
          {groups.length > 1 && (
            <li className="bg-default-50 px-3 py-1.5 text-[11.5px] font-medium text-default-500">{group.path}</li>
          )}
          {group.cases.map((c) => (
            // The row holds a checkbox, so it can't itself be a <button>; the title is reachable via the panel.
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
            <li
              key={c.id}
              className={`flex min-h-[44px] cursor-pointer items-center gap-3 px-3 py-2 transition-all hover:bg-default-50 ${
                activeId === c.id ? 'bg-primary/5' : ''
              } ${c.status === 'deprecated' ? 'opacity-60' : ''} ${dragging.has(c.id) ? 'scale-[0.99] opacity-40' : ''}`}
              draggable={canEdit}
              onClick={() => onOpen(c.id)}
              onDragEnd={() => setDragging(new Set())}
              onDragStart={(e) => startDrag(e, c.id)}
            >
              {canEdit && (
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox isSelected={selected.has(c.id)} size="sm" onValueChange={() => onToggle(c.id)} />
                </div>
              )}
              <span className="w-16 shrink-0 font-mono text-[11.5px] text-default-400">{c.label}</span>
              <span className={`min-w-[96px] flex-1 truncate text-[13px] ${c.status === 'draft' ? 'italic' : ''}`}>
                {c.title}
              </span>
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
        </Fragment>
      ))}
    </ul>
  );
};
