const variants = {
  a: {
    name: 'Kant og tekstmarkør',
    description: 'Kortet blir liggende i listen med en tydelig kant og teksten «Flyttes». En egen merket rad viser nøyaktig slipplass.',
  },
  b: {
    name: 'Plassholder og løftet kopi',
    description: 'En merket plassholder beholder startplassen, mens en løftet kopi følger fingeren. En linje med tekst viser slipplass.',
  },
  c: {
    name: 'Prospektiv plassering',
    description: 'Kortet flyttes direkte til sin mulige sluttplass i listen og merkes med tekst, flate og et eget flytteikon.',
  },
};

const exerciseSeed = [
  { id: 'squat', name: 'Knebøy', summary: '3 av 3 sett gjennomført', completed: true },
  { id: 'bench', name: 'Benkpress', summary: '2 av 3 sett gjennomført', completed: false },
  { id: 'deadlift', name: 'Markløft', summary: '0 av 3 sett gjennomført', completed: false },
  { id: 'press', name: 'Skulderpress', summary: '0 av 2 sett gjennomført', completed: false },
];

const params = new URLSearchParams(window.location.search);
const variantKeys = Object.keys(variants);
const screen = document.querySelector('#screen');
const phone = document.querySelector('#phone');
const status = document.querySelector('#prototype-status');
let variant = variants[params.get('variant')] ? params.get('variant') : 'c';
let exercises = exerciseSeed.map((exercise) => ({ ...exercise }));
let expandedId = 'bench';
let dragging = false;
let targetIndex = 1;
let dragStartIndex = 1;
let holdTimer;
let pointerId;
let pointerStartY;
let pointerType;
let suppressNextClick = false;

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function setQueryParam(name, value) {
  const next = new URL(window.location.href);
  next.searchParams.set(name, value);
  window.history.replaceState({}, '', next);
}

function moveIcon() {
  return `<svg class="move-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M8 18V6M5 9l3-3 3 3M16 6v12M13 15l3 3 3-3"/>
  </svg>`;
}

function card(exercise, className = '') {
  const open = expandedId === exercise.id && !dragging;
  const moving = dragging && exercise.id === 'bench';
  const summary = moving
    ? targetIndex === dragStartIndex ? 'Dra for å endre rekkefølge' : `Flytt til #${targetIndex + 1}`
    : exercise.summary;
  return `<article class="exercise-card ${className}" data-card-id="${exercise.id}">
    <button class="exercise-header" data-action="exercise" data-exercise-id="${exercise.id}" type="button" aria-expanded="${open}" aria-label="${escapeHtml(exercise.name)}, ${exercise.summary}">
      <span class="exercise-status ${exercise.completed ? 'completed' : ''} ${moving ? 'moving' : ''}" aria-hidden="true">${moving ? moveIcon() : exercise.completed ? '✓' : '⌛'}</span>
      <span class="exercise-copy"><b>${escapeHtml(exercise.name)}</b><small class="${moving ? 'moving-summary' : ''}">${summary}</small></span>
      <span class="disclosure" aria-hidden="true">${open ? '⌃' : '⌄'}</span>
    </button>
    ${open ? '<div class="exercise-body">Sett og redigeringskontroller vises her. Trykk og hold headeren for å starte flytting.</div>' : ''}
  </article>`;
}

function insertionMarker() {
  return `<div class="insertion-target" role="status">Slipp for plass ${targetIndex + 1}</div>`;
}

function displayedExercises() {
  if (!dragging || variant !== 'c') return exercises;
  const next = exercises.filter((exercise) => exercise.id !== 'bench');
  next.splice(targetIndex, 0, exercises.find((exercise) => exercise.id === 'bench'));
  return next;
}

function render(previousCardRects) {
  const details = variants[variant];
  document.querySelector('#variant-kicker').textContent = `Variant ${variant.toUpperCase()}`;
  document.querySelector('#variant-title').textContent = details.name;
  document.querySelector('#variant-description').textContent = details.description;
  document.querySelector('#variant-switcher-label').textContent = `${variant.toUpperCase()} - ${details.name}`;
  document.querySelector('#demo-toggle').textContent = dragging ? 'Slipp kortet' : 'Vis dragtilstand';
  status.textContent = dragging ? `Benkpress flyttes til plass ${targetIndex + 1} av ${exercises.length}` : 'Klar til å flytte';

  const list = displayedExercises();
  let content = '';
  list.forEach((exercise, index) => {
    if (dragging && variant !== 'c' && index === targetIndex) content += insertionMarker();
    const classes = [];
    if (dragging && exercise.id === 'bench') classes.push(variant === 'b' ? 'drag-origin' : 'dragging');
    content += card(exercise, classes.join(' '));
  });
  if (dragging && variant !== 'c' && targetIndex === list.length) content += insertionMarker();
  if (dragging && variant === 'b') {
    const moving = exercises.find((exercise) => exercise.id === 'bench');
    content += `<div class="drag-copy" aria-hidden="true">${card(moving, 'dragging')}</div>`;
  }

  screen.innerHTML = `<p class="workout-started">Startet i dag kl. 09:18</p><div class="exercise-list variant-${variant}">${content}</div><div class="workout-actions"><button type="button">Legg til øvelse</button><button class="primary" type="button">Ferdig</button></div>`;
  bindCards();
  if (previousCardRects && !screen.classList.contains('reduced-motion')) {
    screen.querySelectorAll('[data-card-id]').forEach((element) => {
      const previous = previousCardRects.get(element.dataset.cardId);
      if (!previous) return;
      const current = element.getBoundingClientRect();
      const deltaY = previous.top - current.top;
      if (deltaY) element.animate(
        [{ transform: `translateY(${deltaY}px)` }, { transform: 'translateY(0)' }],
        { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' },
      );
    });
  }
}

function startDrag() {
  clearTimeout(holdTimer);
  if (dragging) return;
  dragging = true;
  expandedId = undefined;
  dragStartIndex = exercises.findIndex((exercise) => exercise.id === 'bench');
  targetIndex = dragStartIndex;
  render();
}

function finishDrag() {
  clearTimeout(holdTimer);
  if (!dragging) return;
  const from = exercises.findIndex((exercise) => exercise.id === 'bench');
  const [moved] = exercises.splice(from, 1);
  exercises.splice(targetIndex, 0, moved);
  dragging = false;
  pointerId = undefined;
  render();
  status.textContent = `Benkpress flyttet til plass ${targetIndex + 1} av ${exercises.length}`;
}

function targetFromPointer(clientY) {
  const cards = [...screen.querySelectorAll('.exercise-card:not(.drag-origin), .drag-origin')];
  const candidates = cards.filter((element) => element.dataset.cardId !== 'bench');
  let nextTarget = candidates.findIndex((element) => clientY < element.getBoundingClientRect().top + element.offsetHeight / 2);
  if (nextTarget < 0) nextTarget = candidates.length;
  const originalIndex = exercises.findIndex((exercise) => exercise.id === 'bench');
  if (variant !== 'c' && nextTarget > originalIndex) nextTarget += 1;
  nextTarget = Math.max(0, Math.min(exercises.length - 1, nextTarget));
  if (nextTarget !== targetIndex) {
    const previousCardRects = new Map([...screen.querySelectorAll('[data-card-id]')]
      .map((element) => [element.dataset.cardId, element.getBoundingClientRect()]));
    targetIndex = nextTarget;
    render(variant === 'c' ? previousCardRects : undefined);
  }
}

function bindCards() {
  screen.querySelectorAll('[data-action="exercise"]').forEach((header) => {
    header.addEventListener('click', (event) => {
      if (suppressNextClick) {
        suppressNextClick = false;
        event.preventDefault();
        return;
      }
      if (dragging) {
        event.preventDefault();
        return;
      }
      expandedId = expandedId === header.dataset.exerciseId ? undefined : header.dataset.exerciseId;
      render();
    });
    if (header.dataset.exerciseId !== 'bench') return;
    header.addEventListener('pointerdown', (event) => {
      pointerId = event.pointerId;
      pointerStartY = event.clientY;
      pointerType = event.pointerType;
      holdTimer = window.setTimeout(startDrag, 420);
    });
  });
}

function changeVariant(direction) {
  const current = variantKeys.indexOf(variant);
  variant = variantKeys[(current + direction + variantKeys.length) % variantKeys.length];
  setQueryParam('variant', variant);
  render();
}

document.querySelector('#demo-toggle').addEventListener('click', () => dragging ? finishDrag() : startDrag());
document.querySelector('#theme-toggle').addEventListener('click', (event) => {
  const dark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  event.currentTarget.textContent = dark ? 'Mørk modus' : 'Lys modus';
  event.currentTarget.setAttribute('aria-pressed', String(!dark));
});
document.querySelector('#motion-toggle').addEventListener('click', (event) => {
  const active = screen.classList.toggle('reduced-motion');
  event.currentTarget.setAttribute('aria-pressed', String(active));
});
document.querySelector('#text-toggle').addEventListener('click', (event) => {
  const active = screen.classList.toggle('large-text');
  event.currentTarget.setAttribute('aria-pressed', String(active));
});
document.querySelector('#reset-button').addEventListener('click', () => {
  exercises = exerciseSeed.map((exercise) => ({ ...exercise }));
  expandedId = 'bench';
  dragging = false;
  render();
});
document.querySelector('#previous-variant').addEventListener('click', () => changeVariant(-1));
document.querySelector('#next-variant').addEventListener('click', () => changeVariant(1));
document.addEventListener('pointermove', (event) => {
  if (event.pointerId !== pointerId) return;
  if (!dragging && pointerType === 'mouse' && Math.abs(event.clientY - pointerStartY) > 6) {
    startDrag();
  }
  if (dragging) targetFromPointer(event.clientY);
});
document.addEventListener('pointerup', (event) => {
  if (event.pointerId !== pointerId) return;
  clearTimeout(holdTimer);
  if (dragging) {
    suppressNextClick = true;
    finishDrag();
  }
  pointerId = undefined;
  pointerStartY = undefined;
  pointerType = undefined;
});
document.addEventListener('pointercancel', (event) => {
  if (event.pointerId !== pointerId) return;
  clearTimeout(holdTimer);
  dragging = false;
  pointerId = undefined;
  pointerStartY = undefined;
  pointerType = undefined;
  render();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') changeVariant(-1);
  if (event.key === 'ArrowRight') changeVariant(1);
  if (event.key === ' ') {
    event.preventDefault();
    dragging ? finishDrag() : startDrag();
  }
});

render();
