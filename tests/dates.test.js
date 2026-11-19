import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../js/dates.js';

const d = (y, m, day) => ({ y, m, d: day });

test('parseDE: valid with and without leading zeros', () => {
  assert.deepEqual(D.parseDE('02.12.2026'), d(2026, 12, 2));
  assert.deepEqual(D.parseDE('2.12.2026'), d(2026, 12, 2));
  assert.deepEqual(D.parseDE(' 02.12.2026 '), d(2026, 12, 2));
});

test('parseDE: invalid inputs', () => {
  assert.equal(D.parseDE('31.02.2026'), null);
  assert.equal(D.parseDE('31.04.2026'), null);
  assert.equal(D.parseDE('02.13.2026'), null);
  assert.equal(D.parseDE('2026-12-02'), null);
  assert.equal(D.parseDE('2.12.26'), null);
  assert.equal(D.parseDE(''), null);
  assert.equal(D.parseDE(null), null);
  assert.equal(D.parseDE('29.02.2026'), null); // not a leap year
  assert.deepEqual(D.parseDE('29.02.2028'), d(2028, 2, 29));
});

test('formatDE pads', () => {
  assert.equal(D.formatDE(d(2026, 12, 2)), '02.12.2026');
  assert.equal(D.formatDE(d(2027, 2, 14)), '14.02.2027');
});

test('addDays acceptance example: 01.12.2026 + 75 = 14.02.2027', () => {
  assert.deepEqual(D.addDays(d(2026, 12, 1), 75), d(2027, 2, 14));
});

test('addDays crosses year and leap year', () => {
  assert.deepEqual(D.addDays(d(2026, 12, 31), 1), d(2027, 1, 1));
  assert.deepEqual(D.addDays(d(2027, 2, 28), 1), d(2027, 3, 1));
  assert.deepEqual(D.addDays(d(2028, 2, 28), 1), d(2028, 2, 29));
});

test('addMonths clamps to last day of month', () => {
  assert.deepEqual(D.addMonthsClamped(d(2027, 1, 31), 1), d(2027, 2, 28));
  assert.deepEqual(D.addMonthsClamped(d(2028, 1, 31), 1), d(2028, 2, 29));
  assert.deepEqual(D.addMonthsClamped(d(2026, 12, 31), -1), d(2026, 11, 30));
  assert.deepEqual(D.addMonthsClamped(d(2027, 3, 31), 11), d(2028, 2, 29));
});

test('addYears clamps acceptance example: 29.02.2028 + 1 Jahr = 28.02.2029', () => {
  assert.deepEqual(D.addYearsClamped(d(2028, 2, 29), 1), d(2029, 2, 28));
});

test('diffDays: 01.12.2026 bis 14.02.2027 = 75 (not inclusive)', () => {
  assert.equal(D.diffDays(d(2026, 12, 1), d(2027, 2, 14)), 75);
  assert.equal(D.diffDays(d(2027, 2, 14), d(2026, 12, 1)), -75);
  assert.equal(D.diffDays(d(2026, 12, 1), d(2026, 12, 1)), 0);
});

test('isoWeekday: Monday = 1, Sunday = 7', () => {
  assert.equal(D.isoWeekday(d(2026, 12, 7)), 1);  // Monday
  assert.equal(D.isoWeekday(d(2026, 12, 13)), 7); // Sunday
  assert.equal(D.isoWeekday(d(2026, 12, 2)), 3);  // Wednesday
});

test('addWeeks: calendar weeks, Monday is first day', () => {
  // Wednesday 02.12.2026 + 1 Woche = Monday 07.12.2026
  assert.deepEqual(D.addWeeks(d(2026, 12, 2), 1), d(2026, 12, 7));
  // Monday + 1 Woche = next Monday
  assert.deepEqual(D.addWeeks(d(2026, 12, 7), 1), d(2026, 12, 14));
  // Sunday + 1 Woche = Monday of the following week
  assert.deepEqual(D.addWeeks(d(2026, 12, 13), 1), d(2026, 12, 14));
  // +2 Wochen from Wednesday lands on the Monday two weeks later
  assert.deepEqual(D.addWeeks(d(2026, 12, 2), 2), d(2026, 12, 14));
  // year boundary
  assert.deepEqual(D.addWeeks(d(2026, 12, 31), 1), d(2027, 1, 4));
  // n = 0 returns the date itself
  assert.deepEqual(D.addWeeks(d(2026, 12, 2), 0), d(2026, 12, 2));
});

test('weekday names', () => {
  assert.equal(D.weekdayName(d(2027, 2, 14)), 'Sonntag');
  assert.equal(D.weekdayName(d(2026, 12, 7)), 'Montag');
  assert.equal(D.weekdayShort(d(2026, 12, 7)), 'Mo');
  assert.equal(D.weekdayShort(d(2026, 12, 13)), 'So');
});

test('ISO input roundtrip (hidden <input type="date">)', () => {
  const dt = d(2026, 12, 2);
  assert.equal(D.toISOInput(dt), '2026-12-02');
  assert.deepEqual(D.parseISOInput('2026-12-02'), dt);
  assert.equal(D.parseISOInput('2026-02-30'), null);
});
