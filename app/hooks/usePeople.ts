'use client';

import type { Profile } from '@/app/lib/profiles';

import { useMemo } from 'react';

import useQuery from '@/app/hooks/useQuery';
import { displayName } from '@/app/lib/profileName';

// Who is who: turns an email the UI has (assignee, "created by", access list) into the name and photo the
// person set in their profile. Anything that isn't a known email ("autotests", "api-key") is shown as is.
export const usePeople = (enabled = true) => {
  const { data } = useQuery<Profile[]>('/api/profiles', { staleTime: 60_000, enabled });

  return useMemo(() => {
    const byEmail = new Map((data ?? []).map((profile) => [profile.email, profile]));
    const profileOf = (who: string | null | undefined) => (who ? byEmail.get(who.trim().toLowerCase()) : undefined);

    return { profileOf, nameOf: (who: string) => displayName(profileOf(who), who) };
  }, [data]);
};
