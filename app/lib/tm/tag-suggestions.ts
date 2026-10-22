// Client-safe helpers for the comma-separated tags field: which known tags to offer, and how to insert one.

interface KnownTag {
  tag: string;
  count: number;
}

const split = (value: string) => value.split(',').map((part) => part.trim());

// "ups" should find "@upsell" as a prefix match, so a leading @ is ignored when comparing.
const norm = (tag: string) => tag.toLowerCase().replace(/^@/, '');

// `known` comes most-used first. The tag being typed is whatever follows the last comma; prefix matches rank
// above substring matches, and tags already in the field are never offered again.
export const suggestTags = (value: string, known: KnownTag[], limit = 8): string[] => {
  const parts = split(value);
  const typing = norm(parts.pop() ?? '');
  const used = new Set(parts.filter(Boolean).map(norm));
  const candidates = known.filter(({ tag }) => !used.has(norm(tag)) && norm(tag) !== typing);
  const prefix = candidates.filter(({ tag }) => norm(tag).startsWith(typing));
  const rest = candidates.filter(({ tag }) => !norm(tag).startsWith(typing) && norm(tag).includes(typing));

  return [...prefix, ...rest].slice(0, limit).map(({ tag }) => tag);
};

export const applyTag = (value: string, tag: string): string => {
  const parts = split(value);

  parts.pop();

  return [...parts.filter(Boolean), tag, ''].join(', ');
};
