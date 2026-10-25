import { applyTag, suggestTags } from '@/app/lib/tm/tag-suggestions';

const known = [
  { tag: '@smoke', count: 9 },
  { tag: '@new_upsell', count: 4 },
  { tag: '@upsell', count: 3 },
  { tag: '@api', count: 1 },
];

describe('suggestTags', () => {
  it('suggests the most used tags when nothing is typed yet', () => {
    expect(suggestTags('', known)).toEqual(['@smoke', '@new_upsell', '@upsell', '@api']);
  });

  it('matches the tag being typed after the last comma, prefix matches first', () => {
    expect(suggestTags('@smoke, ups', known)).toEqual(['@upsell', '@new_upsell']);
    expect(suggestTags('@smoke, @UP', known)).toEqual(['@upsell', '@new_upsell']);
  });

  it('skips tags already in the field and exact matches', () => {
    expect(suggestTags('@smoke, ', known)).toEqual(['@new_upsell', '@upsell', '@api']);
    expect(suggestTags('@api', known)).toEqual([]);
  });

  it('caps the list', () => {
    expect(suggestTags('', known, 2)).toEqual(['@smoke', '@new_upsell']);
  });
});

describe('applyTag', () => {
  it('replaces the tag being typed and leaves room for the next one', () => {
    expect(applyTag('@smoke, ups', '@upsell')).toBe('@smoke, @upsell, ');
    expect(applyTag('', '@smoke')).toBe('@smoke, ');
    expect(applyTag('@smoke, ', '@api')).toBe('@smoke, @api, ');
  });
});
