'use client';

import type { Project } from '@/app/lib/tm/projects';

import { useEffect, useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useTmMutation } from '@/app/hooks/useTmMutation';

// "Hanimax Web" → key "hanimax-web", code "HW" (editable suggestions).
const suggestKey = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

const suggestCode = (name: string) => {
  const words = name.toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  const code = words.length > 1 ? words.map((w) => w[0]).join('') : (words[0] ?? '').slice(0, 3);

  return /^[A-Z]/.test(code) ? code.slice(0, 10) : '';
};

export const NewProjectModal: React.FC<{ isOpen: boolean; onClose: () => void; onCreated: (p: Project) => void }> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const t = useTranslations('tm');
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState({ key: false, code: false });
  const { mutate, isPending } = useTmMutation<Project>('/api/tm/projects', 'POST', (project) => {
    toast.success(t('projects.created'));
    onCreated(project);
  });

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setKey('');
    setCode('');
    setTouched({ key: false, code: false });
  }, [isOpen]);

  const onName = (value: string) => {
    setName(value);
    if (!touched.key) setKey(suggestKey(value));
    if (!touched.code) setCode(suggestCode(value));
  };

  const valid = name.trim() && /^[a-z0-9][a-z0-9._-]{0,63}$/.test(key) && /^[A-Z][A-Z0-9]{1,9}$/.test(code);

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        <ModalHeader>{t('projects.newProject')}</ModalHeader>
        <ModalBody className="gap-4">
          <Input
            label={t('common.name')}
            labelPlacement="outside"
            placeholder="Hanimax Web" // i18n-ignore — example
            value={name}
            variant="bordered"
            onValueChange={onName}
          />
          <Input
            className="font-mono"
            description={t('projects.keyHint')}
            label={t('projects.key')}
            labelPlacement="outside"
            value={key}
            variant="bordered"
            onValueChange={(v) => {
              setTouched((s) => ({ ...s, key: true }));
              setKey(v.toLowerCase());
            }}
          />
          <Input
            className="font-mono"
            description={t('projects.codeHint')}
            label={t('projects.code')}
            labelPlacement="outside"
            value={code}
            variant="bordered"
            onValueChange={(v) => {
              setTouched((s) => ({ ...s, code: true }));
              setCode(v.toUpperCase());
            }}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            color="primary"
            isDisabled={!valid}
            isLoading={isPending}
            onPress={() => mutate({ body: { key, name: name.trim(), code } })}
          >
            {t('common.create')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
