const icons = {
  check: '<path d="m5 12 4 4L19 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  hourglass: '<path d="M7 3h10M7 21h10M8 3c0 4 1 6 4 9-3 3-4 5-4 9M16 3c0 4-1 6-4 9 3 3 4 5 4 9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
};

const seed = [
  { id: 1, name: 'Knebøy', open: true, sets: [
    { load: '110', reps: '5', complete: true },
    { load: '110', reps: '5', complete: true },
    { load: '112,5', reps: '5', complete: false },
  ] },
  { id: 2, name: 'Benkpress', open: false, sets: [
    { load: '80', reps: '8', complete: true },
    { load: '80', reps: '8', complete: true },
    { load: '80', reps: '8', complete: true },
  ] },
  { id: 3, name: 'Sittende roing', open: false, sets: [
    { load: '65', reps: '10', complete: false },
    { load: '65', reps: '10', complete: false },
  ] },
];

let exercises = structuredClone(seed);
let editing = '1-2';
const list = document.querySelector('#exercise-list');

function icon(name, extra = '') {
  return `<svg class="icon ${extra}" viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
}

function renderSet(exercise, set, index) {
  const key = `${exercise.id}-${index}`;
  const isEditing = editing === key;
  return `<div class="set ${set.complete ? 'complete' : ''}">
    <div class="set-row">
      <span class="set-number">${index + 1}</span>
      <span class="set-copy"><strong>${set.load || '–'} kg · ${set.reps || '–'} repetisjoner</strong><span class="set-state">${icon(set.complete ? 'check' : 'hourglass')}${set.complete ? 'Gjennomført' : 'Planlagt'}</span></span>
      <button class="icon-button" data-action="edit" data-key="${key}" type="button" aria-label="${isEditing ? 'Lukk redigering av' : 'Rediger'} sett ${index + 1}">${icon(isEditing ? 'up' : 'edit')}</button>
      <button class="icon-button" data-action="toggle-set" data-exercise="${exercise.id}" data-index="${index}" type="button" aria-label="${set.complete ? 'Endre til planlagt' : 'Marker som gjennomført'}">${icon(set.complete ? 'hourglass' : 'check')}</button>
    </div>
    ${isEditing ? `<div class="editor">
      <button class="compact-action danger" type="button">${icon('trash')}Fjern sett</button>
      <div class="fields">
        <label class="field">Belastning<input value="${set.load}" inputmode="decimal"></label>
        <label class="field">Repetisjoner<input value="${set.reps}" inputmode="numeric"></label>
      </div>
    </div>` : ''}
  </div>`;
}

function renderExercise(exercise) {
  const completed = exercise.sets.filter((set) => set.complete).length;
  const complete = exercise.sets.length > 0 && completed === exercise.sets.length;
  const progress = exercise.sets.length ? completed / exercise.sets.length : 0;
  return `<article class="exercise-card">
    <button class="exercise-header" style="--progress: ${progress}" data-action="toggle-card" data-exercise="${exercise.id}" type="button" aria-expanded="${exercise.open}">
      <span class="exercise-progress" aria-hidden="true"></span>
      <span class="exercise-status ${complete ? 'complete' : ''}">${icon(complete ? 'check' : 'hourglass')}</span>
      <span class="exercise-copy"><strong>${exercise.name}</strong><span>${completed} av ${exercise.sets.length} sett gjennomført</span></span>
      ${icon(exercise.open ? 'up' : 'down', 'chevron')}
    </button>
    ${exercise.open ? `<div class="exercise-content">
      <button class="compact-action danger" type="button">${icon('trash')}Fjern øvelse</button>
      ${exercise.sets.map((set, index) => renderSet(exercise, set, index)).join('')}
      <div class="exercise-actions"><button class="compact-action" data-action="add-set" data-exercise="${exercise.id}" type="button">${icon('plus')}Legg til sett</button></div>
    </div>` : ''}
  </article>`;
}

function render(progressFrom = new Map()) {
  list.innerHTML = exercises.map(renderExercise).join('');
  document.querySelector('#finish').disabled = !exercises.some((exercise) => exercise.sets.some((set) => set.complete));
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    progressFrom.forEach((from, exerciseId) => {
      const exercise = exercises.find((item) => item.id === exerciseId);
      const progress = exercise.sets.length
        ? exercise.sets.filter((set) => set.complete).length / exercise.sets.length
        : 0;
      list.querySelector(`[data-exercise="${exerciseId}"] .exercise-progress`)?.animate(
        [{ transform: `scaleX(${from})` }, { transform: `scaleX(${progress})` }],
        { duration: 420, easing: 'cubic-bezier(.2, .8, .2, 1)' },
      );
    });
  }
}

list.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const exercise = exercises.find((item) => item.id === Number(button.dataset.exercise));
  if (button.dataset.action === 'toggle-card' && exercise) exercise.open = !exercise.open;
  if (button.dataset.action === 'edit') editing = editing === button.dataset.key ? '' : button.dataset.key;
  const progressFrom = new Map();
  if (button.dataset.action === 'toggle-set' && exercise) {
    progressFrom.set(exercise.id, exercise.sets.filter((set) => set.complete).length / exercise.sets.length);
    exercise.sets[Number(button.dataset.index)].complete = !exercise.sets[Number(button.dataset.index)].complete;
  }
  if (button.dataset.action === 'add-set' && exercise) {
    const previous = exercise.sets.at(-1) || { load: '', reps: '' };
    exercise.sets.push({ load: previous.load, reps: previous.reps, complete: false });
  }
  render(progressFrom);
});

document.querySelector('#theme-toggle').addEventListener('click', (event) => {
  const dark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  event.currentTarget.textContent = dark ? 'Mørk modus' : 'Lys modus';
});

document.querySelector('#reset').addEventListener('click', () => {
  exercises = structuredClone(seed);
  editing = '1-2';
  render();
});

render();
