const variants = {
  a: {
    name: 'Ledende status',
    description: 'En kompakt sirkel står først i headeren og gjør status til startpunktet i skanningen.',
  },
  b: {
    name: 'Status ved kontroll',
    description: 'Status ligger sist i headeren, tett på utvidelseskontrollen, mens navn og fremdrift beholder forkant.',
  },
  c: {
    name: 'Kortbehandling',
    description: 'Hele det fullførte kortet får en rolig grønn flate og tydelig kant, med en liten sjekk ved kontrollen.',
  },
};

const exerciseSeed = [
  {
    id: 'deadlift',
    name: 'Markløft',
    sets: [
      { id: 'd1', label: '100 kg · 5 repetisjoner', completed: true },
      { id: 'd2', label: '105 kg · 5 repetisjoner', completed: true },
      { id: 'd3', label: '105 kg · 5 repetisjoner', completed: true },
    ],
  },
  {
    id: 'bench',
    name: 'Benkpress med stang og kontrollert stopp på brystet',
    sets: [
      { id: 'b1', label: '80 kg · 8 repetisjoner', completed: true },
      { id: 'b2', label: '80 kg · 8 repetisjoner', completed: true },
      { id: 'b3', label: '80 kg · 8 repetisjoner', completed: false },
    ],
  },
  {
    id: 'press',
    name: 'Skulderpress',
    sets: [
      { id: 'p1', label: '24 kg · 8 repetisjoner', completed: false },
      { id: 'p2', label: '24 kg · 8 repetisjoner', completed: false },
    ],
  },
  { id: 'pullup', name: 'Kroppsheving', sets: [] },
];

const params = new URLSearchParams(window.location.search);
const variantKeys = Object.keys(variants);
const screen = document.querySelector('#screen');
const phone = document.querySelector('#phone');

if (params.has('capture')) document.body.dataset.capture = 'true';

let variant = variants[params.get('variant')] ? params.get('variant') : 'a';
let exercises = cloneSeed();
let expansion = 'mixed';
let openExerciseIds = new Set(['bench', 'press']);

function cloneSeed() {
  return exerciseSeed.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => ({ ...set })),
  }));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function setQueryParam(name, value) {
  const next = new URL(window.location.href);
  next.searchParams.set(name, value);
  window.history.replaceState({}, '', next);
}

function isCompleted(exercise) {
  return exercise.sets.length > 0 && exercise.sets.every((set) => set.completed);
}

function summary(exercise) {
  const completed = exercise.sets.filter((set) => set.completed).length;
  return `${completed} av ${exercise.sets.length} sett gjennomført`;
}

function icon(name) {
  const paths = {
    check: '<path d="m5 12 4 4L19 6"/>',
    hourglass: '<path d="M7 3h10M7 21h10M8 3c0 4 1 6 4 9-3 3-4 5-4 9M16 3c0 4-1 6-4 9 3 3 4 5 4 9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevronUp: '<path d="m6 15 6-6 6 6"/>',
  };
  return `<svg class="prototype-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}

function statusIndicator(completed, placement) {
  return `<span class="exercise-status ${placement} ${completed ? 'completed' : 'incomplete'}" aria-hidden="true">${icon(completed ? 'check' : 'hourglass')}</span>`;
}

function setRow(set, index, exerciseName) {
  const action = set.completed ? 'Endre til planlagt' : 'Marker gjennomført';
  return `<div class="set-row">
    <span class="set-number ${set.completed ? 'completed' : ''}">${index + 1}</span>
    <span class="set-copy"><b>${escapeHtml(set.label)}</b><small>${set.completed ? 'Gjennomført' : 'Planlagt'}</small></span>
    <button class="set-toggle ${set.completed ? 'secondary' : 'primary'}" data-action="toggle-set" data-set-id="${set.id}" type="button" aria-label="${action}: sett ${index + 1} for ${escapeHtml(exerciseName)}">${icon(set.completed ? 'hourglass' : 'check')}</button>
  </div>`;
}

function exerciseCard(exercise) {
  const completed = isCompleted(exercise);
  const open = openExerciseIds.has(exercise.id);
  const accessibleStatus = completed ? 'fullført' : 'ikke fullført';
  const leading = variant === 'a' ? statusIndicator(completed, 'leading') : '';
  const trailing = variant === 'b' || variant === 'c' ? statusIndicator(completed, 'trailing') : '';
  const sets = exercise.sets.length
    ? exercise.sets.map((set, index) => setRow(set, index, exercise.name)).join('')
    : '<p class="empty-sets">Ingen sett ennå</p>';

  return `<article class="exercise-card ${variant === 'c' && completed ? 'card-completed' : ''}" data-exercise-id="${exercise.id}">
    <button class="exercise-header" data-action="toggle-exercise" data-exercise-id="${exercise.id}" type="button" aria-expanded="${open}" aria-label="${escapeHtml(exercise.name)}, ${summary(exercise)}, ${accessibleStatus}">
      ${leading}
      <span class="exercise-copy"><b>${escapeHtml(exercise.name)}</b><small>${summary(exercise)}</small></span>
      <span class="trailing-controls">${trailing}<span class="disclosure" aria-hidden="true">${icon(open ? 'chevronUp' : 'plus')}</span></span>
    </button>
    ${open ? `<div class="exercise-body">${sets}<button class="add-set" data-action="add-set" data-exercise-id="${exercise.id}" type="button">${icon('plus')}Legg til sett</button></div>` : ''}
  </article>`;
}

function render(focusSelector) {
  const details = variants[variant];
  document.querySelector('#variant-kicker').textContent = `Variant ${variant.toUpperCase()}`;
  document.querySelector('#variant-title').textContent = details.name;
  document.querySelector('#variant-description').textContent = details.description;
  document.querySelector('#variant-switcher-label').textContent = `${variant.toUpperCase()} - ${details.name}`;
  screen.innerHTML = `<p class="workout-started">Startet i dag kl. 09:18</p><div class="exercise-list variant-${variant}">${exercises.map(exerciseCard).join('')}</div><div class="workout-actions"><button type="button">Legg til øvelse</button><button class="primary" type="button">Ferdig</button></div>`;
  bindScreenActions();
  document.querySelectorAll('[data-expansion]').forEach((button) => {
    const active = button.dataset.expansion === expansion;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (focusSelector) requestAnimationFrame(() => screen.querySelector(focusSelector)?.focus());
}

function bindScreenActions() {
  screen.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.action === 'toggle-exercise') {
      const { exerciseId } = button.dataset;
      if (openExerciseIds.has(exerciseId)) openExerciseIds.delete(exerciseId);
      else openExerciseIds.add(exerciseId);
      expansion = openExerciseIds.size === 0 ? 'collapsed' : openExerciseIds.size === exercises.length ? 'expanded' : 'mixed';
      render(`[data-action="toggle-exercise"][data-exercise-id="${exerciseId}"]`);
      return;
    }
    if (button.dataset.action === 'add-set') {
      const exercise = exercises.find((candidate) => candidate.id === button.dataset.exerciseId);
      const setId = `${exercise.id}-${Date.now()}`;
      exercise.sets.push({ id: setId, label: '0 kg · 1 repetisjon', completed: false });
      render(`[data-set-id="${setId}"]`);
      return;
    }
    if (button.dataset.action === 'toggle-set') {
      const set = exercises.flatMap((exercise) => exercise.sets).find((candidate) => candidate.id === button.dataset.setId);
      set.completed = !set.completed;
      render(`[data-set-id="${set.id}"]`);
      return;
    }
  }));
}

function changeVariant(direction) {
  const current = variantKeys.indexOf(variant);
  variant = variantKeys[(current + direction + variantKeys.length) % variantKeys.length];
  setQueryParam('variant', variant);
  render();
}

document.querySelectorAll('[data-expansion]').forEach((button) => button.addEventListener('click', () => {
  expansion = button.dataset.expansion;
  openExerciseIds = expansion === 'collapsed' ? new Set() : expansion === 'expanded' ? new Set(exercises.map((exercise) => exercise.id)) : new Set(['bench', 'press']);
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

document.querySelector('#reset-button').addEventListener('click', () => {
  exercises = cloneSeed();
  render();
});

document.querySelector('#previous-variant').addEventListener('click', () => changeVariant(-1));
document.querySelector('#next-variant').addEventListener('click', () => changeVariant(1));
document.addEventListener('keydown', (event) => {
  if (['INPUT', 'TEXTAREA'].includes(event.target.tagName) || event.target.isContentEditable) return;
  if (event.key === 'ArrowLeft') changeVariant(-1);
  if (event.key === 'ArrowRight') changeVariant(1);
});

render();
