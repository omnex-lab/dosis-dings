// Pure date functions over plain {y, m, d} dates (UTC-safe, no local Date math).

const DAY_MS = 86400000;

export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isValidDate(dt) {
  if (!dt) return false;
  if (!Number.isInteger(dt.y) || !Number.isInteger(dt.m) || !Number.isInteger(dt.d)) return false;
  if (dt.y < 1 || dt.y > 9999) return false;
  if (dt.m < 1 || dt.m > 12) return false;
  return dt.d >= 1 && dt.d <= daysInMonth(dt.y, dt.m);
}

/** Parse "TT.MM.JJJJ" (leading zeros optional) -> {y,m,d} | null */
export function parseDE(s) {
  if (typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const dt = { d: +m[1], m: +m[2], y: +m[3] };
  return isValidDate(dt) ? dt : null;
}

export function formatDE(dt) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(dt.d)}.${p(dt.m)}.${dt.y}`;
}

export function toISOInput(dt) {
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.y}-${p(dt.m)}-${p(dt.d)}`;
}

export function parseISOInput(s) {
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const dt = { y: +m[1], m: +m[2], d: +m[3] };
  return isValidDate(dt) ? dt : null;
}

export function ordinal(dt) {
  return Math.floor(Date.UTC(dt.y, dt.m - 1, dt.d) / DAY_MS);
}

export function fromOrdinal(o) {
  const dt = new Date(o * DAY_MS);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export function addDays(dt, n) {
  return fromOrdinal(ordinal(dt) + n);
}

export function addMonthsClamped(dt, n) {
  const total = dt.y * 12 + (dt.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12 + 1;
  return { y, m, d: Math.min(dt.d, daysInMonth(y, m)) };
}

export function addYearsClamped(dt, n) {
  return addMonthsClamped(dt, n * 12);
}

/** b - a in calendar days (may be negative) */
export function diffDays(a, b) {
  return ordinal(b) - ordinal(a);
}

/** 1 = Monday … 7 = Sunday */
export function isoWeekday(dt) {
  return (new Date(Date.UTC(dt.y, dt.m - 1, dt.d)).getUTCDay() + 6) % 7 + 1;
}

/**
 * Calendar weeks (Monday first): the Monday n ISO weeks after dt's week.
 * Start on a Monday: the Monday n*7 days later. n = 0 returns dt.
 */
export function addWeeks(dt, n) {
  if (n === 0) return dt;
  const monday = addDays(dt, -(isoWeekday(dt) - 1));
  return addDays(monday, n * 7);
}

export const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function jsDay(dt) {
  return new Date(Date.UTC(dt.y, dt.m - 1, dt.d)).getUTCDay();
}

export function weekdayName(dt) {
  return WEEKDAYS[jsDay(dt)];
}

export function weekdayShort(dt) {
  return WEEKDAYS_SHORT[jsDay(dt)];
}

/** The user's local calendar day as a plain date. */
export function today() {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
}
