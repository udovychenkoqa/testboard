'use client';

import type { Result } from '@/app/lib/tm/constants';
import type { RunCaseView } from '@/app/lib/tm/runs';

import { useEffect, useState } from 'react';
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  Select,
  SelectItem,
  Textarea,
} from '@heroui/react';
import { useTranslations } from 'next-intl';
import { Ban, Check, ChevronRight, SkipForward, X } from 'lucide-react';

import FormattedDate from '@/app/components/date-format';
import { ResultBadge } from '@/app/components/tm/result';
import { useTmMutation } from '@/app/hooks/useTmMutation';

interface RunCasePanelProps {
  runId: number;
  runCase: RunCaseView | null;
  readOnly: boolean;
  assignees: string[];
  onClose: () => void;
  // Called after a result is saved, so the page can move on to the next untested case.
  onResult: (runCaseId: number) => void;
  onNext: () => void;
}

const UNASSIGNED = '__unassigned';

const BUTTONS: { result: Result; icon: React.ReactNode; color: 'success' | 'danger' | 'warning' | 'default' }[] = [
  { result: 'passed', icon: <Check className="shrink-0" size={14} />, color: 'success' },
  { result: 'failed', icon: <X className="shrink-0" size={14} />, color: 'danger' },
  { result: 'blocked', icon: <Ban className="shrink-0" size={14} />, color: 'warning' },
  { result: 'skipped', icon: <SkipForward className="shrink-0" size={14} />, color: 'default' },
];

export const RunCasePanel: React.FC<RunCasePanelProps> = ({
  runId,
  runCase,
  readOnly,
  assignees,
  onClose,
  onResult,
  onNext,
}) => {
  const t = useTranslations('tm.runs');
  const tc = useTranslations('tm.common');
  const [comment, setComment] = useState('');

  useEffect(() => setComment(runCase?.comment ?? ''), [runCase?.id, runCase?.comment]);

  const path = runCase ? `/api/tm/runs/${runId}/cases/${runCase.id}` : '';
  const update = useTmMutation<RunCaseView>(path, 'PATCH');

  const setResult = (result: Result) => {
    if (!runCase) return;
    update.mutate({ body: { result, comment } }, { onSuccess: (rc) => onResult(rc.id) });
  };

  const saveComment = () => {
    if (runCase && !readOnly && comment.trim() !== runCase.comment) update.mutate({ body: { comment } });
  };

  const snapshot = runCase?.snapshot;
  // Keep the current assignee selectable even if they've since lost the tester role.
  const options =
    runCase?.assignee && !assignees.includes(runCase.assignee) ? [...assignees, runCase.assignee] : assignees;

  return (
    // No dimmed backdrop: fading a 50% black layer over the whole page read as the site blinking on every
    // open/close; the panel's shadow and border separate it, and clicking outside still closes it. No scroll
    // lock either: the page scrolls inside <main>, so locking <html> only toggled its overflow.
    <Drawer
      backdrop="transparent"
      classNames={{ base: 'border-l border-divider shadow-2xl' }}
      isOpen={runCase !== null}
      shouldBlockScroll={false}
      size="xl"
      onOpenChange={(open) => !open && onClose()}
    >
      <DrawerContent>
        {runCase && snapshot && (
          <>
            <DrawerHeader className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-[12px] font-normal text-default-400">
                <span className="font-mono">{snapshot.label}</span>
                {snapshot.suitePath.length > 0 && <span className="truncate">{snapshot.suitePath.join(' / ')}</span>}
              </span>
              <span className="text-[15px]">{snapshot.title}</span>
              <span className="flex flex-wrap items-center gap-2 text-[11.5px] font-normal text-default-400">
                <ResultBadge value={runCase.result} />
                {runCase.resultBy && runCase.resultAt && (
                  <span>
                    {t('resultBy', { result: t(`result.${runCase.result}`), who: runCase.resultBy })} ·{' '}
                    <FormattedDate relativeDay date={new Date(runCase.resultAt)} />
                  </span>
                )}
              </span>
            </DrawerHeader>
            <DrawerBody className="gap-5">
              {snapshot.preconditions && (
                <section className="flex flex-col gap-1">
                  <h3 className="text-[12.5px] font-medium">{t('preconditions')}</h3>
                  <p className="whitespace-pre-wrap text-[13px] text-default-600">{snapshot.preconditions}</p>
                </section>
              )}
              {snapshot.steps.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-[12.5px] font-medium">{t('steps')}</h3>
                  <ol className="flex flex-col divide-y divide-divider rounded-lg border border-divider">
                    {snapshot.steps.map((s, i) => (
                      <li
                        key={i}
                        className="grid grid-cols-[24px_1fr] gap-x-2 gap-y-1 px-3 py-2 md:grid-cols-[24px_1fr_1fr]"
                      >
                        <span className="font-mono text-[11.5px] text-default-400">{i + 1}</span>
                        <span className="whitespace-pre-wrap text-[13px]">{s.action}</span>
                        <span className="col-start-2 whitespace-pre-wrap text-[13px] text-default-500 md:col-start-3">
                          {s.expected && (
                            <>
                              <span className="text-[11px] uppercase tracking-wide text-default-400 md:hidden">
                                {t('expected')}:{' '}
                              </span>
                              {s.expected}
                            </>
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {!readOnly && (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {BUTTONS.map((b) => (
                    <Button
                      key={b.result}
                      color={b.color}
                      isDisabled={update.isPending}
                      startContent={b.icon}
                      variant={runCase.result === b.result ? 'solid' : 'flat'}
                      onPress={() => setResult(b.result)}
                    >
                      {t(`result.${b.result}`)}
                    </Button>
                  ))}
                </div>
              )}

              <Textarea
                isReadOnly={readOnly}
                label={t('comment')}
                labelPlacement="outside"
                minRows={3}
                placeholder={readOnly ? undefined : t('commentPlaceholder')}
                value={comment}
                variant="bordered"
                onBlur={saveComment}
                onValueChange={setComment}
              />

              <Select
                disallowEmptySelection
                isDisabled={readOnly}
                label={t('assignee')}
                labelPlacement="outside"
                selectedKeys={[runCase.assignee ?? UNASSIGNED]}
                size="sm"
                variant="bordered"
                onSelectionChange={(keys) => {
                  const next = Array.from(keys)[0] as string;

                  update.mutate({ body: { assignee: next === UNASSIGNED ? null : next } });
                }}
              >
                {[
                  <SelectItem key={UNASSIGNED}>{t('unassigned')}</SelectItem>,
                  ...options.map((email) => <SelectItem key={email}>{email}</SelectItem>),
                ]}
              </Select>
            </DrawerBody>
            <DrawerFooter>
              <Button variant="light" onPress={onClose}>
                {tc('close')}
              </Button>
              <Button endContent={<ChevronRight size={14} />} variant="flat" onPress={onNext}>
                {t('next')}
              </Button>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
};
