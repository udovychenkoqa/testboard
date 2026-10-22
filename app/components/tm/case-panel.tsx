'use client';

import type { CaseDetail, CaseInput, StepInput, TagUsage } from '@/app/lib/tm/cases';
import type { SuiteNode } from '@/app/lib/tm/suites';

import { useEffect, useState } from 'react';
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  Input,
  Select,
  SelectItem,
  Textarea,
} from '@heroui/react';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { applyTag, suggestTags } from '@/app/lib/tm/tag-suggestions';
import FormattedDate from '@/app/components/date-format';
import useQuery from '@/app/hooks/useQuery';
import { useTmMutation } from '@/app/hooks/useTmMutation';
import { AUTOMATION, CASE_STATUSES, PRIORITIES } from '@/app/lib/tm/constants';

type Mode = { kind: 'new'; suiteId: number } | { kind: 'edit'; caseId: number };

interface CasePanelProps {
  projectKey: string;
  mode: Mode | null;
  suites: SuiteNode[];
  canEdit: boolean;
  onClose: () => void;
}

type Form = Required<Omit<CaseInput, 'tags'>> & { tags: string };

const emptyForm = (suiteId: number): Form => ({
  suiteId,
  title: '',
  description: '',
  preconditions: '',
  priority: 'medium',
  status: 'actual',
  automation: 'manual',
  steps: [],
  tags: '',
});

const fromCase = (c: CaseDetail): Form => ({
  suiteId: c.suiteId,
  title: c.title,
  description: c.description,
  preconditions: c.preconditions,
  priority: c.priority,
  status: c.status,
  automation: c.automation,
  steps: c.steps.map(({ action, expected }) => ({ action, expected })),
  tags: c.tags.join(', '),
});

const StepsEditor: React.FC<{ steps: StepInput[]; readOnly: boolean; onChange: (steps: StepInput[]) => void }> = ({
  steps,
  readOnly,
  onChange,
}) => {
  const t = useTranslations('tm.fields');
  const set = (i: number, patch: Partial<StepInput>) =>
    onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...steps];

    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12.5px] font-medium">{t('steps')}</span>
      {steps.length === 0 && <p className="text-[12px] text-default-400">{t('noSteps')}</p>}
      {steps.map((s, i) => (
        <div key={i} className="flex gap-2 rounded-lg border border-divider p-2">
          <span className="mt-2 w-5 shrink-0 text-center font-mono text-[11.5px] text-default-400">{i + 1}</span>
          <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-2">
            <Textarea
              isReadOnly={readOnly}
              minRows={1}
              placeholder={t('action')}
              size="sm"
              value={s.action}
              variant="bordered"
              onValueChange={(action) => set(i, { action })}
            />
            <Textarea
              isReadOnly={readOnly}
              minRows={1}
              placeholder={t('expected')}
              size="sm"
              value={s.expected}
              variant="bordered"
              onValueChange={(expected) => set(i, { expected })}
            />
          </div>
          {!readOnly && (
            <div className="flex shrink-0 flex-col gap-0.5">
              <Button
                isIconOnly
                aria-label={t('moveUp')}
                isDisabled={i === 0}
                size="sm"
                variant="light"
                onPress={() => move(i, -1)}
              >
                <ArrowUp size={13} />
              </Button>
              <Button
                isIconOnly
                aria-label={t('moveDown')}
                isDisabled={i === steps.length - 1}
                size="sm"
                variant="light"
                onPress={() => move(i, 1)}
              >
                <ArrowDown size={13} />
              </Button>
              <Button
                isIconOnly
                aria-label={t('removeStep')}
                color="danger"
                size="sm"
                variant="light"
                onPress={() => onChange(steps.filter((_, j) => j !== i))}
              >
                <Trash2 size={13} />
              </Button>
            </div>
          )}
        </div>
      ))}
      {!readOnly && (
        <Button
          className="self-start"
          size="sm"
          startContent={<Plus size={13} />}
          variant="flat"
          onPress={() => onChange([...steps, { action: '', expected: '' }])}
        >
          {t('addStep')}
        </Button>
      )}
    </div>
  );
};

export const CasePanel: React.FC<CasePanelProps> = ({ projectKey, mode, suites, canEdit, onClose }) => {
  const t = useTranslations('tm');
  const caseId = mode?.kind === 'edit' ? mode.caseId : null;
  const { data: current } = useQuery<CaseDetail>(`/api/tm/cases/${caseId}`, {
    enabled: caseId !== null,
    dependencies: [caseId],
  });
  const [form, setForm] = useState<Form | null>(null);
  const [tagsFocused, setTagsFocused] = useState(false);
  const { data: knownTags = [] } = useQuery<TagUsage[]>(`/api/tm/projects/${projectKey}/tags`, {
    enabled: mode !== null && canEdit,
    dependencies: [projectKey, mode],
  });
  const tagSuggestions = form ? suggestTags(form.tags, knownTags) : [];

  useEffect(() => {
    if (mode?.kind === 'new') setForm(emptyForm(mode.suiteId));
    else if (current && current.id === caseId) setForm(fromCase(current));
    else setForm(null);
  }, [mode, current, caseId]);

  const create = useTmMutation<CaseDetail>(`/api/tm/projects/${projectKey}/cases`, 'POST', (c) => {
    toast.success(t('cases.caseCreated', { label: c.label }));
    onClose();
  });
  const update = useTmMutation<CaseDetail>(`/api/tm/cases/${caseId}`, 'PATCH', () => toast.success(t('common.saved')));

  const readOnly = !canEdit;
  const patch = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));

  const save = () => {
    if (!form) return;
    const body = {
      ...form,
      tags: form.tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };

    if (mode?.kind === 'new') create.mutate({ body });
    else update.mutate({ body });
  };

  const select = <T extends string>(
    label: string,
    value: T,
    options: readonly T[],
    key: 'priority' | 'status' | 'automation',
  ) => (
    <Select
      disallowEmptySelection
      isDisabled={readOnly}
      label={label}
      labelPlacement="outside"
      selectedKeys={[value]}
      size="sm"
      variant="bordered"
      onSelectionChange={(keys) => patch({ [key]: Array.from(keys)[0] } as Partial<Form>)}
    >
      {options.map((o) => (
        <SelectItem key={o}>{t(`fields.${key}.${o}` as 'fields.priority.high')}</SelectItem>
      ))}
    </Select>
  );

  return (
    // No dimmed backdrop: fading a 50% black layer over the whole page read as the site blinking on every
    // open/close; the panel's shadow and border separate it, and clicking outside still closes it. No scroll
    // lock either: the page scrolls inside <main>, so locking <html> only toggled its overflow.
    <Drawer
      backdrop="transparent"
      classNames={{ base: 'border-l border-divider shadow-2xl' }}
      isOpen={mode !== null}
      shouldBlockScroll={false}
      size="xl"
      onOpenChange={(open) => !open && onClose()}
    >
      <DrawerContent>
        <DrawerHeader className="flex flex-col gap-0.5">
          <span className="font-mono text-[12px] font-normal text-default-400">
            {mode?.kind === 'new' ? t('cases.newCase') : current?.label}
          </span>
          <span className="text-[15px]">{form?.title || (mode?.kind === 'new' ? t('cases.newCase') : '')}</span>
        </DrawerHeader>
        <DrawerBody className="gap-4">
          {form && (
            <>
              <Input
                isReadOnly={readOnly}
                label={t('fields.title')}
                labelPlacement="outside"
                value={form.title}
                variant="bordered"
                onValueChange={(title) => patch({ title })}
              />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Select
                  disallowEmptySelection
                  isDisabled={readOnly}
                  label={t('fields.suite')}
                  labelPlacement="outside"
                  selectedKeys={[String(form.suiteId)]}
                  size="sm"
                  variant="bordered"
                  onSelectionChange={(keys) => patch({ suiteId: Number(Array.from(keys)[0]) })}
                >
                  {suites.map((s) => (
                    <SelectItem key={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </Select>
                {select(t('fields.priority.label'), form.priority, PRIORITIES, 'priority')}
                {select(t('fields.status.label'), form.status, CASE_STATUSES, 'status')}
                {select(t('fields.automation.label'), form.automation, AUTOMATION, 'automation')}
              </div>
              <Textarea
                isReadOnly={readOnly}
                label={t('fields.description')}
                labelPlacement="outside"
                minRows={2}
                value={form.description}
                variant="bordered"
                onValueChange={(description) => patch({ description })}
              />
              <Textarea
                isReadOnly={readOnly}
                label={t('fields.preconditions')}
                labelPlacement="outside"
                minRows={2}
                value={form.preconditions}
                variant="bordered"
                onValueChange={(preconditions) => patch({ preconditions })}
              />
              <StepsEditor readOnly={readOnly} steps={form.steps} onChange={(steps) => patch({ steps })} />
              <div className="flex flex-col gap-1.5">
                <Input
                  description={t('fields.tagsHint')}
                  isReadOnly={readOnly}
                  label={t('fields.tags')}
                  labelPlacement="outside"
                  value={form.tags}
                  variant="bordered"
                  onBlur={() => setTagsFocused(false)}
                  onFocus={() => setTagsFocused(true)}
                  onValueChange={(tags) => patch({ tags })}
                />
                {!readOnly && tagsFocused && tagSuggestions.length > 0 && (
                  <div aria-label={t('fields.tagSuggestions')} className="flex flex-wrap gap-1" role="group">
                    {tagSuggestions.map((tag) => (
                      <button
                        key={tag}
                        className="rounded-md bg-default-100 px-1.5 py-0.5 font-mono text-[11px] text-default-600 transition-colors hover:bg-primary/10 hover:text-primary"
                        type="button"
                        // mousedown, not click: keep the input focused so the list doesn't vanish before the click lands.
                        onMouseDown={(e) => {
                          e.preventDefault();
                          patch({ tags: applyTag(form.tags, tag) });
                        }}
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {current && mode?.kind === 'edit' && (
                <p className="text-[11.5px] text-default-400">
                  {t('cases.createdBy', { who: current.createdBy })} ·{' '}
                  <FormattedDate relativeDay date={new Date(current.updatedAt)} /> · {current.updatedBy}
                </p>
              )}
            </>
          )}
        </DrawerBody>
        <DrawerFooter>
          <Button variant="light" onPress={onClose}>
            {t('common.close')}
          </Button>
          {canEdit && (
            <Button
              color="primary"
              isDisabled={!form?.title.trim()}
              isLoading={create.isPending || update.isPending}
              onPress={save}
            >
              {mode?.kind === 'new' ? t('common.create') : t('common.save')}
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
