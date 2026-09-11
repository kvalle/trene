const variants = {
  a: {
    name: 'Inline ekspansjon',
    description: 'Planlagte sett er kompakte rader. Den valgte raden åpner sin egen editor på stedet.',
  },
  b: {
    name: 'Delt editor',
    description: 'Alle sett forblir kompakte, mens ett fast redigeringsområde viser det valgte settet.',
  },
  c: {
    name: 'Direktefelter',
    description: 'Alle planlagte sett har små, direkte redigerbare felt i samme skannelige tabell.',
  },
};

const exerciseSeed = [
  {
    id: 'bench',
    name: 'Benkpress med stang og kontrollert stopp på brystet',
    sets: [
      { id: 'b1', status: 'completed', load: '80', reps: '8' },
      { id: 'b2', status: 'completed', load: '82,5', reps: '8' },
      { id: 'b3', status: 'completed', load: '82,5', reps: '7' },
      { id: 'b4', status: 'completed', load: '80', reps: '8' },
      { id: 'b5', status: 'planned', load: '80', reps: '8' },
      { id: 'b6', status: 'planned', load: '82,5', reps: '' },
      { id: 'b7', status: 'planned', load: '', reps: '' },
    ],
  },
  { id: 'squat', name: 'Knebøy', sets: [{ id: 's1', status: 'completed', load: '110', reps: '5' }, { id: 's2', status: 'planned', load: '110', reps: '5' }] },
  { id: 'row', name: 'Sittende roing', sets: [{ id: 'r1', status: 'completed', load: '65', reps: '10' }, { id: 'r2', status: 'planned', load: '65', reps: '10' }] },
  { id: 'press', name: 'Skulderpress', sets: [{ id: 'p1', status: 'planned', load: '24', reps: '8' }] },
  { id: 'curl', name: 'Hammercurl', sets: [] },
];

const screen = document.querySelector('#screen');
const phone = document.querySelector('#phone');
const keyboard = document.querySelector('#keyboard');
const dialogLayer = document.querySelector('#dialog-layer');
const variantKeys = Object.keys(variants);
const params = new URLSearchParams(window.location.search);

let variant = variants[params.get('variant')] ? params.get('variant') : 'a';
let scenario = params.get('scenario') === 'empty' ? 'empty' : 'dense';
let reviewState = 'normal';
let expansion = 'one';
let openExerciseIds = new Set(['bench']);
let selectedSetId = 'b6';
let exercises = cloneSeed();

function cloneSeed() {
  return exerciseSeed.map((exercise) => ({ ...exercise, sets: exercise.sets.map((set) => ({ ...set })) }));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function setQueryParam(name, value) {
  const next = new URL(window.location.href);
  next.searchParams.set(name, value);
  window.history.replaceState({}, '', next);
}

function compactAction(icon, label, action, extra = '') {
  return `<button class="compact-action ${extra}" data-action="${action}" type="button"><span aria-hidden="true">${icon}</span>${label}</button>`;
}

function summary(exercise) {
  const completed = exercise.sets.filter((set) => set.status === 'completed').length;
  const planned = exercise.sets.length - completed;
  if (!exercise.sets.length) return 'Ingen sett ennå';
  return `${completed} gjennomført · ${planned} planlagt`;
}

function expandedIds() {
  return [...openExerciseIds];
}

function setExpansion(value) {
  expansion = value;
  openExerciseIds = value === 'zero' ? new Set() : value === 'several' ? new Set(['bench', 'squat', 'row']) : new Set(['bench']);
}

function renderCompletedRow(set, index) {
  return `<div class="set-row completed" data-set-id="${set.id}">
    <span class="set-number">${index + 1}</span>
    <span class="set-copy"><b>${escapeHtml(set.load)} kg × ${escapeHtml(set.reps)}</b><small>Gjennomført</small></span>
    <button class="compact-action" data-action="reopen" data-set-id="${set.id}" type="button"><span aria-hidden="true">↶</span>Endre</button>
  </div>`;
}

function stateFor(set) {
  if (set.id !== 'b6') return 'normal';
  return reviewState;
}

function editor(set, index, shared = false) {
  const state = stateFor(set);
  const invalid = state === 'invalid';
  const failed = state === 'failed';
  const busy = state === 'busy';
  const load = invalid ? '-10' : set.load;
  return `<section class="${shared ? 'shared-editor' : 'expanded-editor'}" aria-label="Rediger sett ${index + 1}">
    <div class="editor-heading"><b>Sett ${index + 1}</b><span>${shared ? 'Valgt sett' : 'Redigerer inline'}</span></div>
    <div class="fields">
      <label class="field ${invalid ? 'invalid' : ''}"><span>Belastning (kg)</span><input data-field="load" data-set-id="${set.id}" inputmode="decimal" value="${escapeHtml(load)}" ${busy ? 'disabled' : ''}></label>
      <label class="field"><span>Repetisjoner</span><input data-field="reps" data-set-id="${set.id}" inputmode="numeric" value="${escapeHtml(set.reps)}" ${busy ? 'disabled' : ''}></label>
    </div>
    ${invalid ? '<p class="field-error" role="alert">Belastningen må være null eller mer.</p>' : ''}
    ${failed ? '<aside class="error-alert" role="alert"><b>Kunne ikke lagre settet</b>Verdiene dine er beholdt. Prøv igjen lokalt.</aside>' : ''}
    <div class="editor-actions">
      ${compactAction('×', 'Fjern sett', 'remove-set', 'danger')}
      ${failed ? '<button class="button primary" data-action="retry" type="button">Prøv igjen</button>' : busy ? '<button class="button" type="button" disabled><span class="spinner"></span>Lagrer</button>' : '<button class="button primary" data-action="confirm" type="button">Bekreft</button>'}
    </div>
  </section>`;
}

function renderVariantA(exercise) {
  return exercise.sets.map((set, index) => {
    if (set.status === 'completed') return renderCompletedRow(set, index);
    const selected = set.id === selectedSetId;
    const label = set.load || set.reps ? `${set.load || '–'} kg × ${set.reps || '–'}` : 'Tomt planlagt sett';
    return `<div data-set-container="${set.id}">
      <div class="set-row ${selected ? 'selected' : ''}">
        <span class="set-number">${index + 1}</span>
        <span class="set-copy"><b>${escapeHtml(label)}</b><small>${selected ? 'Redigerer' : 'Planlagt'}</small></span>
        <button class="compact-action" data-action="select" data-set-id="${set.id}" type="button" aria-expanded="${selected}">${selected ? 'Lukk' : 'Rediger'}</button>
      </div>
      ${selected ? editor(set, index) : ''}
    </div>`;
  }).join('');
}

function renderVariantB(exercise) {
  const rows = exercise.sets.map((set, index) => {
    if (set.status === 'completed') return renderCompletedRow(set, index);
    const selected = set.id === selectedSetId;
    const label = set.load || set.reps ? `${set.load || '–'} kg × ${set.reps || '–'}` : 'Tomt planlagt sett';
    return `<div class="set-row ${selected ? 'selected' : ''}">
      <span class="set-number">${index + 1}</span>
      <span class="set-copy"><b>${escapeHtml(label)}</b><small>${selected ? 'Valgt' : 'Planlagt'}</small></span>
      <button class="compact-action" data-action="select" data-set-id="${set.id}" type="button" aria-pressed="${selected}">${selected ? 'Valgt' : 'Velg'}</button>
    </div>`;
  }).join('');
  const selected = exercise.sets.find((set) => set.id === selectedSetId && set.status === 'planned');
  const selectedIndex = exercise.sets.findIndex((set) => set.id === selectedSetId);
  return `${rows}${selected ? editor(selected, selectedIndex, true) : ''}`;
}

function renderVariantC(exercise) {
  return exercise.sets.map((set, index) => {
    if (set.status === 'completed') return renderCompletedRow(set, index);
    const state = stateFor(set);
    const invalid = state === 'invalid';
    const failed = state === 'failed';
    const busy = state === 'busy';
    return `<div data-set-container="${set.id}">
      <div class="dense-edit-row">
        <span class="set-number">${index + 1}</span>
        <label><span>kg</span><input class="dense-input ${invalid ? 'invalid' : ''}" aria-label="Belastning for sett ${index + 1}" data-field="load" data-set-id="${set.id}" inputmode="decimal" value="${escapeHtml(invalid ? '-10' : set.load)}" ${busy ? 'disabled' : ''}></label>
        <label><span>reps</span><input class="dense-input" aria-label="Repetisjoner for sett ${index + 1}" data-field="reps" data-set-id="${set.id}" inputmode="numeric" value="${escapeHtml(set.reps)}" ${busy ? 'disabled' : ''}></label>
        <button class="icon-action confirm" data-action="confirm" data-set-id="${set.id}" type="button" aria-label="Bekreft sett ${index + 1}" ${busy || invalid ? 'disabled' : ''}>✓</button>
        <button class="icon-action" data-action="remove-set" data-set-id="${set.id}" type="button" aria-label="Fjern sett ${index + 1}" ${busy ? 'disabled' : ''}>×</button>
      </div>
      ${invalid ? '<p class="field-error" role="alert">Sett 6: Belastningen må være null eller mer.</p>' : ''}
      ${failed ? '<aside class="error-alert" role="alert"><b>Sett 6 ble ikke lagret</b>Verdiene er beholdt. <button class="compact-action" data-action="retry" type="button">Prøv igjen</button></aside>' : ''}
      ${busy ? '<p class="field-error"><span class="spinner"></span>Lagrer sett 6. Andre sett er fortsatt tilgjengelige.</p>' : ''}
    </div>`;
  }).join('');
}

function exerciseCard(exercise) {
  const open = expandedIds().includes(exercise.id);
  let sets = '';
  if (variant === 'a') sets = renderVariantA(exercise);
  if (variant === 'b') sets = renderVariantB(exercise);
  if (variant === 'c') sets = renderVariantC(exercise);
  return `<article class="exercise-card" data-exercise-id="${exercise.id}">
    <button class="exercise-header" data-action="toggle-exercise" data-exercise-id="${exercise.id}" type="button" aria-expanded="${open}">
      <span><b>${escapeHtml(exercise.name)}</b><small>${summary(exercise)}</small></span><span class="chevron" aria-hidden="true">${open ? '−' : '+'}</span>
    </button>
    ${open ? `<div class="exercise-body"><div class="set-list">${sets}</div><div class="exercise-actions">${compactAction('×', 'Fjern øvelse', 'remove-exercise', 'danger')}${compactAction('+', 'Legg til sett', 'add-set')}</div></div>` : ''}
  </article>`;
}

function denseWorkout() {
  return `<div class="workout-meta"><span>Tirsdag 25. august · 29 min</span><strong>6 sett ferdig</strong></div>
    <div class="exercise-list variant-${variant}">${exercises.map(exerciseCard).join('')}</div>
    <div class="workout-actions">
      <button class="button secondary" data-action="add-exercise" type="button">Legg til øvelse</button>
      <button class="button primary" data-action="finish" type="button">Fullfør trening</button>
      <button class="button text" data-action="cancel" type="button">Avbryt trening</button>
    </div>`;
}

function emptyWorkout() {
  return `<section class="empty-state"><p class="eyebrow">Aktiv treningsøkt</p><h2>Hva vil du trene?</h2><p>Legg til den første øvelsen. Settene lagres bare i denne prototypen mens fanen er åpen.</p><button class="button primary" data-action="add-exercise" type="button">Legg til øvelse</button><button class="button text" data-action="cancel" type="button">Avbryt trening</button></section>`;
}

function render() {
  const details = variants[variant];
  document.querySelector('#variant-kicker').textContent = `Variant ${variant.toUpperCase()}`;
  document.querySelector('#variant-title').textContent = details.name;
  document.querySelector('#variant-description').textContent = details.description;
  document.querySelector('#variant-switcher-label').textContent = `${variant.toUpperCase()} - ${details.name}`;
  screen.innerHTML = scenario === 'empty' ? emptyWorkout() : denseWorkout();
  bindScreenActions();
  updateControls();
}

function updateControls() {
  document.querySelectorAll('[data-setting]').forEach((button) => {
    const current = button.dataset.setting === 'scenario' ? scenario : button.dataset.setting === 'state' ? reviewState : expansion;
    button.classList.toggle('active', button.dataset.value === current);
  });
}

function updateSetFromInput(input) {
  const set = exercises.flatMap((exercise) => exercise.sets).find((candidate) => candidate.id === input.dataset.setId);
  if (set) set[input.dataset.field] = input.value;
}

function findSet(setId) {
  for (const exercise of exercises) {
    const set = exercise.sets.find((candidate) => candidate.id === setId);
    if (set) return { exercise, set };
  }
  return null;
}

function showDialog(kind) {
  const dialogs = {
    finish: ['Fullfør treningen?', 'Tre planlagte sett blir ikke med i historikken.', 'Fortsett trening', 'Fullfør trening', 'primary'],
    cancel: ['Avbryt treningsøkten?', 'Alle registrerte sett i denne økten slettes. Dette kan ikke angres.', 'Fortsett trening', 'Avbryt og slett', 'danger'],
    'remove-exercise': ['Fjern øvelsen?', 'Øvelsen og settene fjernes fra denne økten. Historikken endres ikke.', 'Behold øvelsen', 'Fjern øvelse', 'danger'],
    'add-exercise': ['Legg til øvelse', 'Øvelsesvelgeren er utenfor prototypen. Dialogen viser handlingsnivået i kontekst.', 'Avbryt', 'Vis øvelser', 'primary'],
  };
  const [title, copy, safe, confirm, confirmClass] = dialogs[kind];
  dialogLayer.innerHTML = `<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">${title}</h2><p>${copy}</p><div class="dialog-actions"><button class="button secondary" data-action="close-dialog" type="button">${safe}</button><button class="button ${confirmClass}" data-action="close-dialog" type="button">${confirm}</button></div></section>`;
  dialogLayer.hidden = false;
  dialogLayer.querySelector('.button').focus();
  dialogLayer.querySelectorAll('[data-action="close-dialog"]').forEach((button) => button.addEventListener('click', () => { dialogLayer.hidden = true; }));
}

function bindScreenActions() {
  screen.querySelectorAll('input').forEach((input) => input.addEventListener('input', () => updateSetFromInput(input)));
  screen.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (['finish', 'cancel', 'remove-exercise', 'add-exercise'].includes(action)) showDialog(action);
    if (action === 'select') { selectedSetId = selectedSetId === button.dataset.setId && variant === 'a' ? '' : button.dataset.setId; render(); }
    if (action === 'retry') { reviewState = 'busy'; render(); }
    if (action === 'confirm') {
      const confirmedSetId = button.dataset.setId || selectedSetId;
      const target = findSet(confirmedSetId);
      if (target) target.set.status = 'completed';
      if (selectedSetId === confirmedSetId) selectedSetId = '';
      reviewState = 'normal';
      render();
    }
    if (action === 'reopen') {
      const target = findSet(button.dataset.setId);
      if (target) target.set.status = 'planned';
      selectedSetId = button.dataset.setId;
      render();
    }
    if (action === 'remove-set') {
      const setId = button.dataset.setId || button.closest('[data-set-container]')?.dataset.setContainer || selectedSetId;
      const target = findSet(setId);
      if (target) target.exercise.sets = target.exercise.sets.filter((set) => set.id !== setId);
      if (selectedSetId === setId) selectedSetId = '';
      render();
    }
    if (action === 'add-set') {
      const card = button.closest('[data-exercise-id]');
      const exercise = exercises.find((candidate) => candidate.id === card.dataset.exerciseId);
      const id = `${exercise.id}-${Date.now()}`;
      exercise.sets.push({ id, status: 'planned', load: '', reps: '' });
      selectedSetId = id;
      render();
    }
    if (action === 'toggle-exercise') {
      const id = button.dataset.exerciseId;
      if (openExerciseIds.has(id)) openExerciseIds.delete(id);
      else openExerciseIds.add(id);
      expansion = openExerciseIds.size === 0 ? 'zero' : openExerciseIds.size === 1 ? 'one' : 'several';
      render();
    }
  }));
}

function changeVariant(direction) {
  const current = variantKeys.indexOf(variant);
  variant = variantKeys[(current + direction + variantKeys.length) % variantKeys.length];
  setQueryParam('variant', variant);
  selectedSetId = 'b6';
  render();
}

document.querySelectorAll('[data-setting]').forEach((button) => button.addEventListener('click', () => {
  const { setting, value } = button.dataset;
  if (setting === 'scenario') { scenario = value; setQueryParam('scenario', value); }
  if (setting === 'state') reviewState = value;
  if (setting === 'expansion') setExpansion(value);
  exercises = cloneSeed();
  selectedSetId = 'b6';
  render();
}));

document.querySelector('#theme-toggle').addEventListener('click', (event) => {
  const dark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  event.currentTarget.textContent = dark ? 'Mørk modus' : 'Lys modus';
  event.currentTarget.setAttribute('aria-pressed', String(!dark));
});

document.querySelector('#text-toggle').addEventListener('click', (event) => {
  const active = screen.classList.toggle('large-text');
  event.currentTarget.setAttribute('aria-pressed', String(active));
});

document.querySelector('#width-toggle').addEventListener('click', (event) => {
  const active = phone.classList.toggle('narrow');
  event.currentTarget.setAttribute('aria-pressed', String(active));
});

document.querySelector('#keyboard-toggle').addEventListener('click', (event) => {
  keyboard.hidden = !keyboard.hidden;
  event.currentTarget.textContent = keyboard.hidden ? 'Vis tastatur' : 'Skjul tastatur';
  event.currentTarget.setAttribute('aria-pressed', String(!keyboard.hidden));
});

document.querySelector('#previous-variant').addEventListener('click', () => changeVariant(-1));
document.querySelector('#next-variant').addEventListener('click', () => changeVariant(1));
document.addEventListener('keydown', (event) => {
  const tagName = event.target.tagName;
  if (['INPUT', 'TEXTAREA'].includes(tagName) || event.target.isContentEditable) return;
  if (event.key === 'ArrowLeft') changeVariant(-1);
  if (event.key === 'ArrowRight') changeVariant(1);
});

render();
