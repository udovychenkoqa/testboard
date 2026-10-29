import { formatAgo, formatDayHeading, formatRelativeDay } from '@/i18n/dates';

const relative = { today: (t: string) => `Today, ${t}`, yesterday: (t: string) => `Yesterday, ${t}` };
const heading = { today: (d: string) => `Today · ${d}`, yesterday: (d: string) => `Yesterday · ${d}` };
const ago = {
  justNow: 'just now',
  minutes: (n: number) => `${n} min ago`,
  hours: (n: number) => `${n} h ago`,
  days: (n: number) => `${n} d ago`,
};

const local = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s);

describe('formatRelativeDay', () => {
  const now = local(2026, 7, 8, 0, 5);

  it('today just after midnight', () => {
    expect(formatRelativeDay(local(2026, 7, 8, 0, 1), 'en-GB', relative, now)).toBe('Today, 00:01');
  });
  it('yesterday just before midnight', () => {
    expect(formatRelativeDay(local(2026, 7, 7, 23, 59), 'en-GB', relative, now)).toBe('Yesterday, 23:59');
  });
  it('older dates show day and month without year', () => {
    expect(formatRelativeDay(local(2026, 7, 5, 14, 41), 'en-GB', relative, now)).toBe('5 Jul, 14:41');
  });
  it('other years include the year', () => {
    expect(formatRelativeDay(local(2025, 12, 31, 9, 0), 'en-GB', relative, now)).toBe('31 Dec 2025, 09:00');
  });
  it('yesterday across New Year', () => {
    expect(formatRelativeDay(local(2025, 12, 31, 22, 0), 'en-GB', relative, local(2026, 1, 1, 8, 0))).toBe(
      'Yesterday, 22:00',
    );
  });
  it('uses Ukrainian month names', () => {
    expect(formatRelativeDay(local(2026, 7, 5, 14, 41), 'uk', relative, now)).toMatch(/^5 лип\.?, 14:41$/);
  });
});

describe('formatDayHeading', () => {
  it('labels today and older days', () => {
    const now = local(2026, 7, 8, 12);

    expect(formatDayHeading(local(2026, 7, 8, 9), 'en-GB', heading, now)).toBe('Today · 8 Jul');
    expect(formatDayHeading(local(2026, 7, 7, 9), 'en-GB', heading, now)).toBe('Yesterday · 7 Jul');
    expect(formatDayHeading(local(2026, 6, 28, 9), 'en-GB', heading, now)).toBe('28 Jun');
  });
});

describe('formatAgo', () => {
  const now = local(2026, 7, 8, 12, 0);

  it.each([
    [local(2026, 7, 8, 11, 59, 30), 'just now'],
    [local(2026, 7, 8, 11, 55), '5 min ago'],
    [local(2026, 7, 8, 9, 0), '3 h ago'],
    [local(2026, 7, 6, 12, 0), '2 d ago'],
    [local(2026, 7, 8, 12, 30), 'just now'],
  ])('%p → %p', (from, expected) => {
    expect(formatAgo(from, ago, now)).toBe(expected);
  });
});
