'use client';

import type { ImportSummary } from '@/app/lib/tm/caseImport';

import { useEffect, useRef, useState } from 'react';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { FileUp } from 'lucide-react';
import { toast } from 'sonner';

import { withBase } from '@/app/lib/url';

// Mirrors the server's cap, so an oversized file fails before the upload.
const MAX_BYTES = 5 * 1024 * 1024;
// The preview lists this many notes about the file; the rest are only counted.
const SHOWN_PROBLEMS = 8;

interface ImportResult {
  summary: ImportSummary;
  problems: string[];
}

interface ImportCasesModalProps {
  projectKey: string;
  isOpen: boolean;
  onClose: () => void;
}

// Import of test cases from a CSV file. Picking a file runs a dry run on the server and
// shows what the import would do; nothing is written until the user confirms.
export const ImportCasesModal: React.FC<ImportCasesModalProps> = ({ projectKey, isOpen, onClose }) => {
  const t = useTranslations('tm.import');
  const tc = useTranslations('tm.common');
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) return;
    setFile(null);
    setPreview(null);
  }, [isOpen]);

  const send = async (csv: File, dryRun: boolean): Promise<ImportResult> => {
    const response = await fetch(
      withBase(`/api/tm/projects/${encodeURIComponent(projectKey)}/import${dryRun ? '?dryRun=1' : ''}`),
      { method: 'POST', body: csv, headers: { 'Content-Type': 'text/csv' } },
    );

    if (!response.ok) throw new Error(String(response.status));

    return response.json();
  };

  const onPick = async (picked: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!picked) return;
    if (picked.size > MAX_BYTES) return toast.error(t('tooBig'));
    setFile(picked);
    setPreview(null);
    setBusy(true);
    try {
      setPreview(await send(picked, true));
    } catch {
      setFile(null);
      toast.error(t('failed'));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const { summary } = await send(file, false);

      await queryClient.invalidateQueries({
        predicate: (q) => q.queryKey.some((k) => typeof k === 'string' && k.startsWith('/api/tm')),
      });
      toast.success(t('done', { cases: summary.casesCreated, suites: summary.suitesCreated }));
      onClose();
    } catch {
      toast.error(t('failed'));
    } finally {
      setBusy(false);
    }
  };

  const stat = (label: string, value: number) => (
    <div className="flex-1 rounded-lg border border-divider px-3 py-2">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[11.5px] text-default-500">{label}</p>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        <ModalHeader>{t('title')}</ModalHeader>
        <ModalBody className="gap-4">
          <p className="text-[12.5px] text-default-500">{t('hint')}</p>
          <div className="flex items-center gap-3">
            <Button
              isLoading={busy && !preview}
              size="sm"
              startContent={!(busy && !preview) && <FileUp size={14} />}
              variant="flat"
              onPress={() => fileInput.current?.click()}
            >
              {t('chooseFile')}
            </Button>
            <span className="min-w-0 truncate text-[12.5px] text-default-500">{file?.name}</span>
            <input
              ref={fileInput}
              accept=".csv,text/csv"
              className="hidden"
              data-testid="import-file"
              type="file"
              onChange={(e) => void onPick(e.target.files?.[0])}
            />
          </div>
          {preview && (
            <>
              <div className="flex gap-2">
                {stat(t('casesNew'), preview.summary.casesCreated)}
                {stat(t('suitesNew'), preview.summary.suitesCreated)}
                {stat(t('casesSkipped'), preview.summary.casesSkipped)}
              </div>
              {preview.summary.casesSkipped > 0 && <p className="text-[12px] text-default-500">{t('skippedHint')}</p>}
              {preview.problems.length > 0 && (
                <div className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-[12px]">
                  <p className="font-medium">{t('problems', { count: preview.problems.length })}</p>
                  <ul className="mt-1 space-y-0.5 font-mono text-[11.5px] text-default-600">
                    {preview.problems.slice(0, SHOWN_PROBLEMS).map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                  {preview.problems.length > SHOWN_PROBLEMS && (
                    <p className="mt-1 text-default-500">
                      {t('moreProblems', { count: preview.problems.length - SHOWN_PROBLEMS })}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            color="primary"
            isDisabled={!preview || preview.summary.casesCreated === 0}
            isLoading={busy && !!preview}
            onPress={() => void confirm()}
          >
            {t('confirm')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
