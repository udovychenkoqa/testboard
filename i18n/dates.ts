export type DateLabels = { today: (time: string) => string; yesterday: (time: string) => string };
export type HeadingLabels = { today: (day: string) => string; yesterday: (day: string) => string };
export type AgoLabels = {
  justNow: string;
  minutes: (n: number) => string;
  hours: (n: number) => string;
  days: (n: number) => string;
};

export const dayKey = (date: Date | string | number): string => new Date(date).toDateString();

const isYesterday = (date: Date, now: Date) => {
  const yesterday = new Date(now);

  yesterday.setDate(now.getDate() - 1);

  return dayKey(date) === dayKey(yesterday);
};

const shortDay = (date: Date, intl: string, now: Date) =>
  date.toLocaleDateString(intl, {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  });

// "Today, 18:46" / "Yesterday, 18:46" / "8 Jul, 18:46" / "31 Dec 2025, 09:00"
export const formatRelativeDay = (date: Date, intl: string, labels: DateLabels, now = new Date()): string => {
  const time = date.toLocaleTimeString(intl, { hour: '2-digit', minute: '2-digit' });

  if (dayKey(date) === dayKey(now)) return labels.today(time);
  if (isYesterday(date, now)) return labels.yesterday(time);

  return `${shortDay(date, intl, now)}, ${time}`;
};

// Day separator in lists: "Today · 8 Jul" / "Yesterday · 7 Jul" / "28 Jun"
export const formatDayHeading = (date: Date, intl: string, labels: HeadingLabels, now = new Date()): string => {
  const day = shortDay(date, intl, now);

  if (dayKey(date) === dayKey(now)) return labels.today(day);
  if (isYesterday(date, now)) return labels.yesterday(day);

  return day;
};

// "just now" / "5 min ago" / "3 h ago" / "2 d ago"; future times read as "just now".
export const formatAgo = (from: Date, labels: AgoLabels, now = new Date()): string => {
  const minutes = Math.floor(Math.max(0, now.getTime() - from.getTime()) / 60000);

  if (minutes < 1) return labels.justNow;
  if (minutes < 60) return labels.minutes(minutes);
  const hours = Math.floor(minutes / 60);

  if (hours < 24) return labels.hours(hours);

  return labels.days(Math.floor(hours / 24));
};
