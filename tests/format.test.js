import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOutput, expandRamp, planRamp, findIndivisible, countInvalid, findJumps, parseDose, formatDose, normalizeDoseText } from '../js/format.js';

const d = (y, m, day) => ({ y, m, d: day });

test('parseDose: comma and period, empty-ish and invalid', () => {
  assert.equal(parseDose('0,5'), 0.5);
  assert.equal(parseDose('0.5'), 0.5);
  assert.equal(parseDose('25'), 25);
  assert.equal(parseDose('25,0'), 25);
  assert.equal(parseDose(' 0,25 '), 0.25);
  assert.equal(parseDose(''), null);
  assert.equal(parseDose('0.5.5'), null);
  assert.equal(parseDose('-1'), null);
  assert.equal(parseDose('abc'), null);
  assert.equal(parseDose('1,'), null);
  assert.equal(parseDose(null), null);
});

test('formatDose: decimal comma, trailing zeros stripped', () => {
  assert.equal(formatDose(0.5), '0,5');
  assert.equal(formatDose(25), '25');
  assert.equal(formatDose(25.0), '25');
  assert.equal(formatDose(0.25), '0,25');
  assert.equal(formatDose(1.5), '1,5');
});

test('normalizeDoseText', () => {
  assert.equal(normalizeDoseText(''), '0');
  assert.equal(normalizeDoseText('0,50'), '0,5');
  assert.equal(normalizeDoseText('25,0'), '25');
  assert.equal(normalizeDoseText('2.5'), '2,5');
  assert.equal(normalizeDoseText('x'), null);
});

test('acceptance: titration output, Dosis + Tabletten modes', () => {
  const meds = [
    { name: 'Sertralin', mode: 'dosis', unit: '', strength: '' },
    { name: 'Mirtazapin', mode: 'tabletten', unit: '', strength: '15mg' },
  ];
  const rows = [
    { date: d(2026, 12, 2), cells: [[50, 0, 0, 0], [0, 0, 0, 0.5]] },
    { date: d(2026, 12, 9), cells: [[25, 0, 0, 0], [0, 0, 0, 1]] },
  ];
  assert.equal(
    buildOutput(meds, rows),
    [
      'ab 02.12.2026:',
      'Sertralin 50mg-0-0-0',
      'Mirtazapin 15mg 0-0-0-0,5',
      '',
      'ab 09.12.2026:',
      'Sertralin 25mg-0-0-0',
      'Mirtazapin 15mg 0-0-0-1',
    ].join('\n')
  );
});

test('unit appended to every non-zero, zero bare, explicit unit', () => {
  const meds = [{ name: 'Pregabalin', mode: 'dosis', unit: 'mg', strength: '' }];
  const rows = [{ date: d(2026, 12, 2), cells: [[25, 0, 25, 0]] }];
  assert.equal(buildOutput(meds, rows), 'ab 02.12.2026:\nPregabalin 25mg-0-25mg-0');
});

test('custom unit is appended without space', () => {
  const meds = [{ name: 'X', mode: 'dosis', unit: 'µg', strength: '' }];
  const rows = [{ date: d(2026, 12, 2), cells: [[10, 0, 5, 0]] }];
  assert.equal(buildOutput(meds, rows), 'ab 02.12.2026:\nX 10µg-0-5µg-0');
});

test('Tabletten mode with empty strength omits the strength', () => {
  const meds = [{ name: 'Mirtazapin', mode: 'tabletten', unit: '', strength: '' }];
  const rows = [{ date: d(2026, 12, 2), cells: [[0, 0, 0, 0.5]] }];
  assert.equal(buildOutput(meds, rows), 'ab 02.12.2026:\nMirtazapin 0-0-0-0,5');
});

test('consecutive same-date rows merge into one block', () => {
  const meds = [{ name: 'Sertralin', mode: 'dosis', unit: '', strength: '' }];
  const rows = [
    { date: d(2026, 12, 2), cells: [[50, 0, 0, 0]] },
    { date: d(2026, 12, 2), cells: [[25, 0, 0, 0]] },
    { date: d(2026, 12, 9), cells: [[25, 0, 0, 0]] },
  ];
  assert.equal(
    buildOutput(meds, rows),
    [
      'ab 02.12.2026:',
      'Sertralin 50mg-0-0-0',
      'Sertralin 25mg-0-0-0',
      '',
      'ab 09.12.2026:',
      'Sertralin 25mg-0-0-0',
    ].join('\n')
  );
});

test('invalid dose cell prints ?, empty name prints ?', () => {
  const meds = [{ name: '', mode: 'dosis', unit: '', strength: '' }];
  const rows = [{ date: d(2026, 12, 2), cells: [[null, 0, 5, 0]] }];
  assert.equal(buildOutput(meds, rows), 'ab 02.12.2026:\n? ?-0-5mg-0');
  assert.equal(countInvalid(meds, rows), 1);
});

test('no trailing newline, all-zero medication still printed', () => {
  const meds = [{ name: 'Sertralin', mode: 'dosis', unit: '', strength: '' }];
  const rows = [{ date: d(2026, 12, 2), cells: [[0, 0, 0, 0]] }];
  const out = buildOutput(meds, rows);
  assert.equal(out, 'ab 02.12.2026:\nSertralin 0-0-0-0');
  assert.ok(!out.endsWith('\n'));
});

test('findJumps: >= 10x either direction, same med and slot only', () => {
  const meds = [{ name: 'Sertralin', mode: 'dosis', unit: '', strength: '' }];
  const rows = [
    { date: d(2026, 12, 2), cells: [[5, 1, 0, 0.5]] },
    { date: d(2026, 12, 9), cells: [[50, 2, 0, 0.05]] },
    { date: d(2026, 12, 16), cells: [[50, 2, 0, 0.1]] },
  ];
  assert.deepEqual(findJumps(meds, rows), [
    { step: 2, med: 0, slot: 0 },
    { step: 2, med: 0, slot: 3 },
  ]);
});

test('findJumps: zero, invalid and < 10x are ignored', () => {
  const meds = [{ name: 'A', mode: 'dosis', unit: '', strength: '' }];
  const rows = [
    { date: d(2026, 12, 2), cells: [[0, 3, null, 5]] },
    { date: d(2026, 12, 9), cells: [[50, 5, 5, 5]] },
  ];
  assert.deepEqual(findJumps(meds, rows), []);
});

test('findJumps: single row has no jumps', () => {
  const meds = [{ name: 'A', mode: 'dosis', unit: '', strength: '' }];
  assert.deepEqual(findJumps(meds, [{ date: d(2026, 12, 2), cells: [[50, 0, 0, 0]] }]), []);
});

const dd = (n, m = 12) => ({ y: 2026, m, d: n });
const medOf = (extra = {}) => ({ name: 'Escitalopram', mode: 'dosis', unit: '', strength: '', ...extra });

test('ramp: 5 mg, +5 after a week, goal 20 gives 5, 10, 15, 20 weekly', () => {
  const rows = [
    { date: dd(2), cells: [[5, 0, 0, 0]] },
    { date: dd(9), cells: [[10, 0, 0, 0]] },
    { date: dd(30), cells: [[20, 0, 0, 0]] }, // date is replaced by the generated steps
  ];
  assert.equal(planRamp(rows[0].cells, rows[1].cells, rows[2].cells), 2);
  const out = expandRamp(rows);
  assert.deepEqual(out.map((r) => [r.date.d, r.cells[0][0]]), [[2, 5], [9, 10], [16, 15], [23, 20]]);
  assert.equal(
    buildOutput([medOf()], out),
    'ab 02.12.2026:\nEscitalopram 5mg-0-0-0\n\nab 09.12.2026:\nEscitalopram 10mg-0-0-0\n\nab 16.12.2026:\nEscitalopram 15mg-0-0-0\n\nab 23.12.2026:\nEscitalopram 20mg-0-0-0'
  );
});

test('ramp: last step is smaller when the goal is not a multiple; 1 to 7 tablets daily', () => {
  const rows = [
    { date: dd(1), cells: [[5, 0, 0, 0]] },
    { date: dd(8), cells: [[10, 0, 0, 0]] },
    { date: dd(8), cells: [[22, 0, 0, 0]] },
  ];
  assert.deepEqual(expandRamp(rows).map((r) => r.cells[0][0]), [5, 10, 15, 20, 22]);
  // 1 tablet on day 1, 2 on day 2, goal 7: one more tablet per day
  const daily = [
    { date: dd(1), cells: [[1, 0, 0, 0]] },
    { date: dd(2), cells: [[2, 0, 0, 0]] },
    { date: dd(3), cells: [[7, 0, 0, 0]] },
  ];
  assert.deepEqual(expandRamp(daily).map((r) => [r.date.d, r.cells[0][0]]), [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7]]);
});

test('ramp: per slot, descending, edge cases', () => {
  const rows = [
    { date: dd(1), cells: [[100, 0, 50, 0]] },
    { date: dd(8), cells: [[75, 0, 50, 0]] },
    { date: dd(8), cells: [[25, 0, 25, 0]] },
  ];
  const out = expandRamp(rows);
  assert.deepEqual(out.map((r) => r.cells[0]), [[100, 0, 50, 0], [75, 0, 50, 0], [50, 0, 50, 0], [25, 0, 25, 0]]);
  // fewer than 3 rows, interval 0 or invalid cell: unchanged
  assert.equal(expandRamp(rows.slice(0, 2)).length, 2);
  const same = [{ date: dd(1), cells: [[1]] }, { date: dd(1), cells: [[2]] }, { date: dd(1), cells: [[9]] }];
  assert.equal(expandRamp(same), same);
  const bad = [{ date: dd(1), cells: [[1]] }, { date: dd(8), cells: [[null]] }, { date: dd(9), cells: [[9]] }];
  assert.equal(expandRamp(bad), bad);
});

test('findIndivisible: flags doses that do not fit the tablet divisibility', () => {
  const rows = [{ date: dd(1), cells: [[0.5, 1, 0, 0.25]] }];
  const m = (divisible) => [{ name: 'T', mode: 'tabletten', divisible }];
  assert.deepEqual(findIndivisible(m(1), rows).map((x) => x.slot), [0, 3]);
  assert.deepEqual(findIndivisible(m(0.5), rows).map((x) => x.slot), [3]);
  assert.deepEqual(findIndivisible(m(0.25), rows), []);
  assert.deepEqual(findIndivisible([{ name: 'D', mode: 'dosis' }], rows), []);
});
