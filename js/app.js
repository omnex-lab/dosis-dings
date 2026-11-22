// Dosis-Dings — state, rendering, event handling.
// State lives in plain objects; rendering derives from it.

import * as D from './dates.js';
import { buildOutput, expandRamp, findIndivisible, planRamp, countInvalid, findJumps, normalizeDoseText, parseDose } from './format.js';

const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

const SLOTS = ['Morgens', 'Mittags', 'Abends', 'Nachts'];
let uid = 0;
const nextId = () => ++uid;

const CALENDAR_SVG =
  '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm1 5v-1H4a1 1 0 0 0-1 1v1h14V7a1 1 0 0 0-1-1h-5v1a1 1 0 1 1-2 0Zm-3 3v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5H4Z"/></svg>';
const TRASH_SVG =
  '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 2a1 1 0 0 0-1 1v1H4a1 1 0 0 0 0 2h1v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6h1a1 1 0 1 0 0-2h-3V3a1 1 0 0 0-1-1H8Zm1 2h2v1H9V4Zm-3 4h8v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V8Z"/></svg>';

/* ------------------------------------------------------------------ */
/* Dirty tracking (leave warning)                                      */
/* ------------------------------------------------------------------ */

let dirty = false;
function markDirty() {
  if (dirty) return;
  dirty = true;
  window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    e.returnValue = '';
  });
}

/* ------------------------------------------------------------------ */
/* Date field component                                                */
/* ------------------------------------------------------------------ */

const supportsShowPicker = 'showPicker' in HTMLInputElement.prototype;

/**
 * Text input (TT.MM.JJJJ, D.M.YYYY accepted) + calendar button via a hidden
 * <input type="date"> (showPicker()). Where showPicker is unavailable the
 * visible field itself is a native date input and the button is hidden.
 *
 * opts: { value, compact, disabled, ariaLabel, showWeekday, revertOnBlur,
 *         beforeDate: () => {y,m,d}|null, onCommit: (d|null) => void }
 *
 * revertOnBlur: invalid / too-early text is kept with a red border while
 * focused, then reverts to the last valid date on blur.
 * soft (default): invalid text stays (red border + message) and commits null.
 */
function createDateField(opts) {
  const {
    value = null,
    compact = false,
    disabled = false,
    ariaLabel = 'Datum',
    showWeekday = false,
    revertOnBlur = false,
    beforeDate = null,
    onCommit = () => {},
  } = opts;

  const root = el('span', compact ? 'date-field compact' : 'date-field');
  const row = el('span', 'date-field-row');
  const err = el('p', 'error-text');
  err.hidden = true;

  let input, hidden, btn, weekdayEl;
  let dt = value ? { ...value } : null;

  if (supportsShowPicker) {
    input = el('input');
    input.type = 'text';
    input.placeholder = 'TT.MM.JJJJ';
    input.inputMode = 'numeric';
    input.setAttribute('aria-label', ariaLabel);
    hidden = el('input');
    hidden.type = 'date';
    hidden.className = 'visually-hidden';
    hidden.tabIndex = -1;
    btn = el('button', 'icon-btn small');
    btn.type = 'button';
    btn.setAttribute('aria-label', `Kalender öffnen: ${ariaLabel}`);
    btn.innerHTML = CALENDAR_SVG;
    btn.addEventListener('click', () => {
      hidden.value = dt ? D.toISOInput(dt) : '';
      try {
        hidden.showPicker();
      } catch {
        /* not critical */
      }
    });
    hidden.addEventListener('change', () => {
      const d = D.parseISOInput(hidden.value);
      if (d && commit(d)) input.value = D.formatDE(dt);
    });
    row.append(input, btn);
    root.append(row, hidden);
  } else {
    input = el('input');
    input.type = 'date';
    input.setAttribute('aria-label', ariaLabel);
    row.append(input);
    root.append(row);
  }
  if (showWeekday) {
    weekdayEl = el('span', 'weekday');
    row.append(weekdayEl);
  }
  root.append(err);

  function renderWeekday() {
    if (weekdayEl) weekdayEl.textContent = dt ? D.weekdayShort(dt) : '';
  }

  function setErr(msg) {
    input.classList.toggle('invalid', !!msg);
    err.textContent = msg || '';
    err.hidden = !msg;
  }

  /** Apply a candidate date. Returns false if rejected (too early). */
  function commit(d) {
    if (beforeDate) {
      const min = beforeDate();
      if (min && D.diffDays(min, d) > 0) {
        setErr('Vor dem vorigen Schritt');
        return false;
      }
    }
    dt = { ...d };
    input.value = D.formatDE(dt);
    setErr('');
    renderWeekday();
    onCommit(dt);
    return true;
  }

  input.addEventListener('input', () => {
    if (revertOnBlur) {
      // Step dates: the change is only applied on blur, but give live
      // feedback when the typed (complete) date is too early.
      const d = D.parseDE(input.value);
      if (d && beforeDate) {
        const min = beforeDate();
        setErr(min && D.diffDays(min, d) > 0 ? 'Vor dem vorigen Schritt' : '');
      } else {
        setErr('');
      }
      return;
    }
    const d = D.parseDE(input.value);
    if (d) {
      if (!commit(d)) {
        /* too early: keep typed text, red border, revert on blur */
      }
    } else if (input.value.trim() === '') {
      dt = null;
      setErr('');
      renderWeekday();
      onCommit(null);
    } else {
      setErr(''); // typing in progress
    }
  });

  input.addEventListener('blur', () => {
    const text = input.value.trim();
    if (revertOnBlur) {
      if (dt) {
        input.value = D.formatDE(dt);
        renderWeekday();
      }
      setErr('');
      return;
    }
    if (text === '') {
      dt = null;
      setErr('');
      renderWeekday();
      onCommit(null);
      return;
    }
    const d = D.parseDE(text);
    if (d) {
      input.value = D.formatDE(d);
      dt = d;
      setErr('');
      renderWeekday();
      onCommit(dt);
    } else {
      setErr('Ungültiges Datum');
      onCommit(null);
    }
  });

  if (disabled) {
    input.disabled = true;
    if (btn) btn.disabled = true;
  }

  // Initial render
  input.value = dt ? D.formatDE(dt) : '';
  renderWeekday();

  return {
    root,
    input,
    set(d, { silent = false } = {}) {
      dt = d ? { ...d } : null;
      input.value = dt ? D.formatDE(dt) : '';
      setErr('');
      renderWeekday();
      if (!silent) onCommit(dt);
    },
    setDisabled(v) {
      input.disabled = v;
      if (btn) btn.disabled = v;
    },
    get: () => (dt ? { ...dt } : null),
  };
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                   */
/* ------------------------------------------------------------------ */

function segmented(labels, initial, onPick, label) {
  const box = el('div', 'segmented');
  box.setAttribute('role', 'group');
  if (label) box.setAttribute('aria-label', label);
  const buttons = labels.map((text, i) => {
    const b = el('button', '', text);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(i === initial));
    b.addEventListener('click', () => {
      buttons.forEach((x, j) => x.setAttribute('aria-pressed', String(j === i)));
      onPick(i);
    });
    return b;
  });
  box.append(...buttons);
  return { root: box, buttons };
}

/* ------------------------------------------------------------------ */
/* Clipboard                                                           */
/* ------------------------------------------------------------------ */

async function copyText(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/* ------------------------------------------------------------------ */
/* Tab: Datumsrechner                                                  */
/* ------------------------------------------------------------------ */

function fieldBlock(labelText, control) {
  const block = el('div', 'field-block');
  const label = el('label', 'field-label', labelText);
  block.append(label, control);
  return block;
}

function initDateCalc() {
  const form = $('calc-form');
  let op = 'add';
  let resultDate = null;

  const start = createDateField({ value: null, ariaLabel: 'Startdatum', onCommit: update });
  const calcStart = start;

  const opSeg = segmented(['+ Addieren', '− Subtrahieren'], 0, (i) => {
    op = i === 0 ? 'add' : 'sub';
    update();
  }, 'Rechenart');

  const count = el('input');
  count.type = 'text';
  count.inputMode = 'numeric';
  count.className = 'count-input';
  count.setAttribute('aria-label', 'Anzahl');
  count.placeholder = 'z. B. 3';

  const unit = el('select');
  unit.setAttribute('aria-label', 'Einheit');
  for (const u of ['Tage', 'Wochen', 'Monate', 'Jahre']) {
    const o = el('option', '', u);
    o.value = u;
    unit.append(o);
  }

  form.append(
    fieldBlock('Startdatum', calcStart.root),
    fieldBlock('Rechenart', opSeg.root),
    fieldBlock('Anzahl', count),
    fieldBlock('Einheit', unit)
  );

  function update() {
    const s = calcStart.get();
    const text = count.value.trim();
    let ok = false;
    let d = null;
    if (s) {
      if (text === '') {
        count.classList.remove('invalid');
      } else if (/^\d+$/.test(text)) {
        const k = op === 'add' ? +text : -+text;
        d =
          unit.value === 'Tage'
            ? D.addDays(s, k)
            : unit.value === 'Wochen'
              ? D.addWeeks(s, k)
              : unit.value === 'Monate'
                ? D.addMonthsClamped(s, k)
                : D.addYearsClamped(s, k);
        ok = true;
        count.classList.remove('invalid');
      } else {
        count.classList.add('invalid');
      }
    }
    resultDate = ok ? d : null;
    $('calc-date').textContent = ok ? D.formatDE(d) : '–';
    $('calc-weekday').textContent = ok ? D.weekdayName(d) : '';
  }

  count.addEventListener('input', update);
  unit.addEventListener('change', update);

  $('calc-copy').addEventListener('click', async () => {
    if (resultDate) await copyText(D.formatDE(resultDate));
  });

  // Differenz card
  const diffForm = $('diff-form');
  const von = createDateField({ value: null, ariaLabel: 'Von', onCommit: updateDiff });
  const bis = createDateField({ value: null, ariaLabel: 'Bis', onCommit: updateDiff });
  diffForm.append(fieldBlock('Von', von.root), fieldBlock('Bis', bis.root));

  let diffValue = null;
  function updateDiff() {
    const a = von.get();
    const b = bis.get();
    if (!a || !b) {
      diffValue = null;
      $('diff-value').textContent = '–';
      $('diff-sub').textContent = '';
      return;
    }
    const n = D.diffDays(a, b);
    diffValue = n;
    $('diff-value').textContent = `${n < 0 ? '-' : ''}${Math.abs(n)} Tag${Math.abs(n) === 1 ? '' : 'e'}`;
    if (n < 0) {
      $('diff-sub').textContent = 'Bis liegt vor Von';
    } else if (n >= 7) {
      const w = Math.floor(n / 7);
      const r = n % 7;
      $('diff-sub').textContent = `entspricht ${w} Woche${w === 1 ? '' : 'n'} und ${r} Tagen`;
    } else {
      $('diff-sub').textContent = '';
    }
  }

  $('diff-copy').addEventListener('click', async () => {
    if (diffValue != null) {
      const n = diffValue;
      await copyText(`${n} Tag${Math.abs(n) === 1 ? '' : 'e'}`);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Tab: Titrationsplaner                                               */
/* ------------------------------------------------------------------ */

const t = {
  start: null, // {y,m,d}
  meds: [], // { id, name, mode: 'dosis'|'tabletten', unit, strength }
  steps: [], // { id, distance: number|undefined (step 1 has none) }
  cells: {}, // stepId -> medId -> [4 texts]
  ramp: true, // last step is a goal reached by repeating the first increase
};

let stepDateFields = [];
let stepDistInputs = [];

function today() {
  return D.today();
}
function tomorrow() {
  return D.addDays(D.today(), 1);
}

function initTitration() {
  t.start = tomorrow();
  // Three rows by default: start, first step, goal (addMed fills their dose cells).
  t.steps.push({ id: nextId() }, { id: nextId(), distance: 7 }, { id: nextId(), distance: 7 });
  addMed({ name: '', mode: 'dosis', unit: '', strength: '' }, { silent: true });
  renderMeds();
  renderStartRow();
  renderTable();

  $('ramp-toggle').addEventListener('change', (e) => {
    if (e.target.checked) enableRamp();
    else {
      t.ramp = false;
      renderTable();
    }
    markDirty();
  });

  // Number and date fields: select the whole value on focus so typing replaces it.
  const AUTOSELECT = '.dose-input, .dist input, .count-input, .date-field input[type="text"]';
  let justFocused = null;
  document.addEventListener('focusin', (e) => {
    if (e.target.matches && e.target.matches(AUTOSELECT)) {
      e.target.select();
      justFocused = e.target;
    }
  });
  document.addEventListener('mouseup', (e) => {
    if (e.target === justFocused) {
      e.preventDefault(); // keep the selection made on focus
      justFocused = null;
    }
  });

  $('add-med').addEventListener('click', () => {
    if (t.meds.length < 4) {
      addMed({ name: '', mode: 'dosis', unit: '', strength: '' });
      renderMeds();
      renderTable();
    }
  });

  // Output
  const output = $('output');
  const doCopy = async () => {
    if (!output.textContent) return;
    const ok = await copyText(output.textContent);
    if (ok) {
      const label = $('copy-label');
      label.textContent = 'Kopiert';
      setTimeout(() => {
        label.textContent = 'Als Text kopieren';
      }, 1600);
    }
  };
  $('copy-output').addEventListener('click', doCopy);
  output.addEventListener('click', doCopy);

  // Leave warning: any edit in this panel (typing, segments, buttons all
  // route through markDirty; plain clicks like copying do not count).
  $('panel-titration').addEventListener('input', markDirty);

  // Toast / undo
  $('toast-undo').addEventListener('click', () => {
    if (undoSnapshot) restoreSnapshot(undoSnapshot);
    hideToast();
  });

  // Modal (remove medication)
  const overlay = $('modal-overlay');
  let pendingMed = null;
  let lastFocused = null;

  function close() {
    overlay.hidden = true;
    pendingMed = null;
    if (lastFocused) lastFocused.focus();
  }

  $('modal-cancel').addEventListener('click', close);
  $('modal-confirm').addEventListener('click', () => {
    if (pendingMed) {
      removeMed(pendingMed.id);
      renderMeds();
      renderTable();
      markDirty();
    }
    close();
  });
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
    if (e.key === 'Tab') {
      // Focus trap between the two buttons
      const f = [$('modal-cancel'), $('modal-confirm')];
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
    }
  });

  window.openRemoveModal = (med) => {
    pendingMed = med;
    lastFocused = document.activeElement;
    $('modal-text').textContent = `„${med.name.trim() || 'Ohne Name'}“ und alle eingetragenen Dosen werden aus dem Plan gelöscht.`;
    overlay.hidden = false;
    $('modal-confirm').focus();
  };
}

/* ---- Startdatum row ---- */

function renderStartRow() {
  const row = $('start-row');
  row.innerHTML = '';

  const seg = segmented(['Morgen', 'Heute'], 0, (i) => {
    const d = i === 0 ? tomorrow() : today();
    startField.set(d);
    markDirty();
  }, 'Morgen oder Heute');

  startField = createDateField({
    value: t.start,
    showWeekday: true,
    ariaLabel: 'Startdatum',
    onCommit: (d) => {
      t.start = d;
      refresh();
      markDirty();
    },
  });

  row.append(seg.root, startField.root);
  updateStartSeg();
}

let startField = null;

function updateStartSeg() {
  if (!startField) return;
  const seg = startField.root.parentElement.querySelector('.segmented');
  if (!seg) return;
  const cur = t.start;
  const tom = tomorrow();
  const tod = today();
  const idx =
    cur && D.diffDays(tom, cur) === 0 ? 0 : cur && D.diffDays(tod, cur) === 0 ? 1 : -1;
  [...seg.querySelectorAll('button')].forEach((b, i) =>
    b.setAttribute('aria-pressed', String(i === idx))
  );
}

/* ---- Medications ---- */

function addMed(init, { silent = false } = {}) {
  // divisible: smallest fraction of a tablet that can be taken (1, 0.5, 0.25)
  const med = { id: nextId(), name: init.name, mode: init.mode, unit: init.unit, strength: init.strength, divisible: 1 };
  t.meds.push(med);
  for (const step of t.steps) {
    (t.cells[step.id] ||= {})[med.id] = ['0', '0', '0', '0'];
  }
  if (!silent) refresh();
  return med;
}

function removeMed(medId) {
  t.meds = t.meds.filter((m) => m.id !== medId);
  for (const step of t.steps) {
    if (t.cells[step.id]) delete t.cells[step.id][medId];
  }
  refresh();
}

function renderMeds() {
  const box = $('meds');
  box.innerHTML = '';
  box.classList.toggle('multi', t.meds.length > 1);

  t.meds.forEach((med, i) => {
    const card = el('div', 'card med-card');
    const title = el('h3', 'med-title', t.meds.length > 1 ? `Medikament ${i + 1}` : 'Medikament');

    const remove = el('button', 'icon-btn remove-med');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Medikament ${i + 1} entfernen`);
    remove.innerHTML = TRASH_SVG;
    remove.disabled = t.meds.length <= 1;
    remove.addEventListener('click', () => window.openRemoveModal(med));

    const fields = el('div', 'med-fields');

    // Name (required)
    const nameField = el('div', 'field');
    const nameLabel = el('label', 'field-label', 'Name');
    const nameInput = el('input');
    nameInput.type = 'text';
    nameInput.value = med.name;
    nameInput.setAttribute('aria-label', `Name Medikament ${i + 1}`);
    const nameErr = el('p', 'error-text', 'Name fehlt');
    const nameBad = !med.name.trim();
    nameErr.hidden = !nameBad;
    nameInput.classList.toggle('invalid', nameBad);
    nameInput.addEventListener('input', () => {
      med.name = nameInput.value;
      const bad = !med.name.trim();
      nameInput.classList.toggle('invalid', bad);
      nameErr.hidden = !bad;
      updateGroupNames();
      refresh();
      markDirty();
    });
    nameField.append(nameLabel, nameInput, nameErr);

    // Eingabe segmented
    const modeField = el('div', 'field');
    const modeLabel = el('label', 'field-label', 'Eingabe');
    const modeSeg = segmented(['Dosis', 'Tabletten'], med.mode === 'tabletten' ? 1 : 0, (m) => {
      med.mode = m === 0 ? 'dosis' : 'tabletten';
      unitField.classList.toggle('hidden', med.mode !== 'dosis');
      strengthField.classList.toggle('hidden', med.mode !== 'tabletten');
      divField.classList.toggle('hidden', med.mode !== 'tabletten');
      refresh();
      markDirty();
    }, `Eingabe Medikament ${i + 1}`);
    modeField.append(modeLabel, modeSeg.root);

    // Einheit (Dosis mode)
    const unitField = el('div', 'field');
    if (med.mode !== 'dosis') unitField.classList.add('hidden');
    const unitLabel = el('label', 'field-label', 'Einheit');
    const unitInput = el('input');
    unitInput.type = 'text';
    unitInput.placeholder = 'mg';
    unitInput.value = med.unit;
    unitInput.setAttribute('aria-label', `Einheit Medikament ${i + 1}`);
    const unitHint = el('p', 'hint', 'Leer = mg');
    unitInput.addEventListener('input', () => {
      med.unit = unitInput.value;
      refresh();
      markDirty();
    });
    unitField.append(unitLabel, unitInput, unitHint);

    // Tablettenstärke (Tabletten mode)
    const strengthField = el('div', 'field');
    if (med.mode !== 'tabletten') strengthField.classList.add('hidden');
    const strengthLabel = el('label', 'field-label', 'Tablettenstärke');
    const strengthInput = el('input');
    strengthInput.type = 'text';
    strengthInput.placeholder = 'z. B. 15mg';
    strengthInput.value = med.strength;
    strengthInput.setAttribute('aria-label', `Tablettenstärke Medikament ${i + 1}`);
    const strengthHint = el('p', 'hint', 'Steht hinter dem Namen');
    strengthInput.addEventListener('input', () => {
      med.strength = strengthInput.value;
      refresh();
      markDirty();
    });
    strengthField.append(strengthLabel, strengthInput, strengthHint);

    // Teilbarkeit (Tabletten mode): doses are checked against it
    const divField = el('div', 'field');
    if (med.mode !== 'tabletten') divField.classList.add('hidden');
    const divGroup = el('div', 'radio-group');
    divGroup.setAttribute('role', 'radiogroup');
    divGroup.setAttribute('aria-label', `Teilbarkeit Medikament ${i + 1}`);
    [['Ganz', 1], ['Hälften', 0.5], ['Viertel', 0.25]].forEach(([text, val]) => {
      const lab = el('label', 'radio');
      const r = el('input');
      r.type = 'radio';
      r.name = `div-${med.id}`;
      r.checked = med.divisible === val;
      r.addEventListener('change', () => {
        med.divisible = val;
        refresh();
        markDirty();
      });
      lab.append(r, document.createTextNode(text));
      divGroup.append(lab);
    });
    const divLabel = el('span', 'field-label', 'Teilbar in');
    const divHint = el('p', 'hint', 'Dosen werden darauf geprüft');
    divField.append(divLabel, divGroup, divHint);

    fields.append(nameField, modeField, unitField, strengthField, divField);
    card.append(title, remove, fields);
    box.append(card);
  });

  $('add-med').disabled = t.meds.length >= 4;
  $('med-count').textContent = `${t.meds.length} von 4 Medikamenten`;
}

function updateGroupNames() {
  t.meds.forEach((med) => {
    const gn = document.querySelector(`.group-title[data-med="${med.id}"]`);
    if (gn) {
      gn.textContent = med.name.trim() || '?';
      gn.title = med.name;
    }
  });
}

/* ---- Steps table ---- */

function computeDates() {
  if (!t.start) return null;
  const dates = [t.start];
  for (let i = 1; i < t.steps.length; i++) {
    dates.push(D.addDays(dates[i - 1], distanceOf(i)));
  }
  return dates;
}

/** The last step is the computed goal while the ramp is on (needs 3+ steps). */
function rampControlled(i) {
  return t.ramp && t.steps.length >= 3 && i === t.steps.length - 1;
}

function parsedCells(step) {
  return t.meds.map((med) => {
    const arr = t.cells[step.id] ? t.cells[step.id][med.id] : undefined;
    return [0, 1, 2, 3].map((slot) => parseDose(arr ? arr[slot] : '0'));
  });
}

function distanceOf(i) {
  if (!rampControlled(i)) return t.steps[i].distance ?? 0;
  const n = t.steps.length;
  const interval = t.steps[n - 2].distance ?? 0;
  const count = planRamp(parsedCells(t.steps[n - 3]), parsedCells(t.steps[n - 2]), parsedCells(t.steps[n - 1]));
  return count * interval;
}

function renderTable() {
  const wrap = $('steps-table');
  wrap.innerHTML = '';
  stepDateFields = [];
  stepDistInputs = [];
  $('ramp-toggle').checked = t.ramp;

  // Header
  const head = el('div', 'step-row head');
  const headLeft = el('div', 'step-left');
  headLeft.append(el('div', 'cell nr', 'Nr.'), el('div', 'cell dist', 'Abstand (Tage)'), el('div', 'cell date', 'Datum'));
  const headDoses = el('div', 'dose-area');
  t.meds.forEach((med, mi) => {
    const group = el('div', 'dose-group head-group');
    const title = el('div', 'group-title', med.name.trim() || '?');
    title.dataset.med = med.id;
    group.append(title);
    const cells = el('div', 'group-cells');
    SLOTS.forEach((s) => cells.append(el('div', 'slot-label', s)));
    group.append(cells);
    headDoses.append(group);
    if (mi < t.meds.length - 1) headDoses.append(el('div', 'dose-spacer'));
  });
  head.append(headLeft, headDoses, el('div', 'cell del'));
  wrap.append(head);

  // Rows
  t.steps.forEach((step, i) => {
    const row = el('div', 'step-row');

    const left = el('div', 'step-left');
    const nrCell = el('div', 'cell nr', String(i + 1));
    if (t.ramp && t.steps.length >= 3 && (i === 0 || i === t.steps.length - 1)) {
      nrCell.append(el('span', 'nr-cap', i === 0 ? 'Start' : 'Ziel'));
    }
    left.append(nrCell);

    const distCell = el('div', 'cell dist');
    const dist = el('input');
    dist.type = 'text';
    dist.inputMode = 'numeric';
    dist.setAttribute('aria-label', `Abstand in Tagen, Schritt ${i + 1}`);
    if (i === 0) {
      dist.value = '–';
      dist.disabled = true;
      dist.readOnly = true;
      distCell.append(dist);
    } else if (rampControlled(i)) {
      dist.value = String(distanceOf(i));
      dist.disabled = true;
      dist.readOnly = true;
      dist.title = 'Wird aus der Erhöhung berechnet';
      stepDistInputs[i] = dist;
      distCell.append(dist);
    } else {
      dist.value = String(step.distance);
      const distErr = el('p', 'error-text');
      distErr.hidden = true;
      dist.addEventListener('input', () => {
        const v = dist.value.trim();
        if (v === '') {
          distErr.hidden = true;
          dist.classList.remove('invalid');
          return;
        }
        if (/^\d+$/.test(v)) {
          step.distance = +v;
          distErr.hidden = true;
          dist.classList.remove('invalid');
          refresh();
        } else {
          distErr.textContent = 'Abstand ungültig';
          distErr.hidden = false;
          dist.classList.add('invalid');
        }
        markDirty();
      });
      dist.addEventListener('blur', () => {
        if (dist.value.trim() === '' || !/^\d+$/.test(dist.value.trim())) {
          dist.value = String(step.distance);
          dist.classList.remove('invalid');
          distErr.hidden = true;
        }
      });
      distCell.append(dist, distErr);
    }
    left.append(distCell);

    const dateCell = el('div', 'cell date');
    const dates = computeDates();
    const field = createDateField({
      value: dates ? dates[i] : null,
      compact: true,
      showWeekday: true,
      disabled: i === 0 || rampControlled(i),
      ariaLabel: `Datum, Schritt ${i + 1}`,
      revertOnBlur: true,
      beforeDate: () => {
        const ds = computeDates();
        return ds && i > 0 ? ds[i - 1] : null;
      },
      onCommit: (d) => {
        if (i === 0) return;
        const ds = computeDates();
        step.distance = D.diffDays(ds[i - 1], d);
        refresh();
        markDirty();
      },
    });
    stepDateFields[i] = field;
    dateCell.append(field.root);
    left.append(dateCell);
    row.append(left);

    const doses = el('div', 'dose-area');
    t.meds.forEach((med, mi) => {
      const group = el('div', 'dose-group');
      const rowCells = t.cells[step.id] ? t.cells[step.id][med.id] : undefined;
      SLOTS.forEach((slot, si) => {
        const cell = el('div', 'dose-cell');
        const inp = el('input', 'dose-input');
        inp.type = 'text';
        inp.inputMode = 'decimal';
        inp.value = rowCells ? rowCells[si] : '0';
        inp.dataset.step = i;
        inp.dataset.med = med.id;
        inp.dataset.slot = si;
        inp.setAttribute('aria-label', `${med.name.trim() || 'Medikament'} ${slot.toLowerCase()}, Schritt ${i + 1}`);
        inp.addEventListener('input', () => {
          const row = t.cells[step.id] ||= {};
          const arr = row[med.id] ||= ['0', '0', '0', '0'];
          arr[si] = inp.value;
          const v = inp.value.trim();
          const pending = /^(\d+)?[.,]$/.test(v); // typing in progress, e.g. "0,"
          inp.classList.toggle('invalid', v !== '' && !pending && parseDose(v) == null);
          refresh();
          markDirty();
        });
        inp.addEventListener('blur', () => {
          const norm = normalizeDoseText(inp.value);
          if (norm == null) {
            inp.classList.add('invalid');
          } else {
            inp.value = norm;
            inp.classList.remove('invalid');
            const row = t.cells[step.id] ||= {};
            const arr = row[med.id] ||= ['0', '0', '0', '0'];
            arr[si] = norm;
            refresh();
          }
          markDirty();
        });
        cell.append(inp);
        group.append(cell);
      });
      doses.append(group);
      if (mi < t.meds.length - 1) doses.append(el('div', 'dose-spacer'));
    });
    row.append(doses);

    const delCell = el('div', 'cell del');
    const del = el('button', 'icon-btn small');
    del.type = 'button';
    del.setAttribute('aria-label', `Schritt ${i + 1} löschen`);
    del.innerHTML = TRASH_SVG;
    del.disabled = t.steps.length <= 1;
    del.addEventListener('click', () => deleteStep(i));
    if (!t.ramp) delCell.append(del);
    row.append(delCell);

    wrap.append(row);

    // Plus row after every step (inserts below the step above it). With the
    // ramp on, the plan is fixed to Start / erste Erhöhung / Ziel.
    if (t.ramp) return;
    const plusRow = el('div', 'plus-row');
    const sticky = el('div', 'plus-sticky');
    const plus = el('button', 'plus-btn');
    plus.type = 'button';
    plus.setAttribute('aria-label', `Schritt nach Schritt ${i + 1} einfügen`);
    plus.innerHTML =
      '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z"/></svg>';
    plus.addEventListener('click', () => insertStep(i));
    sticky.append(plus);
    plusRow.append(sticky);
    wrap.append(plusRow);
  });

  refresh();
}

function insertStep(afterIdx) {
  const src = t.steps[afterIdx];
  const step = { id: nextId(), distance: 7 };
  const cells = {};
  for (const med of t.meds) {
    cells[med.id] = src && t.cells[src.id] && t.cells[src.id][med.id]
      ? [...t.cells[src.id][med.id]]
      : ['0', '0', '0', '0'];
  }
  t.cells[step.id] = cells;
  t.steps.splice(afterIdx + 1, 0, step);
  renderTable();
  markDirty();
}

/** The ramp needs exactly three steps: Start, erste Erhöhung, Ziel. */
function enableRamp() {
  const snap = takeSnapshot();
  const removed = Math.max(0, t.steps.length - 3);
  t.ramp = true;
  if (removed) {
    // keep Start, erste Erhöhung and the last step (Ziel)
    const drop = t.steps.splice(2, t.steps.length - 3);
    for (const s of drop) delete t.cells[s.id];
  }
  while (t.steps.length < 3) insertStep(t.steps.length - 1);
  renderTable();
  if (removed) showDeleteToast(snap, `${removed} Schritt${removed === 1 ? '' : 'e'} entfernt`);
}

function deleteStep(idx) {
  const snap = takeSnapshot();
  const step = t.steps[idx];
  t.steps.splice(idx, 1);
  delete t.cells[step.id];
  renderTable();
  markDirty();
  showDeleteToast(snap);
}

/* ---- Toast + undo (full snapshot) ---- */

let undoSnapshot = null;
let toastTimer = null;

function takeSnapshot() {
  return structuredClone({
    start: t.start,
    meds: t.meds,
    steps: t.steps,
    cells: t.cells,
    ramp: t.ramp,
  });
}

function restoreSnapshot(snap) {
  t.start = snap.start;
  t.meds = snap.meds;
  t.steps = snap.steps;
  t.cells = snap.cells;
  t.ramp = snap.ramp;
  // Re-sync start field and rebuild
  if (startField) startField.set(t.start, { silent: true });
  renderMeds();
  renderTable();
}

function showDeleteToast(snap, text = 'Schritt gelöscht') {
  undoSnapshot = snap;
  const toast = $('toast');
  toast.hidden = false;
  $('toast-text').textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 6000);
}

function hideToast() {
  $('toast').hidden = true;
  undoSnapshot = null;
  clearTimeout(toastTimer);
}

/* ---- Refresh: dates, output, warnings ---- */

function refresh() {
  const dates = computeDates();

  if (dates) {
    t.steps.forEach((s, i) => {
      const f = stepDateFields[i];
      if (f && document.activeElement !== f.input) f.set(dates[i], { silent: true });
      if (stepDistInputs[i]) stepDistInputs[i].value = String(distanceOf(i));
    });
  }

  const medViews = t.meds.map((m) => ({ name: m.name, mode: m.mode, unit: m.unit, strength: m.strength, divisible: m.divisible }));

  if (dates) {
    const rows = t.steps.map((s, i) => ({
      date: dates[i],
      cells: t.meds.map((med) => {
        const arr = t.cells[s.id] ? t.cells[s.id][med.id] : undefined;
        return [0, 1, 2, 3].map((slot) => parseDose(arr ? arr[slot] : '0'));
      }),
    }));

    const outRows = t.ramp && rows.length >= 3 ? expandRamp(rows) : rows;
    $('output').textContent = buildOutput(medViews, outRows);

    // Invalid = non-numeric dose cells plus missing medication names
    // (both print ? in the output).
    const invalid =
      countInvalid(medViews, rows) + medViews.filter((m) => !(m.name || '').trim()).length;
    const warn = $('output-warning');
    warn.textContent = invalid ? `${invalid} Feld${invalid === 1 ? '' : 'er'} ungültig` : '';
    warn.hidden = invalid === 0;

    const jumps = findJumps(medViews, rows);
    const indiv = findIndivisible(medViews, rows);
    const jump = $('jump-hints');
    if (jumps.length || indiv.length) {
      const nameOf = (j) => t.meds[j.med].name.trim() || '?';
      jump.textContent = [
        ...jumps.map(
          (j) => `Prüfen: Schritt ${j.step}, ${nameOf(j)} ${SLOTS[j.slot]} – Sprung ≥ 10× zum vorigen Schritt`
        ),
        ...indiv.map(
          (j) => `Prüfen: Schritt ${j.step}, ${nameOf(j)} ${SLOTS[j.slot]} – Dosis passt nicht zur Teilbarkeit`
        ),
      ].join('  ·  ');
      jump.hidden = false;
    } else {
      jump.hidden = true;
    }
  } else {
    $('output').textContent = '';
    $('output-warning').hidden = true;
    $('jump-hints').hidden = true;
  }

  updateStartSeg();
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

function initTabs() {
  const tabs = [
    { id: 'tab-titration', panel: 'panel-titration' },
    { id: 'tab-dates', panel: 'panel-dates' },
  ];
  for (const t of tabs) {
    $(t.id).addEventListener('click', () => {
      for (const x of tabs) {
        $(x.id).setAttribute('aria-selected', String(x.id === t.id));
        $(x.panel).classList.toggle('hidden', x.id !== t.id);
      }
    });
  }
}

/* ------------------------------------------------------------------ */

initTabs();
initDateCalc();
initTitration();
