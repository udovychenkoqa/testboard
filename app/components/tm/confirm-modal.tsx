'use client';

import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { useTranslations } from 'next-intl';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  isPending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

// Destructive-action confirmation (delete suite / cases).
export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title, message, isPending, onClose, onConfirm }) => {
  const t = useTranslations('tm.common');

  return (
    <Modal isOpen={isOpen} size="sm" onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>
          <p className="text-[13px] text-default-600">{message}</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            {t('cancel')}
          </Button>
          <Button color="danger" isLoading={isPending} onPress={onConfirm}>
            {t('delete')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
