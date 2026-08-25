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
function compactAction(icon, label, action, extra = '') { return `<button class="compact-action ${extra}" data-action="${action}" type="button"><span aria-hidden="true">${icon}</span>${label}</button>`; }
function plannedSet(number, status = '', busy = false) {
  const complete = busy ? '<button class="button primary busy" type="button" disabled><span class="spinner"></span>Lagrer</button>' : '<button class="button primary" data-action="complete-set" type="button">Utført</button>';
  return `<section class="form-section" data-set-number="${number}"><div class="form-heading"><b>Planlagt sett</b><span>Sett ${number}</span></div><div class="fields"><label class="field"><span>Belastning (kg)</span><input inputmode="decimal" value="80"></label><label class="field"><span>Repetisjoner</span><input inputmode="numeric" value="8"></label></div>${status}<div class="set-actions">${compactAction('×', 'Fjern sett', 'delete-planned', 'remove-set')}${complete}</div></section>`;
}
function exercise(name, summary, open, options = {}) {
  const rows = options.rows || '';
  const status = options.error ? '<aside class="set-feedback failure" role="alert"><h2>Kunne ikke lagre sett 3</h2><p>Settet er fortsatt planlagt. Prøv igjen når du er klar.</p></aside>' : '';
  const plannedCount = options.planned || 0;
  const planned = Array.from({ length: plannedCount }, (_, index) => plannedSet(index + 3, index === 0 ? status : '', options.busy && index === 0)).join('');
  return `<article class="card"><button class="exercise-header" data-action="toggle" type="button" aria-expanded="${open}"><span><b>${name}</b><small>${summary}</small></span><span class="disclosure">${open ? '-' : '+'}</span></button><div class="exercise-content"${open ? '' : ' hidden'}><div class="exercise-toolbar">${compactAction('×', 'Fjern øvelse', 'remove-exercise', 'remove-exercise')}</div>${rows}${planned}<div class="add-set-row">${compactAction('+', 'Legg til sett', 'add-set', 'add-set')}</div></div></article>`;
}
function setRow(number, value) { return `<div class="set-row" data-set-number="${number}"><span><b>Sett ${number}</b><small>${value}</small></span>${compactAction('✎', 'Endre', 'edit-set')}</div>`; }
function dense() {
  return `<p class="workout-meta">Tirsdag 25. august - startet 09:12</p>${exercise('Benkpress', '2 sett utført, 2 planlagt', true, { rows: setRow(1, '80 kg - 8 repetisjoner') + setRow(2, '80 kg - 8 repetisjoner'), planned: 2 })}${exercise('Knebøy', '0 av 3 sett gjennomført', false)}${exercise('Sittende roing', '1 av 3 sett gjennomført', false)}<div class="workout-actions">${button('Legg til øvelse', 'secondary', 'add')}${button('Fullfør økt', 'primary', 'complete')}${button('Avbryt økt', 'text', 'cancel')}</div>`;
}
function empty() { return `<section class="empty"><h2>Hva vil du trene?</h2><p>Legg til den første øvelsen for å starte registreringen av sett.</p>${button('Legg til øvelse', 'primary', 'add')}${compactAction('×', 'Avbryt økt', 'cancel')}</section>`; }
function home() { return `<section class="home"><p class="workout-meta">Pågående treningsøkt</p><h2>Fortsett der du slapp</h2><p>2 sett utført, 2 planlagt. Startet 09:12.</p>${button('Fortsett økt', 'primary', 'continue-workout')}${button('Start ny økt', 'secondary', 'new-workout')}</section>`; }
function error() { return `<p class="workout-meta">Tirsdag 25. august - startet 09:12</p>${exercise('Benkpress', '2 sett utført, 1 planlagt', true, { rows: setRow(1, '80 kg - 8 repetisjoner') + setRow(2, '80 kg - 8 repetisjoner'), planned: 1, error: true })}${exercise('Knebøy', '0 av 3 sett gjennomført', false)}<div class="workout-actions">${button('Legg til øvelse', 'secondary', 'add')}${button('Fullfør økt', 'primary', 'complete')}${button('Avbryt økt', 'text', 'cancel')}</div>`; }
function busy() { return `<p class="workout-meta">Tirsdag 25. august - startet 09:12</p>${exercise('Benkpress', '2 sett utført, 1 planlagt', true, { rows: setRow(1, '80 kg - 8 repetisjoner') + setRow(2, '80 kg - 8 repetisjoner'), planned: 1, busy: true })}${exercise('Knebøy', '0 av 3 sett gjennomført', false)}<div class="workout-actions">${button('Legg til øvelse', 'secondary', 'add')}${button('Fullfør økt', 'primary', 'complete')}${button('Avbryt økt', 'text', 'cancel')}</div>`; }
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
    if (['complete', 'cancel', 'add', 'remove-exercise'].includes(action)) showDialog(action);
    if (action === 'retry') { scenario = 'busy'; updateScenarioButtons(); render(); }
    if (action === 'complete-set') { const form = item.closest('.form-section'); form.outerHTML = setRow(form.dataset.setNumber, '80 kg - 8 repetisjoner'); bindActions(); }
    if (action === 'edit-set') { const row = item.closest('.set-row'); row.outerHTML = plannedSet(row.dataset.setNumber); bindActions(); }
    if (action === 'add-set') { const content = item.closest('.exercise-content'); const count = content.querySelectorAll('[data-set-number]').length + 1; item.closest('.add-set-row').insertAdjacentHTML('beforebegin', plannedSet(count)); bindActions(); }
    if (action === 'delete-planned') { item.closest('.form-section').remove(); renumberSets(item.closest('.exercise-content')); }
    if (action === 'back') { screen.classList.remove('large-text'); screen.innerHTML = home(); bindActions(); }
    if (action === 'continue-workout') { render(); }
    if (action === 'toggle') { const expanded = item.getAttribute('aria-expanded') !== 'true'; item.setAttribute('aria-expanded', expanded); item.querySelector('.disclosure').textContent = expanded ? '-' : '+'; item.closest('.card').querySelector('.exercise-content').hidden = !expanded; }
  }));
}
function renumberSets(content) {
  content.querySelectorAll('[data-set-number]').forEach((set, index) => {
    const number = index + 1;
    set.dataset.setNumber = number;
    const rowTitle = set.querySelector('.set-row b');
    if (rowTitle) rowTitle.textContent = `Sett ${number}`;
    const numberLabel = set.querySelector('.form-heading span');
    if (numberLabel) numberLabel.textContent = `Sett ${number}`;
  });
}
function updateScenarioButtons() { document.querySelectorAll('.scenario').forEach((button) => button.classList.toggle('active', button.dataset.scenario === scenario)); }
document.querySelectorAll('.scenario').forEach((button) => button.addEventListener('click', () => { scenario = button.dataset.scenario; updateScenarioButtons(); render(); }));
document.querySelector('#theme-toggle').addEventListener('click', (event) => { const dark = document.documentElement.dataset.theme === 'dark'; document.documentElement.dataset.theme = dark ? 'light' : 'dark'; event.currentTarget.textContent = dark ? 'Mørk modus' : 'Lys modus'; });
document.querySelector('#keyboard-toggle').addEventListener('click', (event) => { keyboardOpen = !keyboardOpen; keyboard.hidden = !keyboardOpen; event.currentTarget.textContent = keyboardOpen ? 'Skjul tastatur' : 'Vis tastatur'; });
document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => { if (button.dataset.action === 'back') { screen.innerHTML = home(); bindActions(); } }));
render();
