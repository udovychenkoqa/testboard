'use client';

import { useMemo, useState } from 'react';
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight, Folder, Layers, MoreHorizontal } from 'lucide-react';

import type { SuiteNode } from '@/app/lib/tm/suites';

interface SuiteTreeProps {
  suites: SuiteNode[];
  selectedId: number | null;
  totalCount: number;
  canEdit: boolean;
  onSelect: (id: number | null) => void;
  onAddChild: (parentId: number) => void;
  onRename: (suite: SuiteNode) => void;
  onDelete: (suite: SuiteNode) => void;
}

// Case count of a suite including everything nested under it.
const totals = (suites: SuiteNode[]) => {
  const children = new Map<number | null, SuiteNode[]>();

  for (const s of suites) children.set(s.parentId, [...(children.get(s.parentId) ?? []), s]);
  const memo = new Map<number, number>();
  const total = (s: SuiteNode): number => {
    if (!memo.has(s.id)) memo.set(s.id, s.caseCount + (children.get(s.id) ?? []).reduce((n, c) => n + total(c), 0));

    return memo.get(s.id)!;
  };

  return { children, total };
};

export const SuiteTree: React.FC<SuiteTreeProps> = ({
  suites,
  selectedId,
  totalCount,
  canEdit,
  onSelect,
  onAddChild,
  onRename,
  onDelete,
}) => {
  const t = useTranslations('tm');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const { children, total } = useMemo(() => totals(suites), [suites]);

  const toggle = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);

      next.has(id) ? next.delete(id) : next.add(id);

      return next;
    });

  const row = (active: boolean) =>
    `group flex h-8 items-center gap-1.5 rounded-lg pr-1 text-[12.5px] transition-colors ${
      active ? 'bg-primary/10 font-medium text-primary' : 'text-default-600 hover:bg-default-100'
    }`;

  const renderNode = (suite: SuiteNode, depth: number): React.ReactNode => {
    const kids = children.get(suite.id) ?? [];
    const open = !collapsed.has(suite.id);

    return (
      <li key={suite.id}>
        <div className={row(selectedId === suite.id)} style={{ paddingLeft: 4 + depth * 14 }}>
          <button
            aria-label={suite.name}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-default-400 ${kids.length ? '' : 'invisible'}`}
            type="button"
            onClick={() => toggle(suite.id)}
          >
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left" type="button" onClick={() => onSelect(suite.id)}>
            <Folder className="shrink-0" size={13} />
            <span className="truncate">{suite.name}</span>
            <span className="ml-auto pl-2 font-mono text-[11px] text-default-400 tabular-nums">{total(suite)}</span>
          </button>
          {canEdit && (
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <button
                  aria-label={t('common.edit')}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-default-400 opacity-0 hover:bg-default-200 focus:opacity-100 group-hover:opacity-100"
                  type="button"
                >
                  <MoreHorizontal size={14} />
                </button>
              </DropdownTrigger>
              <DropdownMenu aria-label={suite.name}>
                <DropdownItem key="add" onPress={() => onAddChild(suite.id)}>
                  {t('cases.subSuite')}
                </DropdownItem>
                <DropdownItem key="rename" onPress={() => onRename(suite)}>
                  {t('common.rename')}
                </DropdownItem>
                <DropdownItem key="delete" className="text-danger" color="danger" onPress={() => onDelete(suite)}>
                  {t('common.delete')}
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          )}
        </div>
        {open && kids.length > 0 && <ul>{kids.map((k) => renderNode(k, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <nav aria-label={t('fields.suite')}>
      <button className={`${row(selectedId === null)} w-full px-2`} type="button" onClick={() => onSelect(null)}>
        <Layers size={13} />
        <span>{t('cases.allCases')}</span>
        <span className="ml-auto font-mono text-[11px] text-default-400 tabular-nums">{totalCount}</span>
      </button>
      <ul className="mt-0.5">{(children.get(null) ?? []).map((s) => renderNode(s, 0))}</ul>
    </nav>
  );
};
