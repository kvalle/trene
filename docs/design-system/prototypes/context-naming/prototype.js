// PROTOTYPE – kastes etter beslutning. Viser samme skjermbilder med ulike begreper.
// g: grammatisk kjønn for «Ny/Nytt» og «en/et». first: generisk navn på den første.
const TERMS = {
  variant: { sg: 'variant', def: 'varianten', pl: 'varianter', g: 'm', first: 'Standard', note: 'Kort og nøytralt, men sier ikke variant av hva.' },
  modus: { sg: 'modus', def: 'modusen', pl: 'moduser', g: 'm', first: 'Standard', note: 'Som en innstilling appen står i: «fysiomodus», «senter-modus». Kan høres teknisk ut.' },
  kontekst: { sg: 'kontekst', def: 'konteksten', pl: 'kontekster', g: 'm', first: 'Standard', note: 'Beskriver situasjonen du trener i. Abstrakt og litt faglig.' },
  tråd: { sg: 'tråd', def: 'tråden', pl: 'tråder', g: 'm', first: 'Hovedtråd', note: 'Hver tråd fortsetter der den slapp sist. Uvanlig i treningssammenheng.' },
  opplegg: { sg: 'opplegg', def: 'opplegget', pl: 'opplegg', g: 'n', first: 'Mitt opplegg', note: 'Hverdagslig. «Fysioopplegget mitt.» Kan høres planlagt ut.' },
  rutine: { sg: 'rutine', def: 'rutinen', pl: 'rutiner', g: 'm', first: 'Min rutine', note: 'Nåværende arbeidsnavn, med som referanse.' },
};
const KEYS = Object.keys(TERMS);
const variant = () => { const v = new URLSearchParams(location.search).get('variant'); return KEYS.includes(v) ? v : KEYS[0]; };
function setVariant(v) { const u = new URL(location); u.searchParams.set('variant', v); history.replaceState(null, '', u); render(); }
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function phone(caption, title, body, overlay = '') {
  return `<div class="shot"><span class="caption">${caption}</span><div class="phone">
    <div class="status-bar"><span>09:41</span><span>●●● ▮</span></div>
    <header class="app-header"><span class="back-button">${title === 'Trene' ? '' : '‹'}</span><h3>${title}</h3><span></span></header>
    <div class="screen">${body}</div>${overlay ? `<div class="scrim inline"><div class="dialog">${overlay}</div></div>` : ''}</div></div>`;
}

function render() {
  const k = variant(); const t = TERMS[k];
  const ny = t.g === 'n' ? 'Nytt' : 'Ny';
  const en = t.g === 'n' ? 'et' : 'en';
  const den = t.g === 'n' ? 'det' : 'den';
  const Sg = cap(t.sg), Pl = cap(t.pl), Def = cap(t.def);
  const row = (n, sub) => `<div class="nav-row"><span>${n}${sub ? `<span class="sub">${sub}</span>` : ''}</span><span class="chev">›</span></div>`;

  document.getElementById('headline').textContent = `«${Sg}» · ${t.pl} · ${ny.toLowerCase()} ${t.sg}`;
  document.getElementById('note').textContent = t.note;
  document.getElementById('variant-label').textContent = `${KEYS.indexOf(k) + 1}/${KEYS.length}: ${t.sg}`;
  document.getElementById('terms').innerHTML = KEYS.map((x) => `<button class="control ${x === k ? 'on' : ''}" onclick="setVariant('${x}')">${x}</button>`).join('');

  const home = `<h1 class="screen-title">Klar for en trening?</h1><p class="body">Registrer øvelser og sett mens du trener.</p>
    <button class="btn primary">Start trening</button><button class="btn secondary">Tidligere treninger</button>
    <button class="btn secondary">Øvelser</button><button class="btn secondary">${Pl}</button><button class="btn secondary">Innstillinger</button>`;

  const pick = `<h2>Hva skal du trene?</h2><div class="list">${row('Fysio')}${row('Treningssenter')}<div class="nav-row add">+ ${ny} ${t.sg}…</div></div>
    <div class="actions"><button class="btn text">Avbryt</button></div>`;

  const create = `<h2>${ny} ${t.sg}</h2><p class="meta">Treningen starter uten øvelser. Det du gjør nå, fylles ut automatisk neste gang du velger ${t.def}.</p>
    <label class="field-label">Navn</label><input type="text" placeholder=""><div class="err"></div>
    <p class="meta">Du kan også gi «${t.first}» et mer beskrivende navn under ${Pl}.</p>
    <div class="actions"><button class="btn text">Avbryt</button><button class="btn primary">Opprett og start</button></div>`;

  const workout = `<p class="meta">${Sg}: <b>Treningssenter</b></p><div class="notice"><b>${ny} ${t.sg}: Treningssenter</b>Legg til øvelsene du gjør i ${t.def}. Neste gang du starter «Treningssenter», er øvelsene og settene fylt ut på forhånd.</div>
    <button class="btn secondary">Legg til øvelse</button><button class="btn primary">Ferdig</button>`;

  const listOne = `<p class="body">Trener du på flere måter, for eksempel med fysioøvelser hjemme og styrke på treningssenteret? Lag ${en} ${t.sg} for hver, så husker appen øvelsene hver for seg.</p>
    <div class="list">${row(t.first, '42 treninger')}</div><button class="btn secondary">${ny} ${t.sg}</button>`;

  const list = `<div class="list">${row('Fysio', '24 treninger')}${row('Treningssenter', '6 treninger')}</div><button class="btn secondary">${ny} ${t.sg}</button>
    <div class="section-title">Arkivert</div><div class="list">${row('Hytta', '2 treninger')}</div>`;

  const detail = `<h1 class="screen-title">Hytta</h1><p class="meta"><span class="badge">Arkivert</span> 2 treninger</p>
    <div class="section-title">Arkivert</div><p class="meta">${Def} vises ikke når du starter en trening. Aktiver ${den} for å kunne velge ${den} igjen. Historikken er beholdt.</p>
    <button class="btn secondary">Aktiver ${t.sg}</button>
    <div class="section-title">Slett</div><p class="meta">${Def} har treninger i historikken og kan ikke slettes. Du kan arkivere ${den} i stedet.</p>
    <button class="btn destructive" disabled>Slett ${t.sg}</button>`;

  const box = (on, n, c) => `<div class="check-row ${on ? 'on' : ''}"><span class="box">${on ? '✓' : ''}</span><span class="name">${n}</span><span class="count">${c}</span></div>`;
  const historyBody = `<div class="card open"><div class="card-head"><div class="t"><b>Filter</b><span>Viser kun Fysio og Treningssenter</span></div><span class="caret">▾</span></div>
    <div class="card-body">${box(true, 'Fysio', 24)}${box(true, 'Treningssenter', 6)}${box(false, 'Hytta <span class="badge">Arkivert</span>', 2)}<div class="filter-actions"><button>Vis alle</button></div></div></div>
    <div class="card"><div class="card-head"><div class="t"><b>November 2026</b><span>9 treninger</span></div><span class="caret">▾</span></div></div>
    <p class="meta">Lukket med alle valgt: «Viser alle ${t.pl}». For langt: «Viser 4 valgte ${t.pl}».</p>`;

  document.getElementById('gallery').innerHTML = [
    phone('Forsiden', 'Trene', home),
    phone('Start trening (flere)', 'Trene', home, pick),
    phone(`${ny} ${t.sg} fra start`, 'Trene', home, create),
    phone(`Første trening i ${ny.toLowerCase()} ${t.sg}`, 'Treningsøkt', workout),
    phone(`${Pl}, bare én`, Pl, listOne),
    phone(`${Pl}, flere`, Pl, list),
    phone(`Arkivert ${t.sg}`, Sg, detail),
    phone('Historikkfilter', 'Tidligere treninger', historyBody),
  ].join('');
}

document.getElementById('prev').onclick = () => setVariant(KEYS[(KEYS.indexOf(variant()) + KEYS.length - 1) % KEYS.length]);
document.getElementById('next').onclick = () => setVariant(KEYS[(KEYS.indexOf(variant()) + 1) % KEYS.length]);
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input,textarea')) return;
  if (e.key === 'ArrowLeft') document.getElementById('prev').click();
  if (e.key === 'ArrowRight') document.getElementById('next').click();
});
render();
