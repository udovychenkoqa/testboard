'use client';

import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { useTranslations } from 'next-intl';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  isPending?: boolean;
  confirmLabel?: string;
  color?: 'danger' | 'primary';
  onClose: () => void;
  onConfirm: () => void;
}

// Confirmation for destructive or final actions (delete suite / cases, complete run).
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  isPending,
  confirmLabel,
  color = 'danger',
  onClose,
  onConfirm,
}) => {
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
          <Button color={color} isLoading={isPending} onPress={onConfirm}>
            {confirmLabel ?? t('delete')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
