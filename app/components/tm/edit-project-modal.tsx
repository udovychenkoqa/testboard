'use client';

import type { ProjectSummary } from '@/app/lib/tm/projects';

import { useEffect, useRef, useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

import { ProjectAvatar } from '@/app/components/tm/project-avatar';
import { useTmMutation } from '@/app/hooks/useTmMutation';
import { withBase } from '@/app/lib/url';

// Mirrors MAX_LOGO_BYTES and the server's type check, so most bad files fail before the upload.
const MAX_LOGO_BYTES = 200 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

interface EditProjectModalProps {
  project: ProjectSummary | null;
  onClose: () => void;
}

// Project settings like Qase's General tab: the avatar with Change / Remove logo, and the name.
// The logo applies right away; the name is saved with the Save button.
export const EditProjectModal: React.FC<EditProjectModalProps> = ({ project, onClose }) => {
  const t = useTranslations('tm.projects');
  const tc = useTranslations('tm.common');
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const rename = useTmMutation('/api/tm/projects', 'PATCH', () => {
    onClose();
    toast.success(tc('saved'));
  });

  useEffect(() => {
    if (project) setName(project.name);
  }, [project]);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) => q.queryKey.some((k) => typeof k === 'string' && k.startsWith('/api/tm')),
    });

  const sendLogo = async (method: 'PUT' | 'DELETE', file?: File) => {
    if (!project) return;
    setLogoBusy(true);
    try {
      const response = await fetch(withBase(`/api/tm/projects/${encodeURIComponent(project.key)}/logo`), {
        method,
        body: file,
        headers: file ? { 'Content-Type': file.type } : undefined,
      });

      if (!response.ok) throw new Error(String(response.status));
      await refresh();
      toast.success(method === 'PUT' ? t('logoUpdated') : t('logoRemoved'));
    } catch {
      toast.error(t('logoFailed'));
    } finally {
      setLogoBusy(false);
    }
  };

  const onPick = (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return toast.error(t('logoBadType'));
    if (file.size > MAX_LOGO_BYTES) return toast.error(t('logoTooBig'));
    void sendLogo('PUT', file);
  };

  const submit = () =>
    project && name.trim() && rename.mutate({ path: `/api/tm/projects/${project.key}`, body: { name: name.trim() } });

  return (
    <Modal isOpen={project !== null} onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        <ModalHeader>{t('editTitle')}</ModalHeader>
        {project && (
          <ModalBody className="gap-5">
            <div className="flex items-center gap-4">
              <ProjectAvatar project={{ ...project, name: name || project.name }} size="lg" />
              <div className="flex flex-col items-start gap-1.5">
                <div className="flex gap-2">
                  <Button
                    isLoading={logoBusy}
                    size="sm"
                    startContent={!logoBusy && <Upload size={14} />}
                    variant="flat"
                    onPress={() => fileInput.current?.click()}
                  >
                    {t('changeLogo')}
                  </Button>
                  {project.logoUpdatedAt && (
                    <Button
                      className="text-default-500"
                      isDisabled={logoBusy}
                      size="sm"
                      variant="light"
                      onPress={() => void sendLogo('DELETE')}
                    >
                      {t('removeLogo')}
                    </Button>
                  )}
                </div>
                <p className="text-[12px] text-default-400">{t('logoHint')}</p>
                <input
                  ref={fileInput}
                  accept={LOGO_TYPES.join(',')}
                  className="hidden"
                  type="file"
                  onChange={(e) => onPick(e.target.files?.[0])}
                />
              </div>
            </div>
            <Input
              label={tc('name')}
              labelPlacement="outside"
              value={name}
              variant="bordered"
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              onValueChange={setName}
            />
          </ModalBody>
        )}
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            {tc('cancel')}
          </Button>
          <Button color="primary" isDisabled={!name.trim()} isLoading={rename.isPending} onPress={submit}>
            {tc('save')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
