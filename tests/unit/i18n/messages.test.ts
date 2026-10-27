import { IntlMessageFormat } from 'intl-messageformat';
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';

import en from '@/messages/en.json';
import uk from '@/messages/uk.json';

type Tree = { [key: string]: string | Tree };

const flatten = (tree: Tree, prefix = ''): Record<string, string> =>
  Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;

    return typeof value === 'string' ? { ...acc, [path]: value } : { ...acc, ...flatten(value, path) };
  }, {});

// Argument names used by a message (plural/select/argument/date/number/tag).
const placeholders = (elements: MessageFormatElement[], out = new Set<string>()): Set<string> => {
  for (const el of elements) {
    if (el.type !== TYPE.literal && el.type !== TYPE.pound && 'value' in el) out.add(String(el.value));
    if (el.type === TYPE.plural || el.type === TYPE.select) {
      Object.values(el.options).forEach((option) => placeholders(option.value, out));
    }
    if (el.type === TYPE.tag) placeholders(el.children, out);
  }

  return out;
};

const pluralOptionSets = (elements: MessageFormatElement[]): string[][] =>
  elements.flatMap((el) =>
    el.type === TYPE.plural
      ? [Object.keys(el.options), ...Object.values(el.options).flatMap((option) => pluralOptionSets(option.value))]
      : [],
  );

const enFlat = flatten(en as Tree);
const ukFlat = flatten(uk as Tree);

describe('messages', () => {
  it('en and uk have the same keys', () => {
    expect(Object.keys(ukFlat).sort()).toEqual(Object.keys(enFlat).sort());
  });

  it.each(Object.keys(enFlat))('%s parses and has matching placeholders', (key) => {
    const enPlaceholders = [...placeholders(parse(enFlat[key]))].sort();
    const ukPlaceholders = [...placeholders(parse(ukFlat[key] ?? ''))].sort();

    expect(ukPlaceholders).toEqual(enPlaceholders);
  });

  it('Ukrainian plurals define one/few/many/other', () => {
    for (const [key, message] of Object.entries(ukFlat)) {
      for (const options of pluralOptionSets(parse(message))) {
        const categories = options.filter((option) => !option.startsWith('=')).sort();

        expect({ key, categories }).toEqual({ key, categories: ['few', 'many', 'one', 'other'] });
      }
    }
  });

  it.each([
    [0, '0 прогонів'],
    [1, '1 прогін'],
    [2, '2 прогони'],
    [4, '4 прогони'],
    [5, '5 прогонів'],
    [11, '11 прогонів'],
    [12, '12 прогонів'],
    [21, '21 прогін'],
    [22, '22 прогони'],
    [25, '25 прогонів'],
    [111, '111 прогонів'],
  ])('uk common.runs(%i) → %s', (count, expected) => {
    expect(new IntlMessageFormat(ukFlat['common.runs'], 'uk').format({ count })).toBe(expected);
  });
});
