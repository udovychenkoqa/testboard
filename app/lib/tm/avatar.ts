// Project avatar like Qase's: initials on a colour picked from the project key. Client-safe, no I/O.

// Full class strings so Tailwind keeps them.
export const AVATAR_COLORS = [
  'bg-indigo-500 text-white',
  'bg-sky-600 text-white',
  'bg-emerald-600 text-white',
  'bg-amber-500 text-white',
  'bg-rose-500 text-white',
  'bg-violet-500 text-white',
  'bg-teal-600 text-white',
  'bg-slate-600 text-white',
] as const;

// First letters of the first two words; a one-word name uses the project code instead (HanimaX → HAN).
export const projectInitials = (name: string, code: string): string => {
  const words = name.split(/\s+/).filter((word) => /\p{L}|\p{N}/u.test(word));

  if (words.length < 2) return code;

  return words
    .slice(0, 2)
    .map((word) => [...word].find((ch) => /\p{L}|\p{N}/u.test(ch)) ?? '')
    .join('')
    .toUpperCase();
};

export const avatarColor = (key: string): (typeof AVATAR_COLORS)[number] => {
  let hash = 0;

  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;

  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};
