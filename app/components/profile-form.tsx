'use client';

import type { Profile } from '@/app/lib/profiles';

import { useEffect, useRef, useState } from 'react';
import { Button, Input } from '@heroui/react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/app/components/page-header';
import { PersonAvatar } from '@/app/components/person-avatar';
import { BlockSkeleton } from '@/app/components/ui/skeletons';
import useMutation from '@/app/hooks/useMutation';
import useQuery from '@/app/hooks/useQuery';
import { displayName } from '@/app/lib/profileName';
import { withBase } from '@/app/lib/url';

// Mirrors the server's photo rules, so most bad files fail before the upload.
const MAX_PHOTO_BYTES = 200 * 1024;
const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// Splits the name the sign-in provider gave us ("Anton Udovychenko") for a profile nobody has filled in yet.
const splitName = (name: string | null | undefined) => {
  const [first = '', ...rest] = (name ?? '').trim().split(/\s+/);

  return { firstName: first, lastName: rest.join(' ') };
};

// Profile settings like Qase's: photo with Upload / Remove, first and last name, position.
// The photo applies right away; the text fields are saved with the button.
export const ProfileForm: React.FC = () => {
  const t = useTranslations('profile');
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const email = session?.user?.email;
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', position: '' });
  const [photoBusy, setPhotoBusy] = useState(false);
  const { data: profile, isPending } = useQuery<Profile>('/api/profile', { enabled: !!email });

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) => q.queryKey.some((k) => typeof k === 'string' && k.startsWith('/api/profile')),
    });

  const save = useMutation<Profile, typeof form>('/api/profile', {
    method: 'PUT',
    onSuccess: () => {
      void refresh();
      toast.success(t('saved'));
    },
  });

  useEffect(() => {
    if (!profile) return;
    const untouched = !profile.firstName && !profile.lastName && !profile.position;

    setForm({
      ...(untouched ? splitName(session?.user?.name) : { firstName: profile.firstName, lastName: profile.lastName }),
      position: profile.position,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const sendPhoto = async (method: 'PUT' | 'DELETE', file?: File) => {
    setPhotoBusy(true);
    try {
      const response = await fetch(withBase('/api/profile/avatar'), {
        method,
        body: file,
        headers: file ? { 'Content-Type': file.type } : undefined,
      });

      if (!response.ok) throw new Error(String(response.status));
      await refresh();
      toast.success(method === 'PUT' ? t('photoUpdated') : t('photoRemoved'));
    } catch {
      toast.error(t('photoFailed'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const onPick = (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return toast.error(t('photoBadType'));
    if (file.size > MAX_PHOTO_BYTES) return toast.error(t('photoTooBig'));
    void sendPhoto('PUT', file);
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onValueChange: (value: string) => setForm((prev) => ({ ...prev, [key]: value })),
  });

  return (
    <div className="flex flex-col rr-enter">
      <PageHeader subtitle={email ?? undefined} title={t('title')} />
      <div className="p-5">
        {!email ? (
          <p className="text-[12.5px] text-default-500">{t('needsSignIn')}</p>
        ) : isPending ? (
          <BlockSkeleton lines={4} />
        ) : (
          <div className="flex max-w-2xl flex-col gap-6 rounded-xl border border-divider bg-content1 p-5 sm:flex-row">
            <div className="flex shrink-0 flex-col items-center gap-3">
              <PersonAvatar
                avatarUpdatedAt={profile?.avatarUpdatedAt}
                className="h-28 w-28 rounded-xl text-2xl"
                email={email}
                fallbackSrc={session?.user?.image ?? undefined}
                name={displayName(form, email)}
              />
              <div className="flex flex-col items-center gap-1">
                <Button
                  isLoading={photoBusy}
                  size="sm"
                  startContent={!photoBusy && <Upload size={14} />}
                  variant="flat"
                  onPress={() => fileInput.current?.click()}
                >
                  {t('upload')}
                </Button>
                {profile?.avatarUpdatedAt && (
                  <Button
                    className="text-default-500"
                    isDisabled={photoBusy}
                    size="sm"
                    variant="light"
                    onPress={() => void sendPhoto('DELETE')}
                  >
                    {t('removePhoto')}
                  </Button>
                )}
              </div>
              <p className="max-w-[9rem] text-center text-[11px] text-default-400">{t('photoHint')}</p>
              <input
                ref={fileInput}
                accept={PHOTO_TYPES.join(',')}
                className="hidden"
                type="file"
                onChange={(e) => onPick(e.target.files?.[0])}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <Input label={t('firstName')} labelPlacement="outside" maxLength={80} variant="bordered" {...field('firstName')} />
              <Input label={t('lastName')} labelPlacement="outside" maxLength={80} variant="bordered" {...field('lastName')} />
              <Input label={t('position')} labelPlacement="outside" maxLength={80} variant="bordered" {...field('position')} />
              <div>
                <Button color="primary" isLoading={save.isPending} onPress={() => save.mutate({ body: form })}>
                  {t('save')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
