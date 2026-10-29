import fs from 'fs';
import path from 'path';

// Every UI component (app/**/*.tsx outside API routes) must take its text
// from messages/*.json — new files are covered automatically.
const listUiFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) return entry.name === 'api' ? [] : listUiFiles(full);

    return entry.name.endsWith('.tsx') ? [path.relative(process.cwd(), full)] : [];
  });

const TRANSLATED_FILES = listUiFiles(path.join(process.cwd(), 'app'));

// Proper nouns and code-ish tokens that stay as-is in both languages.
const ALLOWED =
  /^(Testboard|Playwright|Slack|Webhook|admin|tester|viewer|admin · env|Google|GitLab|Qase|Cron|Haiku|Sonnet|Opus|API|URL|JSON|CI|ZIP|PDF|HTML|EN|UK|env|cron|[0-9%.:·—–\-\s]+)$/;

// JSX text never contains code punctuation; that keeps `=>` … `<` spans in
// arrow functions from reading as markup.
const JSX_TEXT = /(?<!=)>\s*([A-Za-zА-Яа-яІіЇїЄєҐґ][^<>{}=;()?&|]*?)\s*[<{]/g;
const ATTR =
  /\b(?:label|title|placeholder|description|aria-label|subtitle|alt)=(["'])([^"'{}]*[A-Za-zА-Яа-я][^"'{}]*)\1/g;
// `label: 'Server'` in config objects (no space before the colon, unlike a ternary).
const LABEL_PROP = /\b(?:label|title|description|placeholder|subtitle):\s*(['`])([^'`]*[A-Za-zА-Яа-я][^'`]*)\1/g;
// Ternary branches that read as prose: capitalised or containing a space.
const TERNARY = /(?:\?|\s:)\s*(['`])([A-ZА-ЯІЇЄҐ][^'`]*|[^'`]*[A-Za-zА-Яа-я]\s+[A-Za-zА-Яа-я][^'`]*)\1/g;
const TOAST = /toast\.(?:success|error|warning|info)\(\s*(['`])([^'`]*[A-Za-zА-Яа-я][^'`]*)\1/g;

// Tailwind class lists (every token has -, :, [ or /, or is a bare utility)
// show up in className ternaries — they are not UI text.
const BARE_UTILITIES = new Set([
  'flex',
  'grid',
  'hidden',
  'block',
  'inline',
  'truncate',
  'uppercase',
  'italic',
  'underline',
  'relative',
  'absolute',
  'group',
]);
const isClassList = (value: string) =>
  value.split(/\s+/).every((token) => /[-:[\]/]/.test(token) || BARE_UTILITIES.has(token));

// Literal UI strings left in a source file. Lines marked `i18n-ignore` and
// comment lines are skipped.
export const findLiterals = (source: string): string[] => {
  const text = source
    .split('\n')
    .filter((line) => !line.includes('i18n-ignore') && !line.trim().startsWith('//') && !line.trim().startsWith('*'))
    .join('\n');
  const hits: string[] = [];

  for (const re of [JSX_TEXT, ATTR, LABEL_PROP, TERNARY, TOAST]) {
    for (const match of text.matchAll(re)) {
      const value = (match[2] ?? match[1]).trim();

      if (value && !ALLOWED.test(value) && !isClassList(value)) hits.push(value);
    }
  }

  return hits;
};

describe('findLiterals', () => {
  it('flags JSX text, UI attributes and toasts', () => {
    expect(findLiterals('<p>Sign out</p>')).toEqual(['Sign out']);
    expect(findLiterals('<Input label="Name" />')).toEqual(['Name']);
    expect(findLiterals("toast.success('Saved')")).toEqual(['Saved']);
    expect(findLiterals('<p className="x">Couldn\'t load: {error}</p>')).toEqual(["Couldn't load:"]);
  });

  it('flags object labels and ternary branches', () => {
    expect(findLiterals("{ id: 'server', label: 'Server', icon: Server }")).toEqual(['Server']);
    expect(findLiterals("{enabled ? 'Enabled' : 'Disabled'}")).toEqual(['Enabled', 'Disabled']);
    expect(findLiterals("const x = ok ? 'Last run passed' : null;")).toEqual(['Last run passed']);
  });

  it('ignores code-ish ternaries and keys', () => {
    expect(findLiterals("const c = ok ? 'bg-success' : 'bg-danger';")).toEqual([]);
    expect(findLiterals("sort === 'createdAt' ? 'descending' : 'ascending'")).toEqual([]);
    expect(findLiterals("{ key: 'createdAt', label: t('created') }")).toEqual([]);
    expect(
      findLiterals("cls={on ? 'text-foreground hover:bg-default-100' : 'pointer-events-none opacity-50'}"),
    ).toEqual([]);
    expect(findLiterals("cls={label ? 'text-xs text-default-400' : 'sr-only'}")).toEqual([]);
    expect(findLiterals("cls={a ? 'flex truncate' : 'hidden'}")).toEqual([]);
  });

  it('ignores translated text, brand names and marked lines', () => {
    expect(findLiterals("<p>{t('signOut')}</p>")).toEqual([]);
    expect(findLiterals('<span>Testboard</span>')).toEqual([]);
    expect(findLiterals('<p>Sign out</p> // i18n-ignore')).toEqual([]);
    expect(findLiterals("const mask = (token) =>\n  token.length <= 8 ? 'x' : 'y';")).toEqual([]);
    expect(findLiterals("const c = (href) =>\n  href === '/reports' ? 1 : 2;\nreturn (\n  <aside />")).toEqual([]);
  });
});

describe('no hard-coded UI strings', () => {
  it.each(TRANSLATED_FILES)('%s', (file) => {
    expect(findLiterals(fs.readFileSync(path.join(process.cwd(), file), 'utf8'))).toEqual([]);
  });
});
