'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Select, SelectItem, Avatar } from '@heroui/react';
import { toast } from 'sonner';
import { Users, Lock, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { withBase } from '@/app/lib/url';
import { BlockSkeleton } from '@/app/components/ui/skeletons';

interface UserRow {
  email: string;
  role: string;
}

const TEMPLATE = '26px 1fr 150px 130px 30px';

// Admin UI for email → role assignment (persisted to config.json via
// /api/access). Roles are labels; only "admin" is privileged (see access.ts).
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
  const [rows, setRows] = useState<UserRow[]>([]);
  const [roleOptions, setRoleOptions] = useState<string[]>(['admin', 'viewer']);
  const [bootstrapAdmins, setBootstrapAdmins] = useState<string[]>([]);
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
      const data: { users: Record<string, string>; assignableRoles?: string[]; bootstrapAdmins?: string[] } =
        await response.json();

      const pinned = data.bootstrapAdmins ?? [];

      setBootstrapAdmins(pinned);
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

  const commitNewEmail = () => {
    const email = addingEmail?.trim().toLowerCase();

    setAddingEmail(null);
    if (!email) return;
    const next = [...rows, { email, role: 'viewer' }];

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

      <div>
        {bootstrapAdmins.map((email) => (
          <div
            key={`env-${email}`}
            className="grid h-11 items-center gap-2 border-b border-divider px-3"
            style={{ gridTemplateColumns: TEMPLATE }}
          >
            <Avatar className="h-[22px] w-[22px] text-[10px]" name={email} />
            <span className="truncate font-mono text-[12px]">{email}</span>
            <span className="inline-flex h-[19px] w-fit items-center gap-1 rounded-md bg-warning/15 px-1.5 text-[10.5px] font-medium text-warning">
              <Lock size={10} />
              admin · env
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
            <span className="text-[11.5px] text-default-400">viewer</span>
            <span />
          </div>
        )}

        {isLoading ? (
          <div className="p-4">
            <BlockSkeleton lines={3} />
          </div>
        ) : rows.length === 0 && bootstrapAdmins.length === 0 && addingEmail === null ? (
          <p className="p-4 text-[12.5px] text-default-500">{t('nobody')}</p>
        ) : (
          rows.map((row, index) => (
            <div
              key={row.email}
              className="grid h-11 items-center gap-2 border-b border-divider px-3 last:border-0"
              style={{ gridTemplateColumns: TEMPLATE }}
            >
              <Avatar className="h-[22px] w-[22px] text-[10px]" name={row.email} />
              <span className="truncate font-mono text-[12px]">{row.email}</span>
              <Select
                aria-label={t('role')}
                classNames={{ trigger: 'h-7 min-h-7' }}
                isDisabled={isSaving}
                selectedKeys={[row.role]}
                size="sm"
                onChange={(e) => changeRole(index, e.target.value)}
              >
                {roleOptions.map((role) => (
                  <SelectItem key={role}>{role}</SelectItem>
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
          ))
        )}
      </div>

      <div className="border-t border-divider px-4 py-2.5">
        <p className="text-[11.5px] text-default-500">{t.rich('footer', { b: (chunks) => <b>{chunks}</b> })}</p>
      </div>
    </section>
  );
}
