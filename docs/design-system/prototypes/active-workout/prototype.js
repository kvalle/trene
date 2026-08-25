const screen = document.querySelector('#screen');
const dialogLayer = document.querySelector('#dialog-layer');
const keyboard = document.querySelector('#keyboard');
let scenario = 'dense';
let keyboardOpen = false;

const scenarioCopy = {
  dense: ['Full treningsøkt', 'Flere øvelser, utvidede og kollapsede kort, og planlagte sett.'],
  empty: ['Tom treningsøkt', 'Startpunktet når øvelser ikke er lagt til ennå.'],
  error: ['Lagringsfeil', 'Feilen er knyttet til det planlagte settet i Benkpress.'],
  busy: ['Lokal lagring', 'Lagringen vises på den berørte sett-handlingen i Benkpress.'],
  large: ['Stor tekst', 'Samme tette innhold med stor systemtekst og stablede sett-handlinger.'],
};

function button(label, kind, action = '') { return `<button class="button ${kind}" ${action ? `data-action="${action}"` : ''} type="button">${label}</button>`; }
function exercise(name, summary, open, options = {}) {
  const rows = options.rows || '';
  const status = options.error ? '<aside class="set-feedback failure" role="alert"><h2>Kunne ikke lagre sett 3</h2><p>Settet er fortsatt planlagt. Prøv igjen når du er klar.</p></aside>' : '';
  const confirm = options.busy ? '<button class="button primary busy" type="button" disabled><span class="spinner"></span>Lagrer</button>' : '<button class="button primary" data-action="confirm" type="button">Bekreft</button>';
  const planned = options.planned ? `<section class="form-section"><div class="form-heading"><b>Planlagt sett</b><span>Sett 3</span></div><div class="fields"><label class="field"><span>Belastning (kg)</span><input inputmode="decimal" value="80"></label><label class="field"><span>Repetisjoner</span><input inputmode="numeric" value="8"></label></div>${status}<div class="set-actions"><button class="button secondary" data-action="delete-planned" type="button">Fjern plan</button>${confirm}</div><button class="compact-action add-set" data-action="add-set" type="button">+ Legg til sett</button></section>` : '';
  return `<article class="card"><button class="exercise-header" data-action="toggle" type="button" aria-expanded="${open}"><span><b>${name}</b><small>${summary}</small></span><span class="disclosure">${open ? '-' : '+'}</span></button><div class="exercise-content"${open ? '' : ' hidden'}>${rows}${planned}<button class="compact-action remove-exercise" data-action="remove-exercise" type="button">Fjern øvelse</button></div></article>`;
}
function setRow(number, value, confirmed = true) { return `<div class="set-row"><span><b>Sett ${number}</b><small>${value}</small></span><span>${confirmed ? '<span class="confirmed">Bekreftet</span>' : '<button class="compact-action" data-action="edit" type="button">Rediger</button>'}</span></div>`; }
function dense() {
  return `<p class="workout-meta">Tirsdag 25. august - startet 09:12</p>${exercise('Benkpress', '2 av 3 sett gjennomført', true, { rows: setRow(1, '80 kg - 8 repetisjoner') + setRow(2, '80 kg - 8 repetisjoner'), planned: true })}${exercise('Knebøy', '0 av 3 sett gjennomført', false)}${exercise('Sittende roing', '1 av 3 sett gjennomført', false)}<div class="workout-actions">${button('Legg til øvelse', 'secondary', 'add')}${button('Fullfør økt', 'primary', 'complete')}${button('Avbryt økt', 'text', 'cancel')}</div>`;
}
function empty() { return `<section class="empty"><h2>Hva vil du trene?</h2><p>Legg til den første øvelsen for å starte registreringen av sett.</p>${button('Legg til øvelse', 'primary', 'add')}<button class="compact-action" data-action="cancel" type="button">Avbryt økt</button></section>`; }
function error() { return `<p class="workout-meta">Tirsdag 25. august - startet 09:12</p>${exercise('Benkpress', '2 av 3 sett gjennomført', true, { rows: setRow(1, '80 kg - 8 repetisjoner') + setRow(2, '80 kg - 8 repetisjoner'), planned: true, error: true })}${exercise('Knebøy', '0 av 3 sett gjennomført', false)}<div class="workout-actions">${button('Legg til øvelse', 'secondary', 'add')}${button('Fullfør økt', 'primary', 'complete')}${button('Avbryt økt', 'text', 'cancel')}</div>`; }
function busy() { return `<p class="workout-meta">Tirsdag 25. august - startet 09:12</p>${exercise('Benkpress', '2 av 3 sett gjennomført', true, { rows: setRow(1, '80 kg - 8 repetisjoner') + setRow(2, '80 kg - 8 repetisjoner'), planned: true, busy: true })}${exercise('Knebøy', '0 av 3 sett gjennomført', false)}<div class="workout-actions">${button('Legg til øvelse', 'secondary', 'add')}${button('Fullfør økt', 'primary', 'complete')}${button('Avbryt økt', 'text', 'cancel')}</div>`; }
function render() {
  const [title, description] = scenarioCopy[scenario];
  document.querySelector('#scenario-title').textContent = title;
  document.querySelector('#scenario-description').textContent = description;
  screen.classList.toggle('large-text', scenario === 'large');
  screen.innerHTML = scenario === 'empty' ? empty() : scenario === 'error' ? error() : scenario === 'busy' ? busy() : dense();
  bindActions();
}
function showDialog(kind) {
  const dialogs = {
    complete: ['Fullfør økten?', 'To øvelser har planlagte sett som ikke blir med i historikken.', 'Fortsett økten', 'Fullfør økt', 'primary'],
    cancel: ['Avbryt treningsøkten?', 'Alle registrerte sett i denne økten slettes. Dette kan ikke angres.', 'Fortsett økten', 'Avbryt og slett', 'danger'],
    add: ['Legg til øvelse', 'Øvelsesvelgeren er utenfor denne prototypen. Handlingen er plassert her for å vurdere øktens hierarki.', 'Avbryt', 'Vis valg', 'primary'],
    'delete-planned': ['Fjern planlagt sett?', 'Det planlagte settet er ikke bekreftet og fjernes fra denne øvelsen.', 'Behold plan', 'Fjern plan', 'secondary'],
    'remove-exercise': ['Fjern øvelse fra økten?', 'Øvelsen og settene i denne pågående økten fjernes. Historikken endres ikke.', 'Behold øvelse', 'Fjern øvelse', 'danger'],
  };
  const [title, copy, safe, confirm, kindClass] = dialogs[kind];
  dialogLayer.innerHTML = `<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">${title}</h2><p class="${kind === 'cancel' ? 'danger-copy' : ''}">${copy}</p><div class="dialog-actions">${button(safe, 'secondary', 'close-dialog')}${button(confirm, kindClass, 'close-dialog')}</div></section>`;
  dialogLayer.hidden = false;
  dialogLayer.querySelectorAll('[data-action="close-dialog"]').forEach((item) => item.addEventListener('click', closeDialog));
}
function closeDialog() { dialogLayer.hidden = true; }
function bindActions() {
  screen.querySelectorAll('[data-action]').forEach((item) => item.addEventListener('click', () => {
    const action = item.dataset.action;
    if (['complete', 'cancel', 'add', 'delete-planned', 'remove-exercise'].includes(action)) showDialog(action);
    if (action === 'retry') { scenario = 'busy'; updateScenarioButtons(); render(); }
    if (action === 'confirm') { item.textContent = 'Bekreftet'; item.disabled = true; }
    if (action === 'toggle') { const expanded = item.getAttribute('aria-expanded') !== 'true'; item.setAttribute('aria-expanded', expanded); item.querySelector('.disclosure').textContent = expanded ? '-' : '+'; item.closest('.card').querySelector('.exercise-content').hidden = !expanded; }
  }));
}
function updateScenarioButtons() { document.querySelectorAll('.scenario').forEach((button) => button.classList.toggle('active', button.dataset.scenario === scenario)); }
document.querySelectorAll('.scenario').forEach((button) => button.addEventListener('click', () => { scenario = button.dataset.scenario; updateScenarioButtons(); render(); }));
document.querySelector('#theme-toggle').addEventListener('click', (event) => { const dark = document.documentElement.dataset.theme === 'dark'; document.documentElement.dataset.theme = dark ? 'light' : 'dark'; event.currentTarget.textContent = dark ? 'Mørk modus' : 'Lys modus'; });
document.querySelector('#keyboard-toggle').addEventListener('click', (event) => { keyboardOpen = !keyboardOpen; keyboard.hidden = !keyboardOpen; event.currentTarget.textContent = keyboardOpen ? 'Skjul tastatur' : 'Vis tastatur'; });
document.querySelectorAll('[data-dialog]').forEach((button) => button.addEventListener('click', () => showDialog(button.dataset.dialog)));
render();
