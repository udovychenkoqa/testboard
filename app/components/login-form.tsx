'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, CardBody, CardHeader, Divider, Input } from '@heroui/react';
import { getProviders, signIn, useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

import { safeCallbackPath } from '@/app/lib/safeRedirect';
import { PageLoader } from '@/app/components/ui/page-loader';
import { GoogleIcon } from '@/app/components/icons';
import { LanguageSwitch } from '@/app/components/language-switch';

export default function LoginForm() {
  const t = useTranslations('login');
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [isAutoSigningIn, setIsAutoSigningIn] = useState(true);
  // Which providers are configured — drives what the form renders.
  const [hasGoogle, setHasGoogle] = useState(false);
  const [hasApiToken, setHasApiToken] = useState(false);
  const router = useRouter();
  const session = useSession();
  const searchParams = useSearchParams();

  const callbackUrl = safeCallbackPath(searchParams?.get('callbackUrl'));

  useEffect(() => {
    // redirect if already authenticated
    if (session.status === 'authenticated') {
      router.replace(callbackUrl);

      return;
    }

    // check if we can sign in automatically
    getProviders()
      .then((available) => {
        setHasGoogle(!!available?.google);
        setHasApiToken(available?.credentials?.name === 'API Token');

        if (available?.credentials?.name === 'No Auth') {
          return signIn('credentials', {
            redirect: false,
          }).then((response) => {
            if (!response?.error && response?.ok) {
              router.replace(callbackUrl);
            } else {
              setIsAutoSigningIn(false);
            }
          });
        } else {
          setIsAutoSigningIn(false);
        }
      })
      .catch(() => {
        setIsAutoSigningIn(false);
      });
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const result = await signIn('credentials', {
      apiToken: input,
      redirect: false,
    });

    result?.error ? setError(t('invalidKey')) : router.replace(callbackUrl);
  };

  // Show spinner while session is loading or while auto-signing in
  if (session.status === 'loading' || isAutoSigningIn) {
    return <PageLoader />;
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[70vh] gap-6">
      <LanguageSwitch className="absolute right-4 top-4" />
      <Card className="w-[352px] max-w-full p-2 shadow-medium">
        <CardHeader className="content-start">
          <p className="text-[13px] text-default-500">{t('title')}</p>
        </CardHeader>
        <CardBody className="gap-4">
          {hasGoogle && (
            <Button
              className="w-full"
              startContent={<GoogleIcon size={18} />}
              variant="bordered"
              onPress={() => signIn('google', { callbackUrl })}
            >
              {t('google')}
            </Button>
          )}

          {hasApiToken && hasGoogle && (
            <div className="flex items-center gap-3">
              <Divider className="flex-1" />
              <span className="text-tiny uppercase text-default-400">{t('or')}</span>
              <Divider className="flex-1" />
            </div>
          )}

          {hasApiToken && (
            <form onSubmit={handleSubmit}>
              <Input
                fullWidth
                isRequired
                errorMessage={error}
                isInvalid={!!error}
                label={t('apiKey')}
                labelPlacement="outside"
                placeholder={t('apiKeyPlaceholder')}
                type="password"
                value={input}
                variant="faded"
                onChange={(e) => {
                  const newValue = e.target.value;

                  if (!newValue && error) {
                    setError('');
                  }
                  setInput(newValue);
                }}
              />
              <Button className="w-full mt-4" color="primary" type="submit">
                {t('submit')}
              </Button>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
