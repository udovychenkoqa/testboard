'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { useTranslations } from 'next-intl';

interface NameModalProps {
  isOpen: boolean;
  title: string;
  initial?: string;
  isPending?: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

// One-field dialog for naming things (suites, renames).
export const NameModal: React.FC<NameModalProps> = ({ isOpen, title, initial = '', isPending, onClose, onSubmit }) => {
  const t = useTranslations('tm.common');
  const [name, setName] = useState(initial);

  useEffect(() => {
    if (isOpen) setName(initial);
  }, [isOpen, initial]);

  const submit = () => name.trim() && onSubmit(name.trim());

  return (
    <Modal isOpen={isOpen} size="sm" onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>
          <Input
            autoFocus
            label={t('name')}
            labelPlacement="outside"
            value={name}
            variant="bordered"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            onValueChange={setName}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            {t('cancel')}
          </Button>
          <Button color="primary" isDisabled={!name.trim()} isLoading={isPending} onPress={submit}>
            {t('save')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
