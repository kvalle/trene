const variants = {
  a: {
    label: 'A · Før innholdet',
    description: 'Statusen kommer først i leserekkefølgen, rett under app-headeren.',
  },
  b: {
    label: 'B · Ved handlingene',
    description: 'Statusen plasseres mellom introduksjonen og handlingene den gir kontekst til.',
  },
  c: {
    label: 'C · Fast nederst',
    description: 'Statusen ligger over skjermens nedre kant og forblir synlig mens innholdet ruller.',
  },
};

const keys = Object.keys(variants);
const params = new URLSearchParams(window.location.search);
let current = variants[params.get('variant')] ? params.get('variant') : 'a';
let visible = true;
let largeText = false;

const screen = document.querySelector('#screen');
const announcement = document.querySelector('#announcement');
const title = document.querySelector('#variant-title');
const description = document.querySelector('#variant-description');
const switcherLabel = document.querySelector('#switcher-label');

function statusMarkup() {
  if (!visible) return '';
  return `
    <section class="positive-status" role="status" aria-live="polite" aria-atomic="true">
      <span class="icon" aria-hidden="true">✓</span>
      <p>Alle treningsdata er slettet.</p>
      <button class="dismiss" type="button" aria-label="Lukk statusmelding">×</button>
    </section>`;
}

function homeMarkup() {
  const status = statusMarkup();
  const hero = `
    <section class="hero">
      <h2>Klar for en økt?</h2>
      <p>Registrer øvelser og sett mens du trener.</p>
    </section>`;
  const actions = `
    <section class="actions">
      <button class="button primary" type="button">Start økt</button>
      <button class="button" type="button">Tidligere økter</button>
      <button class="button" type="button">Øvelser</button>
      <button class="button" type="button">Innstillinger</button>
    </section>`;

  if (current === 'a') return `${status}${hero}${actions}`;
  if (current === 'b') return `${hero}${status}${actions}`;
  return `${hero}${actions}${status}`;
}

function render({ announce = false } = {}) {
  const variant = variants[current];
  screen.className = `screen variant-${current}${largeText ? ' large-text' : ''}`;
  screen.innerHTML = homeMarkup();
  title.textContent = variant.label;
  description.textContent = variant.description;
  switcherLabel.textContent = variant.label;
  document.querySelectorAll('[data-variant]').forEach((button) => {
    button.classList.toggle('active', button.dataset.variant === current);
  });
  document.querySelector('.dismiss')?.addEventListener('click', () => {
    visible = false;
    render();
  });
  if (announce && visible) {
    announcement.textContent = '';
    window.setTimeout(() => { announcement.textContent = 'Alle treningsdata er slettet.'; }, 20);
  }
}

function chooseVariant(key) {
  current = key;
  visible = true;
  const url = new URL(window.location);
  url.searchParams.set('variant', current);
  window.history.replaceState({}, '', url);
  render({ announce: true });
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
  visible = true;
  render({ announce: true });
});
document.querySelector('#navigate').addEventListener('click', () => {
  visible = false;
  render();
  announcement.textContent = 'Navigerte videre. Statusmeldingen ble fjernet.';
});
document.addEventListener('keydown', (event) => {
  if (['INPUT', 'TEXTAREA'].includes(event.target.tagName) || event.target.isContentEditable) return;
  if (event.key === 'ArrowLeft') cycle(-1);
  if (event.key === 'ArrowRight') cycle(1);
});

render({ announce: true });
