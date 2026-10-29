'use client';

import { useLayoutEffect, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { PageLoader } from '@/app/components/ui/page-loader';
import useQuery from '@/app/hooks/useQuery';
import { useAuthConfig } from '@/app/hooks/useAuthConfig';
import { type ServerDataInfo } from '@/app/lib/storage';

interface PageLayoutProps {
  render: (props: { info: ServerDataInfo; onUpdate: () => void }) => React.ReactNode;
}

export default function PageLayout({ render }: Readonly<PageLayoutProps>) {
  const t = useTranslations('common');
  const { data: session, status } = useSession();
  const authIsLoading = status === 'loading';
  const { authRequired } = useAuthConfig();
  const isAuthenticated = authRequired === false || status === 'authenticated';

  const {
    data: info,
    error,
    refetch,
    isLoading: isInfoLoading,
  } = useQuery<ServerDataInfo>('/api/info', {
    enabled: isAuthenticated,
  });
  const [refreshId, setRefreshId] = useState<string>(uuidv4());

  useEffect(() => {
    // Only show error if auth is required
    if (authRequired === false) {
      return;
    }

    if (!authIsLoading && !session && authRequired === true) {
      toast.error(t('notAuthenticated'));
    }
  }, [authIsLoading, session, authRequired]);

  useLayoutEffect(() => {
    // skip refetch is not authorized
    if (authRequired && (authIsLoading || !session)) {
      return;
    }

    refetch({ cancelRefetch: false });
  }, [refreshId, session, authRequired]);

  if (authIsLoading || isInfoLoading) {
    return <PageLoader />;
  }

  const updateRefreshId = () => {
    setRefreshId(uuidv4());
  };

  if (error) {
    return <div>{t('errorLoading', { message: error.message })}</div>;
  }

  return (
    <>
      {!!info && (
        <div className="space-y-6">
          <div className="gap-10">{render({ info, onUpdate: updateRefreshId })}</div>
        </div>
      )}
    </>
  );
}
