'use client';

import type { ProjectSummary } from '@/app/lib/tm/projects';

import { useEffect, useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useTmMutation } from '@/app/hooks/useTmMutation';

interface DeleteProjectModalProps {
  project: ProjectSummary | null;
  onClose: () => void;
}

// Deleting a project removes all its suites, cases and runs for good, so the user types the key to confirm.
export const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({ project, onClose }) => {
  const t = useTranslations('tm');
  const [typed, setTyped] = useState('');

  useEffect(() => setTyped(''), [project]);

  const remove = useTmMutation(`/api/tm/projects/${project?.key}`, 'DELETE', () => {
    toast.success(t('projects.deleted', { name: project?.name ?? '' }));
    onClose();
  });

  return (
    <Modal isOpen={project !== null} size="md" onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        {project && (
          <>
            <ModalHeader>{t('projects.deleteTitle', { name: project.name })}</ModalHeader>
            <ModalBody className="gap-3">
              <p className="text-[13px] text-default-600">
                {t('projects.deleteWarning', { count: project.caseCount })}
              </p>
              <Input
                classNames={{ input: 'font-mono' }}
                label={t('projects.deleteConfirmLabel', { key: project.key })}
                labelPlacement="outside"
                placeholder={project.key}
                value={typed}
                variant="bordered"
                onValueChange={setTyped}
              />
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                color="danger"
                isDisabled={typed.trim() !== project.key}
                isLoading={remove.isPending}
                onPress={() => remove.mutate({})}
              >
                {t('projects.delete')}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
