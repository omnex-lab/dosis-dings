// Pure formatting for doses and the copyable output.

import { formatDE } from './dates.js';

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
