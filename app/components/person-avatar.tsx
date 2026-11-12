'use client';

import { Avatar } from '@heroui/react';

import { withBase } from '@/app/lib/url';

export const avatarUrl = (email: string, avatarUpdatedAt: string) =>
  withBase(`/api/profile/avatar?email=${encodeURIComponent(email)}&v=${encodeURIComponent(avatarUpdatedAt)}`);

// A person's uploaded photo, or their initials when there is none. `fallbackSrc` is the picture the sign-in
// provider gave us (Google), used until the person uploads their own.
export const PersonAvatar: React.FC<{
  email?: string | null;
  name: string;
  avatarUpdatedAt?: string | null;
  fallbackSrc?: string;
  className?: string;
}> = ({ email, name, avatarUpdatedAt, fallbackSrc, className }) => (
  <Avatar
    className={className}
    name={name}
    src={email && avatarUpdatedAt ? avatarUrl(email, avatarUpdatedAt) : fallbackSrc}
  />
);
