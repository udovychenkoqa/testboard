'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SelectItem, Avatar } from '@heroui/react';
import { toast } from 'sonner';
import { Users, Lock, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Select } from '@/app/components/ui/select';
import { withBase } from '@/app/lib/url';
import { BlockSkeleton } from '@/app/components/ui/skeletons';
import { PersonAvatar } from '@/app/components/person-avatar';
import { usePeople } from '@/app/hooks/usePeople';
import { ASSIGNABLE_ROLES, DEFAULT_ROLE, ROLES } from '@/app/lib/access';

interface UserRow {
  email: string;
  role: string;
}

// Somebody who has signed in (see signIns.ts); `name` is what the sign-in provider gave.
interface SeenPerson {
  email: string;
  name: string;
}

const TEMPLATE = '26px 1fr 150px 130px 30px';

const ROLE_ORDER = [ROLES.administrator, ROLES.member] as const;

type RoleKey = (typeof ROLE_ORDER)[number];

// The email, with the name from the person's profile in front once they have filled it in.
const PersonLine: React.FC<{ email: string; name: string }> = ({ email, name }) => (
  <span className="flex min-w-0 items-baseline gap-2">
    {name !== email && <span className="truncate text-[12.5px] font-medium">{name}</span>}
    <span className="truncate font-mono text-[12px] text-default-500">{email}</span>
  </span>
);

// Admin UI for email → role assignment (persisted to config.json via /api/access), with a Qase-style
// table of what each role is. Administrators from the server config are shown locked (see access.ts).
// Every row change saves immediately — POST /api/access is already atomic
// over the full user map, so there's no partial-save risk.
interface AccessCardProps {
  apiToken?: string;
  authRequired?: boolean;
  onCountChange?: (count: number) => void;
}

export function AccessCard({ apiToken, authRequired, onCountChange }: Readonly<AccessCardProps>) {
  const t = useTranslations('settings.access');
  const tp = useTranslations('settings.page');
  const { nameOf, profileOf } = usePeople();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [roleOptions, setRoleOptions] = useState<string[]>([...ASSIGNABLE_ROLES]);
  const [bootstrapAdmins, setBootstrapAdmins] = useState<string[]>([]);
  const [seen, setSeen] = useState<SeenPerson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [addingEmail, setAddingEmail] = useState<string | null>(null);
  const newEmailRef = useRef<HTMLInputElement>(null);

  const authHeaders = (): HeadersInit => (apiToken ? { Authorization: apiToken } : {});

  useEffect(() => {
    onCountChange?.(rows.length + bootstrapAdmins.length);
  }, [rows.length, bootstrapAdmins.length, onCountChange]);

  useEffect(() => {
    if (addingEmail !== null) newEmailRef.current?.focus();
  }, [addingEmail !== null]);

  const load = useCallback(async () => {
    try {
      const response = await fetch(withBase(`/api/access?t=${Date.now()}`), {
        headers: authHeaders(),
        cache: 'no-store',
      });

      if (!response.ok) throw new Error(await response.text());
      const data: {
        users: Record<string, string>;
        seen?: SeenPerson[];
        assignableRoles?: string[];
        bootstrapAdmins?: string[];
      } = await response.json();

      const pinned = data.bootstrapAdmins ?? [];

      setBootstrapAdmins(pinned);
      setSeen(data.seen ?? []);
      setRows(
        Object.entries(data.users ?? {})
          .filter(([email]) => !pinned.includes(email.toLowerCase()))
          .map(([email, role]) => ({ email, role })),
      );
      if (data.assignableRoles?.length) setRoleOptions([...data.assignableRoles]);
    } catch (error) {
      toast.error(t('readFailed', { error: (error as Error).message }));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiToken]);

  useEffect(() => {
    load();
  }, [load]);

  const persist = async (nextRows: UserRow[]) => {
    const users: Record<string, string> = {};

    for (const row of nextRows) {
      const email = row.email.trim().toLowerCase();

      if (email) users[email] = row.role;
    }

    setIsSaving(true);
    try {
      const response = await fetch(withBase('/api/access'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ users }),
      });

      if (!response.ok) throw new Error(await response.text());
      const data: { users: Record<string, string> } = await response.json();

      setRows(Object.entries(data.users ?? {}).map(([email, role]) => ({ email, role })));
    } catch (error) {
      toast.error(tp('saveFailed', { error: (error as Error).message }));
    } finally {
      setIsSaving(false);
    }
  };

  // Signed in, but nobody gave them a role: Members by default. Listed so the whole team is visible; picking
  // a role for one of them turns it into an ordinary assigned row.
  const defaultMembers = seen.filter(
    (person) => !bootstrapAdmins.includes(person.email) && !rows.some((row) => row.email === person.email),
  );
  const seenName = (email: string) => seen.find((person) => person.email === email)?.name;
  // The profile name wins; before a profile is filled in, the name from the sign-in provider.
  const personName = (email: string) => (nameOf(email) !== email ? nameOf(email) : seenName(email) || email);

  const assignRole = (email: string, role: string) => {
    if (role === DEFAULT_ROLE) return;
    const next = [...rows, { email, role }];

    setRows(next);
    persist(next);
  };

  const changeRole = (index: number, role: string) => {
    const next = rows.map((row, i) => (i === index ? { ...row, role } : row));

    setRows(next);
    persist(next);
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);

    setRows(next);
    persist(next);
  };

  // Known role names get their label; anything else (never sent by the API) shows as is.
  const roleLabel = (role: string) => (ROLE_ORDER.includes(role as RoleKey) ? t(`roleName.${role as RoleKey}`) : role);
  // Administrators from the server config count too; they are listed locked below.
  const usersIn = (role: RoleKey) =>
    rows.filter((row) => row.role === role).length +
    (role === ROLES.administrator ? bootstrapAdmins.length : 0) +
    (role === DEFAULT_ROLE ? defaultMembers.length : 0);

  const commitNewEmail = () => {
    const email = addingEmail?.trim().toLowerCase();

    setAddingEmail(null);
    if (!email) return;
    const next = [...rows, { email, role: DEFAULT_ROLE }];

    setRows(next);
    persist(next);
  };

  return (
    <section className="scroll-mt-3 overflow-hidden rounded-xl border border-divider bg-content1" id="users">
      <div className="flex h-10 items-center gap-2 border-b border-divider px-4">
        <Users className="text-primary" size={15} />
        <span className="text-[13px] font-semibold">{t('title')}</span>
        <span
          className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ${
            authRequired ? 'bg-success/15 text-success' : 'bg-default-100 text-default-500'
          }`}
        >
          {authRequired ? t('signInEnabled') : t('signInDisabled')}
        </span>
        <button
          className="ml-auto inline-flex h-[26px] items-center gap-1 rounded-lg border border-default-200 px-2.5 text-xs text-default-600 hover:bg-default-100"
          type="button"
          onClick={() => setAddingEmail('')}
        >
          <Plus size={13} />
          {t('user')}
        </button>
      </div>

      <div className="border-b border-divider">
        <div className="grid h-8 grid-cols-[1fr_auto] items-center gap-3 px-4 text-[10.5px] font-medium uppercase tracking-wide text-default-400">
          <span>{t('roleColumn')}</span>
          <span>{t('usersColumn')}</span>
        </div>
        {ROLE_ORDER.map((role) => (
          <div key={role} className="grid grid-cols-[1fr_auto] items-start gap-3 border-t border-divider px-4 py-2.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-semibold">{t(`roleName.${role}`)}</span>
                {role === DEFAULT_ROLE && (
                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10.5px] font-medium text-primary">
                    {t('defaultBadge')}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11.5px] leading-snug text-default-500">{t(`roleDesc.${role}`)}</p>
            </div>
            <span className="whitespace-nowrap pt-0.5 font-mono text-[11.5px] text-default-500">
              {t('usersCount', { count: usersIn(role) })}
            </span>
          </div>
        ))}
      </div>

      <div>
        {bootstrapAdmins.map((email) => (
          <div
            key={`env-${email}`}
            className="grid h-11 items-center gap-2 border-b border-divider px-3"
            style={{ gridTemplateColumns: TEMPLATE }}
          >
            <PersonAvatar
              avatarUpdatedAt={profileOf(email)?.avatarUpdatedAt}
              className="h-[22px] w-[22px] text-[10px]"
              email={email}
              name={personName(email)}
            />
            <PersonLine email={email} name={personName(email)} />
            <span
              className="inline-flex h-[19px] w-fit items-center gap-1 rounded-md bg-warning/15 px-1.5 text-[10.5px] font-medium text-warning"
              title={t('lockedHint')}
            >
              <Lock size={10} />
              {t('roleName.administrator')}
            </span>
            <span />
            <span />
          </div>
        ))}

        {addingEmail !== null && (
          <div
            className="grid h-11 items-center gap-2 border-b border-divider px-3"
            style={{ gridTemplateColumns: TEMPLATE }}
          >
            <Avatar className="h-[22px] w-[22px] text-[10px]" name="?" />
            <input
              ref={newEmailRef}
              className="h-8 min-w-0 rounded-lg border border-default-200 bg-content2 px-2 font-mono text-[12px] outline-none focus:border-primary"
              placeholder="user@example.com" // i18n-ignore — example address
              type="email"
              value={addingEmail}
              onBlur={commitNewEmail}
              onChange={(e) => setAddingEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commitNewEmail()}
            />
            <span className="text-[11.5px] text-default-400">{roleLabel(DEFAULT_ROLE)}</span>
            <span />
          </div>
        )}

        {isLoading ? (
          <div className="p-4">
            <BlockSkeleton lines={3} />
          </div>
        ) : rows.length === 0 && defaultMembers.length === 0 && bootstrapAdmins.length === 0 && addingEmail === null ? (
          <p className="p-4 text-[12.5px] text-default-500">{t('nobody')}</p>
        ) : (
          <>
            {rows.map((row, index) => (
              <div
                key={row.email}
                className="grid h-11 items-center gap-2 border-b border-divider px-3 last:border-0"
                style={{ gridTemplateColumns: TEMPLATE }}
              >
                <PersonAvatar
                  avatarUpdatedAt={profileOf(row.email)?.avatarUpdatedAt}
                  className="h-[22px] w-[22px] text-[10px]"
                  email={row.email}
                  name={personName(row.email)}
                />
                <PersonLine email={row.email} name={personName(row.email)} />
                <Select
                  aria-label={t('role')}
                  classNames={{ trigger: 'h-7 min-h-7' }}
                  isDisabled={isSaving}
                  selectedKeys={[row.role]}
                  size="sm"
                  onChange={(e) => changeRole(index, e.target.value)}
                >
                  {roleOptions.map((role) => (
                    <SelectItem key={role}>{roleLabel(role)}</SelectItem>
                  ))}
                </Select>
                <button
                  aria-label={t('remove')}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-default-400 hover:bg-danger/10 hover:text-danger"
                  type="button"
                  onClick={() => removeRow(index)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {defaultMembers.map(({ email }) => (
              <div
                key={`seen-${email}`}
                className="grid h-11 items-center gap-2 border-b border-divider px-3 last:border-0"
                style={{ gridTemplateColumns: TEMPLATE }}
              >
                <PersonAvatar
                  avatarUpdatedAt={profileOf(email)?.avatarUpdatedAt}
                  className="h-[22px] w-[22px] text-[10px]"
                  email={email}
                  name={personName(email)}
                />
                <PersonLine email={email} name={personName(email)} />
                <Select
                  aria-label={t('role')}
                  classNames={{ trigger: 'h-7 min-h-7' }}
                  isDisabled={isSaving}
                  selectedKeys={[DEFAULT_ROLE]}
                  size="sm"
                  onChange={(e) => assignRole(email, e.target.value)}
                >
                  {roleOptions.map((role) => (
                    <SelectItem key={role}>{roleLabel(role)}</SelectItem>
                  ))}
                </Select>
                <span />
              </div>
            ))}
          </>
        )}
      </div>

      <div className="border-t border-divider px-4 py-2.5">
        <p className="text-[11.5px] text-default-500">{t.rich('footer', { b: (chunks) => <b>{chunks}</b> })}</p>
      </div>
    </section>
  );
}
