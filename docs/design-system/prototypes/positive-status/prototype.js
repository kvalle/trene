const variants = {
  a: {
    label: 'A · Fremdriftslinje',
    description: 'En linje under meldingen krymper mot venstre til statusen fjernes.',
  },
  b: {
    label: 'B · Nedtellingsring',
    description: 'En numerisk ring ved lukkeknappen viser antall sekunder som gjenstår.',
  },
  c: {
    label: 'C · Avtagende flate',
    description: 'En svak farget flate trekker seg tilbake mens tiden løper ut.',
  },
};

const keys = Object.keys(variants);
const duration = 5000;
const params = new URLSearchParams(window.location.search);
let current = variants[params.get('variant')] ? params.get('variant') : 'a';
let visible = true;
let largeText = false;
let remaining = duration;
let previousTime;
let animationFrame;
let paused = false;

const screen = document.querySelector('#screen');
const announcement = document.querySelector('#announcement');
const title = document.querySelector('#variant-title');
const description = document.querySelector('#variant-description');
const switcherLabel = document.querySelector('#switcher-label');

function statusMarkup() {
  if (!visible) return '';
  const progress = Math.max(0, remaining / duration);
  const timer = current === 'a'
    ? '<span class="timer-bar" aria-hidden="true"></span>'
    : current === 'b'
      ? `<span class="timer-ring" aria-hidden="true">${Math.ceil(remaining / 1000)}</span>`
      : '';
  return `
    <section class="positive-status" role="status" aria-live="polite" aria-atomic="true" style="--remaining:${progress}">
      <span class="icon" aria-hidden="true">✓</span>
      <p>Alle treningsdata er slettet.</p>
      ${timer}
      <button class="dismiss" type="button" aria-label="Lukk statusmelding">×</button>
      ${paused ? '<span class="paused-label">Pauset</span>' : ''}
    </section>`;
}

function historyMarkup() {
  const status = statusMarkup();
  const sessions = [
    ['I dag', '45 min', '4 øvelser', '18 sett'],
    ['3. september', '52 min', '5 øvelser', '21 sett'],
    ['1. september', '38 min', '3 øvelser', '15 sett'],
    ['29. august', '49 min', '4 øvelser', '20 sett'],
  ];
  const cards = sessions.map(([date, durationLabel, exercises, sets]) => `
    <article class="history-card">
      <h2>${date}</h2>
      <p>Fullført treningsøkt</p>
      <dl>
        <div><dt>Varighet</dt><dd>${durationLabel}</dd></div>
        <div><dt>Øvelser</dt><dd>${exercises}</dd></div>
        <div><dt>Sett</dt><dd>${sets}</dd></div>
      </dl>
    </article>`).join('');

  return `<p class="history-intro">De nyeste øktene vises først.</p>${cards}${status}`;
}

function render({ announce = false } = {}) {
  const variant = variants[current];
  screen.className = `screen variant-${current}${largeText ? ' large-text' : ''}`;
  screen.innerHTML = historyMarkup();
  title.textContent = variant.label;
  description.textContent = variant.description;
  switcherLabel.textContent = variant.label;
  document.querySelectorAll('[data-variant]').forEach((button) => {
    button.classList.toggle('active', button.dataset.variant === current);
  });
  document.querySelector('.dismiss')?.addEventListener('click', () => {
    visible = false;
    window.cancelAnimationFrame(animationFrame);
    render();
  });
  const status = document.querySelector('.positive-status');
  status?.addEventListener('pointerenter', pauseTimer);
  status?.addEventListener('pointerleave', resumeTimer);
  status?.addEventListener('focusin', pauseTimer);
  status?.addEventListener('focusout', resumeTimer);
  status?.addEventListener('pointerdown', pauseTimer);
  status?.addEventListener('pointerup', resumeTimer);
  updateTimerVisual();
  if (announce && visible) {
    announcement.textContent = '';
    window.setTimeout(() => { announcement.textContent = 'Alle treningsdata er slettet.'; }, 20);
  }
}

function updateTimerVisual() {
  const status = document.querySelector('.positive-status');
  if (!status) return;
  status.style.setProperty('--remaining', Math.max(0, remaining / duration));
  const ring = status.querySelector('.timer-ring');
  if (ring) ring.textContent = Math.ceil(remaining / 1000);
  let pausedLabel = status.querySelector('.paused-label');
  if (paused && !pausedLabel) {
    pausedLabel = document.createElement('span');
    pausedLabel.className = 'paused-label';
    pausedLabel.textContent = 'Pauset';
    status.append(pausedLabel);
  } else if (!paused) {
    pausedLabel?.remove();
  }
}

function pauseTimer() {
  if (paused) return;
  paused = true;
  previousTime = undefined;
  updateTimerVisual();
}

function resumeTimer() {
  if (!paused) return;
  paused = false;
  previousTime = undefined;
  updateTimerVisual();
}

function tick(time) {
  if (visible && !paused && previousTime !== undefined) remaining -= time - previousTime;
  previousTime = time;
  if (visible && remaining <= 0) {
    visible = false;
    announcement.textContent = 'Statusmeldingen ble fjernet.';
    render();
    return;
  }
  if (visible) updateTimerVisual();
  animationFrame = window.requestAnimationFrame(tick);
}

function restartTimer({ announce = true } = {}) {
  window.cancelAnimationFrame(animationFrame);
  visible = true;
  paused = false;
  remaining = duration;
  previousTime = undefined;
  render({ announce });
  animationFrame = window.requestAnimationFrame(tick);
}

function chooseVariant(key) {
  current = key;
  const url = new URL(window.location);
  url.searchParams.set('variant', current);
  window.history.replaceState({}, '', url);
  restartTimer();
}

function cycle(offset) {
  const index = keys.indexOf(current);
  chooseVariant(keys[(index + offset + keys.length) % keys.length]);
}

document.querySelectorAll('[data-variant]').forEach((button) => {
  button.addEventListener('click', () => chooseVariant(button.dataset.variant));
});
document.querySelector('#previous').addEventListener('click', () => cycle(-1));
document.querySelector('#next').addEventListener('click', () => cycle(1));
document.querySelector('#theme-toggle').addEventListener('click', (event) => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  event.currentTarget.textContent = dark ? 'Lys modus' : 'Mørk modus';
});
document.querySelector('#text-toggle').addEventListener('click', (event) => {
  largeText = !largeText;
  event.currentTarget.textContent = largeText ? 'Normal tekst' : 'Stor tekst';
  render();
});
document.querySelector('#reset-status').addEventListener('click', () => {
  restartTimer();
});
document.querySelector('#navigate').addEventListener('click', () => {
  visible = false;
  window.cancelAnimationFrame(animationFrame);
  render();
  announcement.textContent = 'Navigerte videre. Statusmeldingen ble fjernet.';
});
document.addEventListener('keydown', (event) => {
  if (['INPUT', 'TEXTAREA'].includes(event.target.tagName) || event.target.isContentEditable) return;
  if (event.key === 'ArrowLeft') cycle(-1);
  if (event.key === 'ArrowRight') cycle(1);
});

restartTimer();
