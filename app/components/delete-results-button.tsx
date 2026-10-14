'use client';

import {} from 'react';
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure, Button } from '@heroui/react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import useMutation from '@/app/hooks/useMutation';
import { invalidateCache } from '@/app/lib/query-cache';
import { DeleteIcon } from '@/app/components/icons';

interface UseDeleteResultsProps {
  resultIds: string[];
  onDeletedResult?: () => void;
}

// See useDeleteReport (delete-report-button.tsx) for why this is a hook: a
// DropdownItem must be a direct child of DropdownMenu, so callers render the
// item themselves and just wire up `open`/`modal` from here.
export function useDeleteResults({ resultIds, onDeletedResult }: UseDeleteResultsProps) {
  const t = useTranslations('deleteResults');
  const queryClient = useQueryClient();
  const { mutate: deleteResult, isPending } = useMutation('/api/result/delete', {
    method: 'DELETE',
    onSuccess: () => {
      invalidateCache(queryClient, { queryKeys: ['/api/info'], predicate: '/api/result' });
      toast.success(t('deleted', { count: resultIds.length }));
    },
  });

  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const confirmDelete = () => {
    if (!resultIds?.length) return;

    deleteResult({ body: { resultsIds: resultIds } });
    onDeletedResult?.();
  };

  const modal = (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">{t('confirmTitle')}</ModalHeader>
            <ModalBody>
              <p>{t('confirmBody')}</p>
            </ModalBody>
            <ModalFooter>
              <Button color="primary" variant="light" onPress={onClose}>
                {t('close')}
              </Button>
              <Button
                color="danger"
                isLoading={isPending}
                onPress={() => {
                  confirmDelete();
                  onClose();
                }}
              >
                {t('confirm')}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );

  return { open: onOpen, isPending, isDisabled: !resultIds?.length, modal };
}

interface DeleteResultsButtonProps {
  resultIds: string[];
  onDeletedResult?: () => void;
  label?: string;
}

export default function DeleteResultsButton({ resultIds, onDeletedResult, label }: Readonly<DeleteResultsButtonProps>) {
  const t = useTranslations('deleteResults');
  const { open, isPending, isDisabled, modal } = useDeleteResults({ resultIds, onDeletedResult });

  return (
    <>
      <Button
        className={`${!label ? 'p-0 min-w-10' : ''}`}
        color="primary"
        isDisabled={isDisabled}
        isLoading={isPending}
        size="md"
        title={t('buttonTitle')}
        variant="light"
        onPress={open}
      >
        {label || <DeleteIcon size={24} />}
      </Button>
      {modal}
    </>
  );
}
