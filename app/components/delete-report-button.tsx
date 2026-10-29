'use client';

import {} from 'react';
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure, Button } from '@heroui/react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import useMutation from '@/app/hooks/useMutation';
import { DeleteIcon } from '@/app/components/icons';
import { invalidateCache } from '@/app/lib/query-cache';

interface UseDeleteReportProps {
  reportId?: string;
  reportIds?: string[];
  onDeleted: () => void;
}

// Shared delete logic + confirm modal, usable from a standalone button or a
// row's "…" DropdownItem — DropdownMenu needs DropdownItem as a direct child,
// so the item itself is rendered by the caller; this hook only owns the
// mutation/disclosure state and hands back the modal JSX to mount alongside.
export function useDeleteReport({ reportId, reportIds, onDeleted }: UseDeleteReportProps) {
  const t = useTranslations('deleteReport');
  const queryClient = useQueryClient();
  const ids = reportIds ?? (reportId ? [reportId] : []);

  const { mutate: deleteReport, isPending } = useMutation('/api/report/delete', {
    method: 'DELETE',
    onSuccess: () => {
      invalidateCache(queryClient, { queryKeys: ['/api/info'], predicate: '/api/report' });
      toast.success(t('deleted', { count: ids.length }));
    },
  });

  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const confirmDelete = () => {
    if (!ids.length) return;

    deleteReport({ body: { reportsIds: ids } });
    onDeleted?.();
  };

  const modal = (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">{t('confirmTitle')}</ModalHeader>
            <ModalBody>
              <p>{t('confirmBody', { count: ids.length })}</p>
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

  return { open: onOpen, isPending, isDisabled: !ids.length, modal };
}

interface DeleteReportButtonProps {
  reportId?: string;
  reportIds?: string[];
  onDeleted: () => void;
  label?: string;
}

export default function DeleteReportButton({ reportId, reportIds, onDeleted, label }: DeleteReportButtonProps) {
  const t = useTranslations('deleteReport');
  const { open, isPending, isDisabled, modal } = useDeleteReport({ reportId, reportIds, onDeleted });

  return (
    <>
      <Button
        className={`${!label ? 'p-0 min-w-10' : ''}`}
        color="primary"
        isDisabled={isDisabled}
        isLoading={isPending}
        size="md"
        title={t('buttonTitle')}
        variant="solid"
        onPress={open}
      >
        {label || <DeleteIcon size={24} />}
      </Button>
      {modal}
    </>
  );
}
