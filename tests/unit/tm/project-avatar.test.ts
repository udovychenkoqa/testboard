import { AVATAR_COLORS, avatarColor, projectInitials } from '@/app/lib/tm/avatar';

describe('projectInitials', () => {
  it('takes the first letters of the first two words', () => {
    expect(projectInitials('Getting Started', 'DEMO')).toBe('GS');
    expect(projectInitials('hanimax web admin', 'HW')).toBe('HW');
    expect(projectInitials('  Дизайн   кастингів ', 'DK')).toBe('ДК');
  });

  it('falls back to the code for a one-word name', () => {
    expect(projectInitials('HanimaX', 'HAN')).toBe('HAN');
  });

  it('skips punctuation-only words', () => {
    expect(projectInitials('Hanimax - Web', 'HW')).toBe('HW');
  });
});

describe('avatarColor', () => {
  it('is stable for a key and comes from the palette', () => {
    expect(avatarColor('hanimax')).toBe(avatarColor('hanimax'));
    expect(AVATAR_COLORS).toContain(avatarColor('hanimax'));
  });

  it('spreads different keys over the palette', () => {
    const keys = ['hanimax', 'hanimax-web', 'demo', 'core', 'admin', 'promo', 'qa', 'mobile'];

    expect(new Set(keys.map(avatarColor)).size).toBeGreaterThan(3);
  });
});
