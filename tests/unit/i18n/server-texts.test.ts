import fs from 'fs';

// Cyrillic outside comment lines (Slack/webhook/delivery-log text is English for everyone).
const CYRILLIC_IN_CODE = /^(?!\s*(\/\/|\*)).*[Ѐ-ӿ]/m;

describe('server texts are English', () => {
  it.each(['app/lib/notifications/index.ts', 'app/lib/parser/index.ts'])(
    '%s has no Ukrainian outside comments',
    (file) => {
      expect(fs.readFileSync(file, 'utf8')).not.toMatch(CYRILLIC_IN_CODE);
    },
  );

  it('AI prompts ask for English', () => {
    const src = fs.readFileSync('app/lib/ai/reportSummary.ts', 'utf8');

    expect(src).not.toMatch(/Respond in Ukrainian/);
    expect(src.match(/Respond in English/g)?.length).toBe(2);
  });
});
