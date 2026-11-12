'use client';

import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Switch } from '@heroui/react';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useIsSSR } from '@react-aria/ssr';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronsUpDown, Settings, KeyRound, LogOut, Moon, Languages, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useAuthConfig } from '@/app/hooks/useAuthConfig';
import { usePeople } from '@/app/hooks/usePeople';
import { PersonAvatar } from '@/app/components/person-avatar';
import { displayName } from '@/app/lib/profileName';
import { isAdminRole } from '@/app/lib/access';
import { LanguageSwitch } from '@/app/components/language-switch';

// jwtToken shape leaks how the session was established (see auth.config.ts):
// 'oauth:<email>' for Google, 'api-token' for the API-key path, 'open' when
// auth is disabled. Cheap client-side inference — no need for a real
// provider field on the session for a one-line label in the menu.
const providerLabel = (jwtToken?: string): string | null => {
  if (!jwtToken) return null;
  if (jwtToken.startsWith('oauth:')) return 'google';
  if (jwtToken === 'api-token') return 'api key';
  if (jwtToken === 'open') return null;

  return null;
};

const maskToken = (token: string): string =>
  token.length <= 8 ? '••••••••' : `${token.slice(0, 4)}••••${token.slice(-4)}`;

export const UserMenu: React.FC = () => {
  const t = useTranslations('userMenu');
  const { data: session, status } = useSession();
  const router = useRouter();
  const { authRequired } = useAuthConfig();
  const { theme: themeName, setTheme } = useTheme();
  const isSSR = useIsSSR();
  const tp = useTranslations('profile');
  const { profileOf } = usePeople(status === 'authenticated');

  if (status !== 'authenticated') return null;

  const email = session?.user?.email;
  const profile = profileOf(email);
  // The name from the person's profile wins over the one the sign-in provider gave us.
  const name = displayName(profile, session?.user?.name ?? '') || undefined;
  const image = session?.user?.image ?? undefined;
  const role = session?.user?.role;
  const apiToken = session?.user?.apiToken;
  const shownName = name || email;

  // API-token / no-auth mode has no identity — render nothing.
  if (!shownName) return null;

  const isAdmin = authRequired === false || isAdminRole(role);
  const provider = providerLabel(session?.user?.jwtToken);
  const isDark = !isSSR && themeName?.replace('-mode', '') !== 'light';

  const copyApiKey = () => {
    if (!apiToken) return;
    navigator.clipboard.writeText(apiToken).then(() => toast.success(t('apiKeyCopied')));
  };

  return (
    <Dropdown placement="top-start">
      <DropdownTrigger>
        <button
          className="flex h-11 w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-default-100 data-[open=true]:bg-default-100"
          type="button"
        >
          <PersonAvatar
            avatarUpdatedAt={profile?.avatarUpdatedAt}
            className="h-[26px] w-[26px] shrink-0 text-tiny"
            email={email}
            fallbackSrc={image}
            name={shownName}
          />
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-xs font-medium">{shownName}</span>
            {role && <span className="truncate text-[10px] uppercase tracking-wide text-default-400">{role}</span>}
          </div>
          <ChevronsUpDown className="shrink-0 text-default-400" size={12} />
        </button>
      </DropdownTrigger>
      <DropdownMenu aria-label={t('account')} className="w-[220px] p-1.5" variant="flat">
        <DropdownItem
          key="profile"
          isReadOnly
          showDivider
          className="cursor-default gap-0 rounded-lg px-2.5 py-2 opacity-100 data-[hover=true]:bg-transparent"
        >
          <p className="truncate text-[12.5px] font-semibold">{name ?? t('signedIn')}</p>
          {email && <p className="truncate text-[11px] text-default-400">{email}</p>}
          <div className="mt-1.5 flex gap-1">
            {role && (
              <span className="inline-flex h-[19px] items-center rounded-md bg-primary/15 px-1.5 text-[10.5px] font-semibold capitalize text-primary">
                {role}
              </span>
            )}
            {provider && (
              <span className="inline-flex h-[19px] items-center rounded-md bg-default-100 px-1.5 font-mono text-[10.5px] text-default-600">
                {provider}
              </span>
            )}
          </div>
        </DropdownItem>

        {email ? (
          <DropdownItem
            key="profile-settings"
            className="h-8 rounded-lg px-2.5 text-[12.5px] text-default-600"
            startContent={<UserRound size={14} />}
            onPress={() => router.push('/profile')}
          >
            {tp('menuItem')}
          </DropdownItem>
        ) : null}

        <DropdownItem
          key="theme"
          isReadOnly
          className="cursor-default rounded-lg px-2.5 data-[hover=true]:bg-transparent"
        >
          <div className="flex h-8 items-center justify-between">
            <span className="flex items-center gap-2 text-[12.5px] text-default-600">
              <Moon size={14} />
              {t('darkTheme')}
            </span>
            <Switch
              isSelected={isDark}
              size="sm"
              onValueChange={(selected) => setTheme(selected ? 'dark-mode' : 'light-mode')}
            />
          </div>
        </DropdownItem>

        <DropdownItem
          key="language"
          isReadOnly
          className="cursor-default rounded-lg px-2.5 data-[hover=true]:bg-transparent"
          showDivider={!isAdmin && !apiToken}
        >
          <div className="flex h-8 items-center justify-between">
            <span className="flex items-center gap-2 text-[12.5px] text-default-600">
              <Languages size={14} />
              {t('language')}
            </span>
            <LanguageSwitch />
          </div>
        </DropdownItem>

        {isAdmin ? (
          <DropdownItem
            key="settings"
            className="h-8 rounded-lg px-2.5 text-[12.5px] text-default-600"
            showDivider={!apiToken}
            startContent={<Settings size={14} />}
            onPress={() => router.push('/settings')}
          >
            {t('settings')}
          </DropdownItem>
        ) : null}

        {apiToken ? (
          <DropdownItem
            key="apikey"
            showDivider
            className="h-8 rounded-lg px-2.5 text-[12.5px] text-default-600"
            endContent={<span className="font-mono text-[10.5px] text-default-400">{maskToken(apiToken)}</span>}
            startContent={<KeyRound size={14} />}
            onPress={copyApiKey}
          >
            {t('apiKey')}
          </DropdownItem>
        ) : null}

        <DropdownItem
          key="signout"
          className="h-8 rounded-lg px-2.5 text-[12.5px] text-danger data-[hover=true]:bg-danger/10"
          startContent={<LogOut size={14} />}
          onPress={() => signOut({ callbackUrl: '/login' })}
        >
          {t('signOut')}
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
};
