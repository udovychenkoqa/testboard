'use client';

import type { RunSource, RunSummary } from '@/app/lib/tm/runs';
import type { SuiteNode } from '@/app/lib/tm/suites';

import { useEffect, useState } from 'react';
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
} from '@heroui/react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import useQuery from '@/app/hooks/useQuery';
import { useTmMutation } from '@/app/hooks/useTmMutation';

type SourceType = RunSource['type'];

interface NewRunModalProps {
  projectKey: string;
  isOpen: boolean;
  // Case ids handed over from the Test Cases bulk bar; switches the source to "selected cases".
  presetCaseIds: number[];
  onClose: () => void;
  onCreated: (run: RunSummary) => void;
}

const NOBODY = '__nobody';

export const NewRunModal: React.FC<NewRunModalProps> = ({ projectKey, isOpen, presetCaseIds, onClose, onCreated }) => {
  const t = useTranslations('tm');
  const { data: suites = [] } = useQuery<SuiteNode[]>(`/api/tm/projects/${projectKey}/suites`, {
    enabled: isOpen,
    dependencies: [projectKey, isOpen],
  });
  const { data: assignees = [] } = useQuery<string[]>('/api/tm/assignees', { enabled: isOpen });

  const [name, setName] = useState('');
  const [type, setType] = useState<SourceType>('all');
  const [suiteIds, setSuiteIds] = useState<string[]>([]);
  const [tags, setTags] = useState('');
  const [assignee, setAssignee] = useState(NOBODY);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setType(presetCaseIds.length > 0 ? 'cases' : 'all');
    setSuiteIds([]);
    setTags('');
    setAssignee(NOBODY);
  }, [isOpen, presetCaseIds]);

  const create = useTmMutation<RunSummary>(`/api/tm/projects/${projectKey}/runs`, 'POST', (run) => {
    toast.success(t('runs.created'));
    onCreated(run);
  });

  const tagList = tags
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const source: RunSource =
    type === 'suites'
      ? { type, suiteIds: suiteIds.map(Number) }
      : type === 'tags'
        ? { type, tags: tagList }
        : type === 'cases'
          ? { type, caseIds: presetCaseIds }
          : { type: 'all' };
  const sourceReady =
    (type !== 'suites' || suiteIds.length > 0) &&
    (type !== 'tags' || tagList.length > 0) &&
    (type !== 'cases' || presetCaseIds.length > 0);

  const types: SourceType[] = presetCaseIds.length > 0 ? ['all', 'suites', 'tags', 'cases'] : ['all', 'suites', 'tags'];

  return (
    <Modal isOpen={isOpen} size="md" onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        <ModalHeader>{t('runs.newRun')}</ModalHeader>
        <ModalBody className="gap-4">
          <Input
            label={t('runs.runName')}
            labelPlacement="outside"
            placeholder={t('runs.runName')}
            value={name}
            variant="bordered"
            onValueChange={setName}
          />
          <Select
            disallowEmptySelection
            label={t('runs.source.label')}
            labelPlacement="outside"
            selectedKeys={[type]}
            variant="bordered"
            onSelectionChange={(keys) => setType(Array.from(keys)[0] as SourceType)}
          >
            {types.map((s) => (
              <SelectItem key={s}>{t(`runs.source.${s}`)}</SelectItem>
            ))}
          </Select>
          {type === 'suites' && (
            <Select
              label={t('runs.suites')}
              labelPlacement="outside"
              placeholder={t('runs.suites')}
              selectedKeys={suiteIds}
              selectionMode="multiple"
              variant="bordered"
              onSelectionChange={(keys) => setSuiteIds(Array.from(keys) as string[])}
            >
              {suites.map((s) => (
                <SelectItem key={String(s.id)}>{s.name}</SelectItem>
              ))}
            </Select>
          )}
          {type === 'tags' && (
            <Input
              description={t('runs.tagsHint')}
              label={t('runs.tags')}
              labelPlacement="outside"
              placeholder={t('runs.tags')}
              value={tags}
              variant="bordered"
              onValueChange={setTags}
            />
          )}
          {type === 'cases' && (
            <p className="text-[12.5px] text-default-500">
              {t('runs.source.selectedCount', { count: presetCaseIds.length })}
            </p>
          )}
          <Select
            disallowEmptySelection
            label={t('runs.defaultAssignee')}
            labelPlacement="outside"
            selectedKeys={[assignee]}
            variant="bordered"
            onSelectionChange={(keys) => setAssignee((Array.from(keys)[0] as string) ?? NOBODY)}
          >
            {[
              <SelectItem key={NOBODY}>{t('runs.nobody')}</SelectItem>,
              ...assignees.map((email) => <SelectItem key={email}>{email}</SelectItem>),
            ]}
          </Select>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            color="primary"
            isDisabled={!name.trim() || !sourceReady}
            isLoading={create.isPending}
            onPress={() =>
              create.mutate({ body: { name: name.trim(), source, assignee: assignee === NOBODY ? null : assignee } })
            }
          >
            {t('common.create')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
