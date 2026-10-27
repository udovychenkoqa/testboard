'use client';

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
  Button,
  Autocomplete,
  AutocompleteItem,
  Input,
} from '@heroui/react';
import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import useQuery from '@/app/hooks/useQuery';
import { invalidateCache } from '@/app/lib/query-cache';

interface UploadResultsButtonProps {
  onUploadedResult?: () => void;
  label?: string;
}

export default function UploadResultsButton({ onUploadedResult, label }: Readonly<UploadResultsButtonProps>) {
  const t = useTranslations('uploadResults');
  const queryClient = useQueryClient();
  const session = useSession();

  const {
    data: resultProjects,
    error: resultProjectsError,
    isLoading: isResultProjectsLoading,
  } = useQuery<string[]>(`/api/result/projects`);

  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [file, setFile] = useState<File | null>(null);
  const [project, setProject] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) {
      toast.error(t('selectFile'));

      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();

      formData.append('file', file);

      if (project) {
        formData.append('project', project);
      }

      tags.forEach((tag) => {
        const [key, value] = tag.split(': ');

        if (key && value) {
          formData.append(key.trim(), value.trim());
        }
      });

      const response = await fetch('/api/result/upload', {
        method: 'PUT',
        body: formData,
        headers: {
          authorization: session.data?.user?.apiToken ?? '',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();

        toast.error(t('failed', { error: errorText }));

        return;
      }

      await response.json();

      invalidateCache(queryClient, { queryKeys: ['/api/info'], predicate: '/api/result' });
      toast.success(t('uploaded'));
      onUploadedResult?.();
    } catch (error) {
      toast.error(t('failed', { error: error instanceof Error ? error.message : t('unknownError') }));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];

    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleAddTag = () => {
    if (currentTag.trim() && currentTag.includes(': ')) {
      setTags([...tags, currentTag.trim()]);
      setCurrentTag('');
    } else if (currentTag.trim()) {
      toast.error(t('tagFormat'));
    }
  };

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (value.includes(':') && !value.includes(': ')) {
      const colonIndex = value.indexOf(':');
      const newValue = value.slice(0, colonIndex + 1) + ' ' + value.slice(colonIndex + 1);

      setCurrentTag(newValue);
    } else {
      setCurrentTag(value);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <>
      <Button
        color="primary"
        isLoading={isUploading}
        size="md"
        title={t('buttonTitle')}
        variant="solid"
        onPress={onOpen}
      >
        {label ?? t('button')}
      </Button>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">{t('title')}</ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium" htmlFor="file-input">
                      {t('file')}
                    </label>
                    <Button
                      className="justify-start border-default-200 hover:border-default-400"
                      color="primary"
                      variant="bordered"
                      onPress={handleFileButtonClick}
                    >
                      {file ? file.name : t('chooseFile')}
                    </Button>
                    <input
                      ref={fileInputRef}
                      accept=".zip,.json"
                      className="hidden"
                      id="file-input"
                      type="file"
                      onChange={handleFileChange}
                    />
                  </div>
                  <Autocomplete
                    allowsCustomValue
                    errorMessage={resultProjectsError?.message}
                    inputValue={project}
                    isDisabled={isUploading}
                    isLoading={isResultProjectsLoading}
                    items={(resultProjects ?? []).map((project) => ({
                      label: project,
                      value: project,
                    }))}
                    label={t('project')}
                    labelPlacement="outside"
                    placeholder={t('projectPlaceholder')}
                    variant="bordered"
                    onInputChange={(value) => setProject(value)}
                    onSelectionChange={(value) => value && setProject(value?.toString() ?? '')}
                  >
                    {(item) => <AutocompleteItem key={item.value}>{item.label}</AutocompleteItem>}
                  </Autocomplete>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium" htmlFor="tag-input">
                      {t('tags')}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        className="flex-1"
                        id="tag-input"
                        isDisabled={isUploading}
                        placeholder={t('tagPlaceholder')}
                        value={currentTag}
                        variant="bordered"
                        onChange={handleTagInputChange}
                        onKeyDown={handleKeyPress}
                      />
                      <Button
                        color="primary"
                        isDisabled={isUploading || !currentTag.trim()}
                        size="sm"
                        style={{ height: '40px' }}
                        variant="solid"
                        onPress={handleAddTag}
                      >
                        {t('add')}
                      </Button>
                    </div>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {tags.map((tag, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-1 bg-default-100 dark:bg-default-200 px-2 py-1 rounded-md"
                          >
                            <span className="text-sm">{tag}</span>
                            <Button
                              className="min-w-0 p-0 h-auto w-4"
                              color="danger"
                              isDisabled={isUploading}
                              size="sm"
                              variant="light"
                              onPress={() => handleRemoveTag(tag)}
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  color="primary"
                  variant="light"
                  onPress={() => {
                    setFile(null);
                    setProject('');
                    setTags([]);
                    setCurrentTag('');
                    onClose();
                  }}
                >
                  {t('cancel')}
                </Button>
                <Button
                  color="primary"
                  isDisabled={!file}
                  isLoading={isUploading}
                  onPress={() => {
                    handleUpload();
                    setFile(null);
                    setProject('');
                    setTags([]);
                    setCurrentTag('');
                    onClose();
                  }}
                >
                  {t('upload')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
