// Runtime smoke test: loads index.html in jsdom and drives the real app.
// jsdom lacks showPicker; a stub makes the app take the text-input path.
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

test('app smoke test', async () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/' });

  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
  globalThis.structuredClone = structuredClone;
  for (const k of ['HTMLInputElement', 'HTMLElement', 'Event', 'KeyboardEvent', 'Node']) {
    globalThis[k] = window[k];
  }
  // jsdom lacks showPicker; stub it so the app takes the text-input path
  window.HTMLInputElement.prototype.showPicker = function () {};

  await import('../js/app.js');

  const $ = (sel) =>
    /[#.\s\[]/.test(sel) ? document.querySelector(sel) : document.getElementById(sel);
  const assert = (cond, msg) => {
    if (!cond) {
      console.error('FAIL:', msg);
      throw new Error(msg);
    } else {
      console.log('ok:', msg);
    }
  };

  // --- Initial state ---
  assert(document.querySelectorAll('.step-row:not(.head)').length === 1, 'starts with one step row');
  assert(document.querySelectorAll('#meds .med-card').length === 1, 'starts with one medication card');
  assert($('med-count').textContent === '1 von 4 Medikamenten', 'med counter 1 von 4');
  const startInput = $('#start-row .date-field input');
  assert(/^\d{2}\.\d{2}\.\d{4}$/.test(startInput.value), `start default is tomorrow (${startInput.value})`);
  assert($('tab-titration').getAttribute('aria-selected') === 'true', 'titration tab active');
  assert($('add-med').disabled === false, 'add med enabled');

  // --- Output for pristine state ---
  const out1 = $('output').textContent;
  assert(out1.startsWith('ab ' + startInput.value + ':\n'), 'output header uses Startdatum');
  assert(/^-?\? 0-0-0-0$/.test(out1.split('\n')[1]), 'unnamed medication prints ? line');
  assert($('output-warning').hidden === false, 'empty name counted as invalid field');

  // --- Set a medication name, dose, second med + steps ---
  const nameInput = document.querySelector('#meds input[type="text"][aria-label^="Name"]');
  nameInput.value = 'Sertralin';
  nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert($('output-warning').hidden === true, 'name set -> no invalid fields');

  const dose = document.querySelector('.dose-input[data-slot="0"]');
  dose.value = '50';
  dose.dispatchEvent(new window.Event('input', { bubbles: true }));
  let lines = $('output').textContent.split('\n');
  assert(lines[1] === 'Sertralin 50mg-0-0-0', `dose line: ${lines[1]}`);

  // decimal with period normalizes to comma on blur
  dose.value = '0.5';
  dose.dispatchEvent(new window.Event('input', { bubbles: true }));
  dose.dispatchEvent(new window.Event('blur'));
  assert(dose.value === '0,5', `normalized to comma (${dose.value})`);

  // add second step
  document.querySelector('.plus-btn').click();
  assert(document.querySelectorAll('.step-row:not(.head)').length === 2, 'second step inserted');
  const dist2 = document.querySelector('.cell.dist input:not(:disabled)');
  assert(dist2.value === '7', 'new step Abstand 7');
  const doseRow2 = document.querySelectorAll('.dose-input[data-slot="0"]')[1];
  assert(doseRow2.value === '0,5', 'new step copies doses from row above');

  // change Abstand of step 2
  dist2.value = '14';
  dist2.dispatchEvent(new window.Event('input', { bubbles: true }));
  const dateField2 = document.querySelectorAll('.step-row:not(.head) .date-field-row input')[1];
  const d1 = startInput.value;
  assert($('output').textContent.includes(`ab ${dateField2.value}:`), `step2 date ${dateField2.value} in output`);

  // invalid distance reverts on blur
  dist2.value = 'abc';
  dist2.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert(!dist2.nextElementSibling.hidden, 'Abstand ungültig shown');
  dist2.dispatchEvent(new window.Event('blur'));
  assert(dist2.value === '14', `blur reverts to last valid (${dist2.value})`);

  // step 1 date locked
  const dist1 = document.querySelector('.cell.dist input');
  assert(dist1.disabled && dist1.value === '–', 'step 1 Abstand locked with –');
  assert(document.querySelectorAll('.step-row:not(.head) .date-field-row input')[0].disabled, 'step 1 date disabled');

  // delete step 2 -> toast, undo restores
  document.querySelector('.step-row .cell.del .icon-btn').click();
  assert(document.querySelectorAll('.step-row:not(.head)').length === 1, 'step deleted');
  assert($('toast').hidden === false, 'toast shown');
  $('toast-undo').click();
  assert(document.querySelectorAll('.step-row:not(.head)').length === 2, 'undo restores step');
  assert($('toast').hidden === true, 'toast hidden after undo');

  // --- Medications: add, remove via modal ---
  $('add-med').click();
  assert(document.querySelectorAll('#meds .med-card').length === 2, 'second med added');
  assert(document.querySelector('#meds .med-title').textContent === 'Medikament 1', 'renamed to Medikament 1/2');
  // set strength, switch to Tabletten
  const med2 = document.querySelectorAll('#meds .med-card')[1];
  const seg2 = med2.querySelector('.segmented');
  seg2.querySelectorAll('button')[1].click();
  const strength = med2.querySelector('input[aria-label*="Tablettenstärke"]');
  strength.value = '15mg';
  strength.dispatchEvent(new window.Event('input', { bubbles: true }));
  const out2 = $('output').textContent.split('\n');
  assert(out2[2] === '? 15mg 0-0-0-0', `tabletten line without name: ${out2[2]}`);
  const name2 = med2.querySelector('input[aria-label^="Name"]');
  name2.value = 'Mirtazapin';
  name2.dispatchEvent(new window.Event('input', { bubbles: true }));
  const med2Id = [...document.querySelectorAll('.group-title')][1].dataset.med;
  const doseM2 = document.querySelector(`.dose-input[data-med="${med2Id}"][data-slot="3"]`);
  doseM2.value = '0,5';
  doseM2.dispatchEvent(new window.Event('input', { bubbles: true }));
  const out3 = $('output').textContent.split('\n');
  assert(out3[2] === 'Mirtazapin 15mg 0-0-0-0,5', `tabletten output: ${out3[2]}`);

  // remove med 1 via modal
  document.querySelectorAll('#meds .remove-med')[0].click();
  assert($('modal-overlay').hidden === false, 'modal opens');
  assert($('modal-text').textContent.includes('Sertralin'), 'modal names the medication');
  $('modal-confirm').click();
  assert($('modal-overlay').hidden === true, 'modal closes');
  assert(document.querySelectorAll('#meds .med-card').length === 1, 'med removed');
  assert($('output').textContent.startsWith('ab '), 'output still renders');

  // --- Date calculator ---
  $('tab-dates').click();
  assert($('panel-dates').classList.contains('hidden') === false, 'dates panel visible');
  const calcStart = document.querySelector('#calc-form .date-field-row input');
  calcStart.value = '01.12.2026';
  calcStart.dispatchEvent(new window.Event('change', { bubbles: true }));
  calcStart.dispatchEvent(new window.Event('blur'));
  const count = document.querySelector('#calc-form .count-input');
  count.value = '75';
  count.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert($('calc-date').textContent === '14.02.2027', `calc result ${$('calc-date').textContent}`);
  assert($('calc-weekday').textContent === 'Sonntag', 'calc weekday Sonntag');

  // Wochen = calendar week
  document.querySelector('#calc-form select').value = 'Wochen';
  count.value = '1';
  count.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert($('calc-date').textContent === '07.12.2026', `calendar week ${$('calc-date').textContent}`);

  // Monate clamps
  document.querySelector('#calc-form select').value = 'Monate';
  count.value = '1';
  calcStart.value = '31.01.2027';
  calcStart.dispatchEvent(new window.Event('blur'));
  count.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert($('calc-date').textContent === '28.02.2027', `clamped month ${$('calc-date').textContent}`);

  // negative count invalid
  count.value = '-3';
  count.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert(count.classList.contains('invalid'), 'negative Anzahl invalid');
  assert($('calc-date').textContent === '–', 'no result for invalid count');

  // Differenz
  const von = document.querySelectorAll('#diff-form .date-field-row input')[0];
  const bis = document.querySelectorAll('#diff-form .date-field-row input')[0] === document.querySelectorAll('#diff-form .date-field-row input')[1] ? null : document.querySelectorAll('#diff-form .date-field-row input')[1];
  von.value = '01.12.2026';
  von.dispatchEvent(new window.Event('blur'));
  bis.value = '14.02.2027';
  bis.dispatchEvent(new window.Event('blur'));
  assert($('diff-value').textContent === '75 Tage', `diff ${$('diff-value').textContent}`);
  assert($('diff-sub').textContent === 'entspricht 10 Wochen und 5 Tagen', `diff sub ${$('diff-sub').textContent}`);
  // swap -> negative
  const tmp = von.value;
  von.value = bis.value;
  von.dispatchEvent(new window.Event('blur'));
  bis.value = tmp;
  bis.dispatchEvent(new window.Event('blur'));
  assert($('diff-value').textContent === '-75 Tage', `negative diff ${$('diff-value').textContent}`);
  assert($('diff-sub').textContent === 'Bis liegt vor Von', 'Bis liegt vor Von');

});
