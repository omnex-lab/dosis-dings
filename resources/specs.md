# Dosis-Dings: Build Spec

A small static web app with office calculators for a medical practice. Two tools in two tabs: a **Titrationsplaner** (dose schedule builder, default tab) and a **Datumsrechner** (date calculator). Pure date and number scheduling. The app has no drug knowledge and does no clinical validation.

Items marked **[Assumption]** were not explicitly decided by the owner. Implement them as written, but keep them easy to change.

---

## 1. Hard constraints

- **Static site for GitHub Pages.** No backend, no build step required. Plain HTML, CSS and vanilla JavaScript (ES modules are fine).
- **No persistence.** No localStorage, sessionStorage, IndexedDB or cookies. Every page load is a clean slate.
- **No network requests at runtime.** No analytics, no CDN scripts, no Google Fonts. The site is public and used in a medical context, so third-party requests are a privacy problem (GDPR). **Self-host the font files** (Inter, woff2) or fall back to the system font stack `system-ui, sans-serif`. The visual mockup loads Inter from Google Fonts; do not copy that.
- **No patient data.** The app never asks for names or identifiers. Medication names are free text typed by the user and never leave the browser.
- **UI language: German only.** Dates are `TT.MM.JJJJ` (e.g. `02.12.2026`). Decimal separator is the comma.
- **Calendar days only.** No skipping of weekends or public holidays anywhere.
- **Date math must be timezone- and DST-safe.** Use UTC-based date arithmetic (`Date.UTC`, `getUTC*`) or a plain `{y, m, d}` model. Never add `24 * 60 * 60 * 1000` to a local-time Date.
- Target: desktop browser (the owner works on a PC). Should still degrade gracefully at narrow widths (cards wrap, wide tables scroll).

## 2. Visual design

The mockup (Claude canvas artifact, "Dosis-Dings Mockup", two artboards: Titrationsplaner and Datumsrechner) is the visual reference. If you cannot open it, use these tokens. Style: clean, minimal, muted blue.

| Token | Value | Use |
|---|---|---|
| Page background | `#EEF3F8` | muted blue page and output box |
| Surface | `#FFFFFF` | header, cards, table |
| Card border | `#D5DEE8` | 1px, radius 12px, padding 24px |
| Accent | `#2574C0` | primary buttons, active tab, selected segment, logo (white text on it passes 4.5:1) |
| Accent tint | `#E5F1FB` | result boxes in the Datumsrechner |
| Accent dark | `#0F3F6B` | text on tint, group labels |
| Text | `#1B1F23` | body |
| Text muted | `#4A545E` | hints, secondary labels |
| Label | `#3D4650` | field labels, 13px, weight 600 |
| Control border | `#858E99` | inputs and buttons (3:1 non-text contrast) |
| Disabled | bg `#EEF0F2`, border `#C9CED4`, text `#5B6470` | |
| Error / danger | `#B3261E` | error text, error borders, destructive button |
| Divider (plus rows) | `#C3CFDC` | |

- Font: Inter (self-hosted), weights 400, 500, 600, 700. Body 16px in inputs, 15px buttons, 13px labels and hints.
- Controls: height 44px, radius 8px. Icon buttons 44x44. Use real `<button>`, `<input>` + `<label>`, and `aria-label` on icon-only buttons. Visible focus states on everything.
- Page content max width 1180px, 32px side padding. Cards stack with 24px gap.
- Header: logo text "Dosis-Dings" (26px, bold, accent) with tagline **"Dreimal täglich weniger Kopfrechnen"** (15px, muted) beside it, then the tab bar. Active tab: accent text with a 3px accent bottom border.
- Footer line (13px, muted): "Alles läuft lokal im Browser. Es werden keine Daten gespeichert oder übertragen."
- Tab order: **Titrationsplaner (default), Datumsrechner.**

## 3. Tab: Datumsrechner

Two cards side by side (wrap on narrow screens).

### 3.1 Card "Datum plus / minus Zeitraum"
- Subtext: "Es zählen Kalendertage, Wochenenden und Feiertage werden nicht übersprungen."
- **Startdatum** (see 3.3 for the date field).
- **Rechenart**: segmented control `+ Addieren` (default) / `− Subtrahieren`.
- **Anzahl**: integer input, right-aligned, width ~96px, default empty or 0.
- **Einheit**: select with `Tage`, `Wochen`, `Monate`, `Jahre`.
- `Wochen` counts **calendar weeks** (Monday is the first day of the week): the result is the Monday `n` ISO weeks after the start date's week. Start date on a Monday: the Monday 7 days later. Example: `02.12.2026` (Mi) + 1 Woche = `07.12.2026` (Mo).
- **Anzahl**: negative values are invalid (red border, no result). `0` yields the start date itself.
- **Result box** (tint background): small label "Ergebnis", large date `TT.MM.JJJJ`, weekday name below (e.g. "Sonntag"), and a **Kopieren** button (copies just the date, e.g. `14.02.2027`).
- Result updates live while typing. Empty or invalid input: show no result (not an error toast).
- Month/year arithmetic **clamps to the last day of the month** (31.01.2027 + 1 Monat = 28.02.2027; 29.02.2028 + 1 Jahr = 28.02.2029). **[Assumption]**

### 3.2 Card "Differenz zwischen zwei Daten"
- Subtext: "Anzahl der Kalendertage von Datum A bis Datum B."
- Two date fields: **Von** and **Bis**.
- **Result box**: label "Differenz", large `75 Tage`, small line "entspricht 10 Wochen und 5 Tagen". **Kopieren** copies `75 Tage`.
- Singular/plural: "1 Tag", "2 Tage", "1 Woche", "2 Wochen". Omit the weeks line when under 7 days. The "entspricht … Wochen und … Tagen" line is a plain 7-day conversion of the difference, **not** calendar weeks.
- If Bis is before Von, show a negative value (`-75 Tage`) and the line "Bis liegt vor Von".
- The difference is Bis minus Von in calendar days (not inclusive of both ends).

### 3.3 Date field component (used everywhere)
Text input accepting `TT.MM.JJJJ` **and** a calendar button that opens the native date picker (`<input type="date">`, visually hidden, triggered via `showPicker()`). Both stay in sync. Accept `D.M.YYYY` without leading zeros and normalize to `DD.MM.YYYY` on blur. Invalid input (e.g. `31.02.2026`) shows a red border and no result. Where noted, a **Heute** button fills in today's date.

Browser support: target is desktop Chrome, Firefox and Safari. If `HTMLInputElement.prototype.showPicker` exists, use the text input + hidden date input as described. If not (Firefox, older Safari), the visible field itself is a native `<input type="date">` (browser locale format) and the separate calendar button is hidden; all other behavior is unchanged.

## 4. Tab: Titrationsplaner

Purpose: build a dose schedule step by step for up to four medications and copy it as text into the practice software. By default the plan is a **ramp to a goal**: the user enters a start dose, the first increase and the goal dose, and the app fills in the steps in between (see 4.3a). The ramp can be switched off to enter every step by hand.

Layout, top to bottom: Startdatum card, medication cards (+ add button), Schritte card (table), Ausgabe card.

### 4.1 Startdatum
- Label "Startdatum". Controls in one row: segmented buttons **Morgen** and **Heute**, then a date field (150px) with calendar button, then the weekday abbreviation (Mo, Di, ...).
- Default value on load: **tomorrow**. The Morgen/Heute segment is highlighted only while the field value equals tomorrow/today; typing another date clears the highlight (custom date).
- Hint: "Schritt 1 startet an diesem Datum. Eigenes Datum einfach eintippen oder im Kalender wählen."
- Step 1's date always equals the Startdatum — including after step 1 was deleted (the new step 1 takes over the current Startdatum). Editing the Startdatum always shifts the whole chain.

### 4.2 Medications (1 to 4)
- Page starts with **one** medication card. Title is just "Medikament" while only one exists; with two or more they are titled "Medikament 1" to "Medikament 4".
- **Layout:** a single card spans the full width. From two medications on, the cards sit **two per row** (1 and 2, then 3 and 4 on the next row). Below 900px wide they stack.
- Button **Medikament hinzufügen** (plus icon) below the cards, with a counter "N von 4 Medikamenten". Disabled at 4.
- Every card has its own **Entfernen** button (trash icon). It is disabled when only one medication remains. Clicking it opens a **confirmation dialog**: title "Medikament entfernen?", text `„<Name>“ und alle eingetragenen Dosen werden aus dem Plan gelöscht.`, buttons **Abbrechen** and **Entfernen** (danger style). Modal, focus trapped, Esc cancels.
- Card fields:
  - **Name**: free text, **required**. Appears in the output and as group heading above its four columns. Empty name: inline error "Name fehlt", red border, and the output line prints `?` instead of the name.
  - **Eingabe**: segmented control `Dosis` / `Tabletten`.
  - Mode `Dosis`: field **Einheit** (free text, placeholder and default `mg`; an empty field means `mg`). Hint "Leer = mg".
  - Mode `Tabletten`: field **Tablettenstärke** (free text, e.g. `15mg`, placeholder "z. B. 15mg"). Hint "Steht hinter dem Namen". No unit is appended to the numbers.
  - Mode `Tabletten`: radio group **Teilbar in** with `Ganz` (default), `Hälften`, `Viertel` and the hint "Dosen werden darauf geprüft". It is the smallest part of a tablet that can be taken (1, 0,5, 0,25). It only drives a hint (see "Teilbarkeit" under Dose cells); it never changes a value.
  - Switching mode keeps already entered dose values. **[Assumption]**

### 4.3 Steps table ("Schritte")
Heading "Schritte", subtext: "Schritt 1 startet am Startdatum. Der Abstand zählt in Tagen ab dem vorigen Schritt. Datum und Abstand hängen zusammen: Änderst du das Datum, passt sich der Abstand an, und umgekehrt."

**Columns**
1. **Nr.** (centered, renumbers automatically)
2. **Abstand (Tage)** (100px input, centered)
3. **Datum** (date field, 104px text input plus weekday abbreviation)
4. Per medication, four dose cells (56px wide, centered): **Morgens, Mittags, Abends, Nachts**, preceded by a group heading with the medication name (underlined with a 2px accent line) and separated from the next group by a 16px spacer.
5. **Löschen** (delete button per row)

**Sticky columns:** Nr., Abstand and Datum stay pinned at the left while the table scrolls horizontally (with four medications it is ~1,400px wide). Pinned area needs an opaque white background. Row structure suggestion: each row is a flex container with a sticky left block (fixed width 292px) and a grid for the dose cells. (CSS `position: sticky` does not work horizontally across grid columns, so do not put the pinned cells in the same grid.)

**Rows**
- The real app starts with **three rows** (Start, erste Erhöhung, Ziel; see 4.3a), all doses `0`, Abstand `7` for steps 2 and 3. **[Assumption]**
- **Add and delete rows are manual-mode features.** While the ramp is on (default) there are no plus buttons and no delete buttons: the plan is exactly three steps. Everything in this "Rows" list applies with the ramp switched off.
- A **plus button (circle, 32px)** sits between rows and below the last row, centered under the Nr. column, with a thin line running across the full width behind it. Clicking it inserts a new row **below** the row above it. **[Assumption]** The new row copies the doses of the row above it and has Abstand `7`.
- **Delete** (trash icon at the end of each row) removes the row immediately, no confirmation. A toast appears bottom-center for 6 seconds: "Schritt gelöscht" with a **Rückgängig** button that restores a **full state snapshot** (steps, doses, Startdatum). A new deletion replaces a pending toast; only the latest deletion is undoable. The delete button is disabled when only one row remains.
- Inserting or deleting a row **shifts all later dates** (dates are derived from the Abstand chain). This is intended.
- **Deleting step 1:** the next row becomes step 1, its date becomes the Startdatum (Abstand locked, all later dates recompute).

**Date and Abstand behavior**
- Date of a row = date of the previous row + Abstand days. The date of **step 1 = Startdatum**.
- **Step 1 is locked:** its Abstand input is disabled and shows `–`; its date input is disabled (change it via the Startdatum).
- Editing a row's **Abstand** recalculates its date, and all later dates shift accordingly.
- Editing a row's **Datum** recalculates its Abstand (date minus previous row's date); later dates shift.
- **Validation (inline, small red text under the field, red border):**
  - date earlier than the previous step: "Vor dem vorigen Schritt" (do not apply the change; the field keeps the typed value with a red border while focused and reverts to the last valid date on blur, so the Abstand is unchanged)
  - Abstand not a non-negative integer: "Abstand ungültig"
  - Abstand `0` is allowed (two steps on the same day).
- While the user types a partial date, do not rewrite the field; only normalize on blur.

**Dose cells**
- Accept non-negative decimals with **comma or period** (`0.5` and `0,5` both valid). Store the number; **display and output always use the comma**.
- Normalize on blur: strip trailing zeros (`0,50` becomes `0,5`, `25,0` becomes `25`), empty becomes `0`.
- Anything non-numeric: red border, and the output shows a placeholder `?` for that cell until fixed. Kopieren stays enabled; the output card shows an inline warning with the count of invalid fields (e.g. "2 Felder ungültig"). Invalid = non-numeric dose cells plus missing medication names (everything that prints `?` in the output).
- **Magnitude guard:** if a dose is ≥ 10× (or ≤ 1/10×) the previous step's dose for the same medication and time slot (both non-zero), a non-blocking hint appears below the steps table: "Prüfen: Schritt N, <Name> <Slot> – Sprung ≥ 10× zum vorigen Schritt." The value is still printed.
- **Teilbarkeit:** in Tabletten mode, a non-zero dose that is not a multiple of the chosen part size (e.g. `0,5` with `Ganz`) adds a non-blocking hint to the same list as the magnitude guard: "Prüfen: Schritt N, <Name> <Slot> – Dosis passt nicht zur Teilbarkeit". The value is still printed.
- Quarter and half tablets are simply `0,25` / `0,5`.
- **Select on focus:** focusing a dose cell, an Abstand field or a date text field (including Startdatum) selects its whole content, so typing replaces the value. Nothing is deleted if the user leaves without typing. Free-text fields (Name, Einheit, Tablettenstärke) are not affected.

### 4.3a Ramp to goal ("Bis zum Ziel automatisch weiter erhöhen")
A checkbox above the steps table, **on by default**. With it on, the table has exactly three rows:
- **Step 1 = Start** (caption "Start" under the number): start dose, date = Startdatum.
- **Step 2 = erste Erhöhung**: the dose after the first increase. Its Abstand is the **interval** in days.
- **Last step = Ziel** (caption "Ziel"): the goal dose. Its Abstand and date are **calculated and locked** (grey, tooltip "Wird aus der Erhöhung berechnet"); the user never types days for it.

Generated steps, per medication and per time slot: the increase (step 2 minus step 1) is repeated every `interval` days until the goal is reached. Example: Escitalopram `5`, after 7 days `10`, goal `20` gives 5, 10, 15, 20, each one week apart.
- Steps needed per slot = ceil((goal − step 2) / increase). The table's goal date is `interval × (largest count over all slots)` days after step 2 (at least one interval).
- If the goal is not an exact multiple, the last step is smaller (`5, 10, 15, 20, 22` for goal `22`). A slot that reaches its goal earlier stays there.
- A slot whose increase is `0`, or points away from its goal, holds its step 2 value and takes the goal value in the final step. The ramp also works downward (`100, 75` → goal `25`).
- If the interval is `0` or any involved cell is invalid, nothing is generated and the three rows are output as entered.
- At most 400 generated steps.
- The output (4.4) shows the **generated steps**: each step is one block. The magnitude guard and Teilbarkeit hints look at the **table rows** (the three entered steps), not the generated ones.

Switching the checkbox:
- **Off:** the table becomes a normal manual table (plus and delete buttons return, the Ziel row becomes an ordinary editable row). Nothing is generated.
- **On:** the plan is made exactly three steps. With fewer than three rows, rows are added (copy of the last row, Abstand 7). With more, the **first two and the last** row are kept and the others removed, with the toast "N Schritte entfernt" and **Rückgängig** (full snapshot, same as deleting a row).
- The checkbox state is part of the undo snapshot.

### 4.4 Output ("Ausgabe zum Einfügen")
Card with heading and a primary **Als Text kopieren** button (copy icon). The output sits in a light box. The output box is the **source of truth**: it shows exactly the text that will be copied, including the effective unit (empty Einheit ⇒ `mg`). (`#EEF3F8`, monospace 15px, whitespace preserved). **Clicking anywhere in the output box also copies.** Keep the button too (some people prefer it; it is also the keyboard-accessible path). After copying the button label changes to **Kopiert** for ~1.6 seconds. Use `navigator.clipboard.writeText` with a fallback (hidden textarea + `execCommand('copy')`) for contexts where the Clipboard API is blocked. Tooltip on the box: "Klicken zum Kopieren".

The output contains the generated ramp steps (4.3a), or the table rows as entered when the ramp is off. There is **no separate day-by-day list**.

**Format: one block per step date, one line per medication, blank line between blocks.** Consecutive steps on the same date (Abstand 0) merge into a single block (no duplicated `ab …:` header).

```
ab 02.12.2026:
Sertralin 50mg-0-0-0
Mirtazapin 15mg 0-0-0-0,5

ab 09.12.2026:
Sertralin 25mg-0-0-0
Mirtazapin 15mg 0-0-0-1
```

Rules:
- Header line: `ab <TT.MM.JJJJ>:`
- Dash notation order: Morgens-Mittags-Abends-Nachts (4 values, always).
- **Mode `Dosis`:** `<Name> <v1>-<v2>-<v3>-<v4>`; the unit is appended **directly after every non-zero number with no space** (`50mg`, `25mg-0-25mg-0`). Zero is printed bare (`0`). Unit = the Einheit field, or `mg` when empty.
- **Mode `Tabletten`:** `<Name> <Tablettenstärke> <v1>-<v2>-<v3>-<v4>` with bare numbers and no units (`Mirtazapin 15mg 0-0-0-0,5`). If Tablettenstärke is empty: `<Name> <dashes>`.
- **No space before the unit, ever.**
- Decimal comma everywhere. No trailing newline.
- A medication with all-zero doses on a date is still printed (`Sertralin 0-0-0-0`). **[Assumption]**; may later become "abgesetzt".
- Only existing medications and rows are included. Output updates live.

### 4.5 Leave warning
Once the user has edited anything, register a `beforeunload` handler so an accidental reload or tab close shows the browser's "leave page?" prompt. Not active on a pristine page.

## 5. Accessibility
- Every input has a label (visible or `aria-label` including row number and medication, e.g. "Sertralin morgens, Schritt 2").
- Dialog uses `role="dialog"`, `aria-modal`, `aria-labelledby`. Toast uses `role="status"`.
- Text contrast 4.5:1 minimum; do not signal errors by color alone (the error message text is always present).
- Everything usable by keyboard (tab order follows visual order; segmented controls are real buttons).

## 6. Suggested structure

```
/index.html        single page, two tab panels
/css/app.css       tokens as CSS custom properties
/js/dates.js       pure functions: parse, format, addDays, addWeeks (calendar weeks), addMonths, addYears, diffDays, weekday
/js/format.js      dose + output formatting, invalid count, 10x jump guard, Teilbarkeit check, ramp planning and expansion (pure)
/js/app.js         state, rendering, event handling
/fonts/inter.woff2 self-hosted Inter (variable, weights 400-700, latin)
/tests/            node:test: unit tests for dates.js and format.js (incl. ramp), jsdom smoke test
/package.json      { "type": "module" }, npm test (jsdom is a devDependency)
```

Keep state in one plain object and render from it. Pure date and formatting functions must have unit tests. Source lives on a local Forgejo instance, mirrored to GitHub; GitHub Pages serves the site. No build output needed.

## 7. Acceptance examples

Date calculator:
- `01.12.2026` + 75 Tage = `14.02.2027` (Sonntag)
- `31.01.2027` + 1 Monat = `28.02.2027`
- `29.02.2028` + 1 Jahr = `28.02.2029`
- Differenz `01.12.2026` bis `14.02.2027` = `75 Tage`, "entspricht 10 Wochen und 5 Tagen"

Titration, manual mode (ramp switched off; Startdatum `02.12.2026`, Abstände 7 and 7):
- Rows: step 1 `02.12.2026`, step 2 `09.12.2026`, step 3 `16.12.2026`.
- Sertralin (Dosis, Einheit leer), doses `50-0-0-0`, `25-0-0-0`, `0-0-0-0` give `Sertralin 50mg-0-0-0`, `Sertralin 25mg-0-0-0`, `Sertralin 0-0-0-0`.
- Mirtazapin (Tabletten, Stärke `15mg`), doses `0-0-0-0.5`, `0-0-0-1`, `0-0-0-1,5` give `Mirtazapin 15mg 0-0-0-0,5`, `Mirtazapin 15mg 0-0-0-1`, `Mirtazapin 15mg 0-0-0-1,5`.
- Pregabalin (Dosis, `mg`) `25-0-25-0` gives `Pregabalin 25mg-0-25mg-0`.
- Change step 2's Abstand to 14: step 2 becomes `16.12.2026`, step 3 becomes `23.12.2026`.
- Type `01.12.2026` as step 2's date: error "Vor dem vorigen Schritt", Abstand unchanged.
- Delete step 1: old step 2 becomes step 1 with date `02.12.2026`, Abstand shows `–` and is locked; toast with Rückgängig appears.

Titration, ramp on (Startdatum `02.12.2026`, Escitalopram, Dosis, Einheit leer):
- Step 1 `5-0-0-0`, step 2 (Abstand 7) `10-0-0-0`, Ziel `20-0-0-0`: the Ziel row shows Abstand `14` (locked) and date `23.12.2026`. Output blocks: `ab 02.12.2026:` `5mg`, `ab 09.12.2026:` `10mg`, `ab 16.12.2026:` `15mg`, `ab 23.12.2026:` `20mg` (each `Escitalopram <n>mg-0-0-0`).
- Goal `22` instead of `20`: blocks `5, 10, 15, 20, 22`, the last on `30.12.2026`.
- Mirtazapin (Tabletten, Ganz) `1-0-0-0`, step 2 with Abstand 1 `2-0-0-0`, Ziel `7-0-0-0`: one block per day, `1` to `7`. Setting `0,5` as a dose with `Ganz` shows the Teilbarkeit hint.
- Switching the ramp off with three rows keeps the rows; switching it on with five rows leaves three and shows the toast "2 Schritte entfernt" with Rückgängig.
- Click into a dose cell showing `0` and type `5`: the cell shows `5`.

## 8. Out of scope
Login, saving or sharing schedules, printing, drug databases, interaction or dose-range checks, holiday or working-day logic, other languages, mobile-first layout.
