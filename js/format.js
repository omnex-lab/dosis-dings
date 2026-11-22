// Pure formatting for doses and the copyable output.

import { addDays, diffDays, formatDE } from './dates.js';

/**
 * Parse a dose string. Accepts non-negative decimals with comma or period
 * ("0.5" and "0,5"). Returns the number, or null if invalid.
 */
export function parseDose(s) {
  if (typeof s !== 'string') return null;
  const t = s.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

/** Format a dose number: decimal comma, trailing zeros stripped (25.0 -> "25", 0.5 -> "0,5"). */
export function formatDose(v) {
  const s = String(Math.round(v * 10000) / 10000);
  return s.replace('.', ',');
}

/** Normalize a dose input value: "" -> "0", valid -> canonical, invalid -> null (keep raw). */
export function normalizeDoseText(text) {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  if (t === '') return '0';
  const v = parseDose(t);
  return v == null ? null : formatDose(v);
}

/**
 * meds:  [{ name, mode: 'dosis'|'tabletten', unit, strength }]
 * rows:  [{ date: {y,m,d}, cells: number[][] | (number|null)[][] }]
 *        cells[medIdx] = [Morgens, Mittags, Abends, Nachts]; null = invalid cell.
 *
 * Consecutive rows on the same date merge into one block.
 */
export function buildOutput(meds, rows) {
  if (!rows.length || !meds.length) return '';
  const lines = [];
  let lastDate = null;
  for (const row of rows) {
    const d = formatDE(row.date);
    if (d !== lastDate) {
      if (lines.length) lines.push('');
      lines.push(`ab ${d}:`);
      lastDate = d;
    }
    meds.forEach((med, mi) => {
      lines.push(medLine(med, row.cells[mi] || []));
    });
  }
  return lines.join('\n');
}

/**
 * Ramp to goal. The last three rows are: A (start), B (first increase), G (goal).
 * The increase B - A is repeated every (B.date - A.date) days until G is
 * reached, per medication and time slot. A slot that is not heading toward
 * its goal holds its value and takes the goal value in the final step.
 */
const MAX_RAMP_STEPS = 400;

function stepsNeeded(a, b, g) {
  const d = b - a;
  const diff = g - b;
  if (d !== 0 && diff * d > 0) return Math.ceil(Math.abs(diff / d) - 1e-9);
  return 0;
}

function rampCells(aCells, bCells, gCells) {
  const all = [...aCells, ...bCells, ...gCells];
  if (all.some((c) => !c || c.some((v) => v == null))) return null;
  return true;
}

/** Number of steps from B up to and including the goal (at least 1). */
export function planRamp(aCells, bCells, gCells) {
  if (!rampCells(aCells, bCells, gCells)) return 1;
  let n = 1;
  for (let mi = 0; mi < gCells.length; mi++) {
    for (let s = 0; s < 4; s++) {
      n = Math.max(n, stepsNeeded(aCells[mi][s], bCells[mi][s], gCells[mi][s]));
    }
  }
  return Math.min(n, MAX_RAMP_STEPS);
}

/** Replace the goal row (last) by the generated ramp rows. Pure; other rows untouched. */
export function expandRamp(rows) {
  if (rows.length < 3) return rows;
  const n = rows.length;
  const [a, b, g] = [rows[n - 3], rows[n - 2], rows[n - 1]];
  const interval = diffDays(a.date, b.date);
  if (interval <= 0 || !rampCells(a.cells, b.cells, g.cells)) return rows;
  const count = planRamp(a.cells, b.cells, g.cells);
  const out = rows.slice(0, n - 1);
  for (let j = 1; j <= count; j++) {
    const cells = g.cells.map((gm, mi) =>
      gm.map((gv, s) => {
        const av = a.cells[mi][s];
        const bv = b.cells[mi][s];
        const need = Math.min(stepsNeeded(av, bv, gv), count);
        if (need > 0) return j >= need ? gv : Math.round((bv + j * (bv - av)) * 10000) / 10000;
        return j === count ? gv : bv;
      })
    );
    out.push({ date: addDays(b.date, j * interval), cells });
  }
  return out;
}

/**
 * Tablet doses that cannot be taken with the chosen divisibility
 * (e.g. 0,5 when tablets are "Ganz"). Returns [{ step (1-based), med, slot }].
 */
export function findIndivisible(meds, rows) {
  const out = [];
  rows.forEach((row, s) => {
    meds.forEach((med, mi) => {
      if (med.mode !== 'tabletten') return;
      const part = [1, 0.5, 0.25].includes(med.divisible) ? med.divisible : 1;
      (row.cells[mi] || []).forEach((v, slot) => {
        if (v == null || v === 0) return;
        const q = v / part;
        if (Math.abs(q - Math.round(q)) > 1e-9) out.push({ step: s + 1, med: mi, slot });
      });
    });
  });
  return out;
}

function medLine(med, vals) {
  const name = (med.name || '').trim() || '?';
  if (med.mode === 'tabletten') {
    const nums = vals.map((v) => (v == null ? '?' : formatDose(v))).join('-');
    const strength = (med.strength || '').trim();
    return strength ? `${name} ${strength} ${nums}` : `${name} ${nums}`;
  }
  const unit = (med.unit || '').trim() || 'mg';
  const parts = vals.map((v) => {
    if (v == null) return '?';
    if (v === 0) return '0';
    return formatDose(v) + unit;
  });
  return `${name} ${parts.join('-')}`;
}

/** Number of invalid dose cells across all rows and medications. */
export function countInvalid(meds, rows) {
  let n = 0;
  for (const row of rows) {
    for (let mi = 0; mi < meds.length; mi++) {
      const cells = row.cells[mi] || [];
      for (const v of cells) if (v == null) n++;
    }
  }
  return n;
}

/**
 * Magnitude guard: doses that jump by a factor of >= 10 (either direction)
 * versus the previous step, same medication and time slot (both non-zero).
 * Returns [{ step (1-based), med (idx), slot (0-3) }].
 */
export function findJumps(meds, rows) {
  const out = [];
  if (rows.length < 2) return out;
  for (let s = 1; s < rows.length; s++) {
    for (let mi = 0; mi < meds.length; mi++) {
      const prev = rows[s - 1].cells[mi] || [];
      const cur = rows[s].cells[mi] || [];
      for (let slot = 0; slot < 4; slot++) {
        const a = prev[slot];
        const b = cur[slot];
        if (a == null || b == null || a === 0 || b === 0) continue;
        if (b >= a * 10 || a >= b * 10) out.push({ step: s + 1, med: mi, slot });
      }
    }
  }
  return out;
}
