// Client-safe (no I/O): shared by the server store and the components that show people.

export interface PersonName {
  firstName: string;
  lastName: string;
}

// "First Last" when the person filled it in, otherwise whatever we already show (their email, "autotests", …).
export const displayName = (profile: PersonName | undefined | null, fallback: string): string =>
  [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || fallback;
