import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOutput, countInvalid, findJumps, parseDose, formatDose, normalizeDoseText } from '../js/format.js';

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
