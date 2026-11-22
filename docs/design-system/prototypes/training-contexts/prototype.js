// PROTOTYPE – kastes etter beslutning. All tilstand i minnet.
const VARIANTS = {
  D: { name: 'Samlet løsning', description: 'D: Kortet heter «Filter» og har avkrysningsbokser foran, som i A og C. Minst én kontekst må være valgt, så den siste valgte er låst. «Vis alle» vises når ikke alle er valgt. Undertittelen bruker samme stil som månedene: «Viser alle kontekster» eller «Viser kun Fysio og Treningssenter». Valget huskes.' },
  A: { name: 'Avkrysning, minst én', description: 'A: Et sammenleggbart kort «Kontekster» øverst, som fungerer som månedene. Utvidet viser det en liste med avkrysningsbokser foran. Den siste avkryssede konteksten kan ikke fjernes, så listen blir aldri tom. Mønsteret er som filterseksjoner i mobilnettbutikker (NN/g).' },
  B: { name: 'Hake til høyre, som iOS Kalender', description: 'B: Samme kort, men en hake til høyre markerer valgte kontekster, slik iOS Kalender viser og skjuler kalendere. Kortet har handlingene «Vis alle» og «Skjul alle». Fjerner du alle hakene, vises en tom tilstand.' },
  C: { name: 'Avkrysning og aktive filtre', description: 'C: Som A, men når kortet er lukket og filteret er aktivt, vises de valgte kontekstene som etiketter under tittelen. Kortet har også «Vis alle». Det følger rådet om å alltid vise hvilke filtre som er aktive.' },
};
const KEYS = Object.keys(VARIANTS);
// Lengre oppsummering enn dette erstattes av «Viser N valgte kontekster».
const MAX_SUMMARY = 40;
const SCENARIOS = {
  fresh: 'Ny bruker (ingen treninger)',
  one: 'Én kontekst (dagens brukere)',
  many: 'Flere kontekster',
};

const TODAY = new Date(2026, 10, 21);
const day = (m, d) => new Date(2026, m - 1, d);
var S;

function seed(scenario) {
  const routines = {
    fresh: [{ id: 1, name: 'Standard', archived: false, ex: [] }],
    one: [{ id: 1, name: 'Standard', archived: false, ex: ['Utadrotasjon', 'Håndleddsfleksjon', 'Skulderpress'] }],
    many: [
      { id: 1, name: 'Fysio', archived: false, ex: ['Utadrotasjon', 'Håndleddsfleksjon', 'Skulderpress'] },
      { id: 2, name: 'Treningssenter', archived: false, ex: ['Beinpress', 'Nedtrekk', 'Brystpress'] },
      { id: 3, name: 'Hytta', archived: true, ex: ['Knebøy', 'Armhevinger'] },
    ],
  }[scenario];
  const workouts = [];
  if (scenario === 'one') [3, 5, 8, 10, 12, 15, 17, 19].forEach((d) => workouts.push({ r: 1, at: day(11, d) }));
  if (scenario === 'one') [6, 9, 14, 21, 28].forEach((d) => workouts.push({ r: 1, at: day(10, d) }));
  if (scenario === 'many') {
    [3, 5, 10, 12, 17, 20].forEach((d) => workouts.push({ r: 1, at: day(11, d) }));
    [4, 11, 18].forEach((d) => workouts.push({ r: 2, at: day(11, d) }));
    [7, 14, 21, 28].forEach((d) => workouts.push({ r: 1, at: day(10, d) }));
    [9, 23].forEach((d) => workouts.push({ r: 2, at: day(10, d) }));
    [25, 26].forEach((d) => workouts.push({ r: 3, at: day(10, d) }));
  }
  S = { scenario, routines, workouts, stack: ['home'], dialog: null, active: null, selected: null, filterOpen: false, openMonths: new Set(['2026-11']), sel: null, toast: null, nextId: 10 };
}

const variant = () => { const v = new URLSearchParams(location.search).get('variant'); return KEYS.includes(v) ? v : 'D'; };
function setVariant(v) { const u = new URL(location); u.searchParams.set('variant', v); history.replaceState(null, '', u); render(); }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const R = (id) => S.routines.find((r) => r.id === id);
const countFor = (id) => S.workouts.filter((w) => w.r === id).length;
const lastFor = (id) => Math.max(0, ...S.workouts.filter((w) => w.r === id).map((w) => +w.at));
const activeRoutines = () => S.routines.filter((r) => !r.archived).sort((a, b) => lastFor(b.id) - lastFor(a.id));
const withHistory = () => S.routines.filter((r) => countFor(r.id) > 0);
function selected() { return S.selected ?? new Set(withHistory().map((r) => r.id)); }
const filterActive = () => selected().size < withHistory().length;

function go(s) { S.stack.push(s); S.dialog = null; render(); }
function back() { if (S.stack.length > 1) S.stack.pop(); S.dialog = null; render(); }
function openDialog(d) { S.dialog = d; render(); }
function toast(m) { S.toast = m; render(); setTimeout(() => { S.toast = null; render(); }, 2500); }

// ---------- handlinger ----------
function startPressed() {
  if (S.active) return go('workout');
  const a = activeRoutines();
  if (a.length === 1) startWorkout(a[0].id); else openDialog({ t: 'pick' });
}
function startWorkout(id) {
  const r = R(id);
  S.active = { r: id, ex: r.ex.slice(), fresh: r.ex.length === 0, firstEver: S.workouts.length === 0 };
  S.dialog = null; S.stack = ['home', 'workout']; render();
}
function finishWorkout() {
  const r = R(S.active.r);
  if (S.active.ex.length === 0) S.active.ex = ['Øvelse lagt til i prototypen'];
  r.ex = S.active.ex; S.workouts.push({ r: r.id, at: TODAY }); S.active = null; S.stack = ['home'];
  toast('Treningen er fullført.');
}
function validName(name, exceptId) {
  const n = name.trim();
  if (!n) return 'Skriv inn et navn.';
  if (S.routines.some((r) => r.id !== exceptId && r.name.toLowerCase() === n.toLowerCase())) return 'Det finnes allerede en kontekst med dette navnet.';
  return null;
}
function createRoutine(from) {
  const input = document.getElementById('new-name');
  const e = validName(input.value);
  if (e) { document.getElementById('new-err').textContent = e; return; }
  const r = { id: S.nextId++, name: input.value.trim(), archived: false, ex: [] };
  S.routines.push(r);
  if (from === 'start') startWorkout(r.id); else { S.dialog = null; toast('Konteksten er opprettet.'); }
}
function rename(id) {
  const input = document.getElementById('rename');
  const e = validName(input.value, id);
  if (e) { document.getElementById('rename-err').textContent = e; return; }
  R(id).name = input.value.trim(); toast('Navnet er lagret.');
}
function setArchived(id, value) { R(id).archived = value; S.dialog = null; toast(value ? 'Konteksten er arkivert.' : 'Konteksten er aktivert.'); }
function deleteRoutine(id) { S.routines = S.routines.filter((r) => r.id !== id); S.stack.pop(); S.dialog = null; toast('Konteksten er slettet.'); }
function toggleFilter(id) {
  const s = new Set(selected());
  if (s.has(id)) { if (variant() !== 'B') { if (s.size === 1) return; } s.delete(id); } else s.add(id);
  S.selected = s; render();
}
function setAll(on) { S.selected = on ? null : new Set(); render(); }
function toggleMonth(k) { S.openMonths.has(k) ? S.openMonths.delete(k) : S.openMonths.add(k); render(); }

// ---------- skjermer ----------
const screens = {
  home: () => ({ title: 'Trene', html: `
    <h1 class="screen-title">Klar for en trening?</h1>
    <p class="body">Registrer øvelser og sett mens du trener.</p>
    <button class="btn primary" onclick="startPressed()">${S.active ? 'Fortsett trening' : 'Start trening'}</button>
    <button class="btn secondary" onclick="go('history')">Tidligere treninger</button>
    <button class="btn secondary" onclick="go('exercises')">Øvelser</button>
    <button class="btn secondary" onclick="go('routines')">Kontekster</button>
    <button class="btn secondary" onclick="go('settings')">Innstillinger</button>` }),

  workout: () => {
    const a = S.active; const r = R(a.r); const many = S.routines.length > 1;
    let notice = '';
    if (a.fresh && a.firstEver) notice = `<div class="notice"><b>Første trening</b>Legg til øvelsene du gjør. Neste gang du starter en trening, er øvelsene og settene fylt ut på forhånd.</div>`;
    else if (a.fresh) notice = `<div class="notice"><b>Ny kontekst: ${esc(r.name)}</b>Legg til øvelsene du gjør i denne konteksten. Neste gang du starter «${esc(r.name)}», er øvelsene og settene fylt ut på forhånd.</div>`;
    return { title: 'Treningsøkt', html: `
      ${many ? `<p class="meta">Kontekst: <b>${esc(r.name)}</b></p>` : ''}
      ${notice}
      ${a.ex.map((e) => `<div class="ex-card"><b>${esc(e)}</b><p class="meta" style="margin:2px 0 0">0 av 3 sett gjennomført</p></div>`).join('')}
      <button class="btn secondary">Legg til øvelse</button>
      <button class="btn primary" onclick="finishWorkout()">Ferdig</button>
      <button class="btn text" onclick="openDialog({t:'abort'})">Avbryt</button>` };
  },

  routines: () => {
    const act = S.routines.filter((r) => !r.archived); const arch = S.routines.filter((r) => r.archived);
    return { title: 'Kontekster', html: `
      ${S.routines.length === 1 ? `<p class="body">Trener du på flere måter, for eksempel med fysioøvelser hjemme og styrke på treningssenteret? Lag en kontekst for hver, så husker appen øvelsene hver for seg.</p>` : ''}
      <div class="list">${act.map(routineRow).join('')}</div>
      <button class="btn secondary" onclick="openDialog({t:'new',from:'routines'})">Ny kontekst</button>
      ${arch.length ? `<div class="section-title">Arkivert</div><div class="list">${arch.map(routineRow).join('')}</div>` : ''}` };
  },

  routine: () => {
    const r = R(S.sel); const n = countFor(r.id);
    const inActive = S.active && S.active.r === r.id;
    const lastActive = !r.archived && S.routines.filter((x) => !x.archived).length === 1;
    const canDelete = n === 0 && !inActive;
    return { title: 'Kontekst', html: `
      <h1 class="screen-title">${esc(r.name)}</h1>
      <p class="meta">${r.archived ? '<span class="badge">Arkivert</span> ' : ''}${n} ${n === 1 ? 'trening' : 'treninger'}</p>
      <label class="field-label" for="rename">Navn</label>
      <input type="text" id="rename" value="${esc(r.name)}"><div class="err" id="rename-err"></div>
      <button class="btn secondary" onclick="rename(${r.id})">Lagre navn</button>
      <div class="section-title">Øvelser sist</div>
      ${r.ex.length ? `<ul class="plain-list">${r.ex.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : '<p class="meta">Ingen ennå.</p>'}
      <div class="section-title">${r.archived ? 'Arkivert' : 'Arkivering'}</div>
      ${r.archived
        ? `<p class="meta">Konteksten vises ikke når du starter en trening. Aktiver den for å kunne velge den igjen. Historikken er beholdt.</p>
           <button class="btn secondary" onclick="setArchived(${r.id}, false)">Aktiver kontekst</button>`
        : `<p class="meta">${lastActive ? 'Du må ha minst én aktiv kontekst, så denne kan ikke arkiveres.' : 'Arkiverte kontekster vises ikke når du starter en trening. Historikken beholdes, og du kan aktivere konteksten igjen senere.'}</p>
           <button class="btn secondary" ${lastActive ? 'disabled' : ''} onclick="openDialog({t:'archive',id:${r.id}})">Arkiver kontekst</button>`}
      <div class="section-title">Slett</div>
      <p class="meta">${canDelete ? 'Konteksten har ingen treninger og kan slettes.' : inActive ? 'Konteksten brukes i den aktive treningen og kan ikke slettes.' : 'Konteksten har treninger i historikken og kan ikke slettes. Du kan arkivere den i stedet.'}</p>
      <button class="btn destructive" ${canDelete ? '' : 'disabled'} onclick="openDialog({t:'delete',id:${r.id}})">Slett kontekst</button>` };
  },

  history: () => {
    if (!S.workouts.length) return { title: 'Tidligere treninger', html: '<p class="body">Du har ingen fullførte treninger ennå.</p>' };
    const sel = selected();
    const shown = S.workouts.filter((w) => sel.has(w.r));
    const months = [['2026-11', 'November 2026', 11, 6], ['2026-10', 'Oktober 2026', 10, 3]];
    const filter = withHistory().length > 1 ? filterCard() : '';
    const empty = shown.length === 0 ? `<div class="notice"><b>Ingen kontekster valgt</b>Kryss av minst én kontekst for å se treninger.</div>` : '';
    return { title: 'Tidligere treninger', html: filter + empty + (shown.length ? months.map(([k, title, m, lead]) => {
      const days = new Set(shown.filter((w) => w.at.getMonth() + 1 === m).map((w) => w.at.getDate()));
      const open = S.openMonths.has(k); const len = new Date(2026, m, 0).getDate();
      return `<div class="card ${open ? 'open' : ''}"><div class="card-head" onclick="toggleMonth('${k}')"><div class="t"><b>${title}</b><span>${days.size} ${days.size === 1 ? 'trening' : 'treninger'}</span></div><span class="caret">▾</span></div>
        ${open ? `<div class="card-body"><div class="cal-grid">${['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'].map((d) => `<div class="wd">${d}</div>`).join('')}${'<div></div>'.repeat(lead)}${Array.from({ length: len }, (_, i) => `<div class="d ${days.has(i + 1) ? 'w' : ''}">${i + 1}</div>`).join('')}</div></div>` : ''}</div>`;
    }).join('') : '') };
  },

  exercises: () => ({ title: 'Øvelser', html: '<p class="meta">Uendret i denne prototypen.</p>' }),
  settings: () => ({ title: 'Innstillinger', html: '<p class="meta">Uendret. Kontekster administreres fra forsiden.</p>' }),
};

function routineRow(r) {
  const n = countFor(r.id);
  return `<div class="nav-row" onclick="S.sel=${r.id};go('routine')"><span>${esc(r.name)}<span class="sub">${n} ${n === 1 ? 'trening' : 'treninger'}</span></span><span class="chev">›</span></div>`;
}

function filterCard() {
  const v = variant(); const sel = selected(); const hist = withHistory(); const active = filterActive();
  const names = hist.filter((r) => sel.has(r.id)).map((r) => r.name);
  const joined = names.length > 1 ? `${names.slice(0, -1).join(', ')} og ${names[names.length - 1]}` : names[0];
  if (v === 'D') {
    const rowsD = hist.map((r) => {
      const on = sel.has(r.id); const locked = on && sel.size === 1;
      return `<div class="check-row ${on ? 'on' : ''} ${locked ? 'disabled' : ''}" role="checkbox" aria-checked="${on}" aria-disabled="${locked}" onclick="toggleFilter(${r.id})"><span class="box">${on ? '✓' : ''}</span><span class="name">${esc(r.name)}${r.archived ? ' <span class="badge">Arkivert</span>' : ''}</span><span class="count">${countFor(r.id)}</span></div>`;
    }).join('');
    const actionsD = active ? `<div class="filter-actions"><button onclick="setAll(true)">Vis alle</button></div>` : '';
    return `<div class="card ${S.filterOpen ? 'open' : ''}"><div class="card-head" onclick="S.filterOpen=!S.filterOpen;render()"><div class="t"><b>Filter</b><span>${!active ? 'Viser alle kontekster' : `Viser kun ${joined}`.length <= MAX_SUMMARY ? `Viser kun ${esc(joined)}` : `Viser ${names.length} valgte kontekster`}</span></div><span class="caret">▾</span></div>
    ${S.filterOpen ? `<div class="card-body">${rowsD}${actionsD}</div>` : ''}</div>`;
  }
  const summary = !active ? 'Alle vises' : sel.size === 0 ? 'Ingen valgt' : `Viser ${sel.size} av ${hist.length}`;
  const rows = hist.map((r) => {
    const on = sel.has(r.id); const locked = (v !== 'B') && on && sel.size === 1;
    const label = `${esc(r.name)}${r.archived ? ' <span class="badge">Arkivert</span>' : ''}`;
    return v === 'B'
      ? `<div class="check-row ${on ? 'on' : ''}" role="checkbox" aria-checked="${on}" onclick="toggleFilter(${r.id})"><span class="name">${label}</span><span class="count">${countFor(r.id)}</span><span class="tick">${on ? '✓' : ''}</span></div>`
      : `<div class="check-row ${on ? 'on' : ''} ${locked ? 'disabled' : ''}" role="checkbox" aria-checked="${on}" onclick="toggleFilter(${r.id})"><span class="box">${on ? '✓' : ''}</span><span class="name">${label}</span><span class="count">${countFor(r.id)}</span></div>`;
  }).join('');
  const actions = v === 'B'
    ? `<div class="filter-actions"><button onclick="setAll(${!(sel.size === hist.length)})">${sel.size === hist.length ? 'Skjul alle' : 'Vis alle'}</button></div>`
    : v === 'C' && active ? `<div class="filter-actions"><button onclick="setAll(true)">Vis alle</button></div>` : '';
  const chips = v === 'C' && active && !S.filterOpen ? `<div class="chips">${hist.filter((r) => sel.has(r.id)).map((r) => `<span class="chip">${esc(r.name)}</span>`).join('')}</div>` : '';
  return `<div class="card ${S.filterOpen ? 'open' : ''}"><div class="card-head" onclick="S.filterOpen=!S.filterOpen;render()"><div class="t"><b>Kontekster</b><span class="${active ? 'active' : ''}">${summary}</span></div><span class="caret">▾</span></div>
    ${chips}${S.filterOpen ? `<div class="card-body">${rows}${actions}</div>` : ''}</div>`;
}

// ---------- dialoger ----------
const dialogs = {
  pick: () => `<h2>Hva skal du trene?</h2><div class="list">${activeRoutines().map((r) => `<div class="nav-row" onclick="startWorkout(${r.id})"><span>${esc(r.name)}</span><span class="chev">›</span></div>`).join('')}
    <div class="nav-row add" onclick="openDialog({t:'new',from:'start'})">+ Ny kontekst…</div></div>
    <div class="actions"><button class="btn text" onclick="openDialog(null)">Avbryt</button></div>`,
  new: (d) => `<h2>Ny kontekst</h2>
    <p class="meta">${d.from === 'start' ? 'Treningen starter uten øvelser. Det du gjør nå, fylles ut automatisk neste gang du velger konteksten.' : 'Gi konteksten et navn, for eksempel «Treningssenter».'}</p>
    <label class="field-label" for="new-name">Navn</label>
    <input type="text" id="new-name"><div class="err" id="new-err"></div>
    ${S.routines.length === 1 ? `<p class="meta">Du kan også gi «${esc(S.routines[0].name)}» et mer beskrivende navn under Kontekster.</p>` : ''}
    <div class="actions"><button class="btn text" onclick="openDialog(null)">Avbryt</button><button class="btn primary" onclick="createRoutine('${d.from}')">${d.from === 'start' ? 'Opprett og start' : 'Opprett'}</button></div>`,
  archive: (d) => `<h2>Arkivere «${esc(R(d.id).name)}»?</h2><p class="body">Konteksten vises ikke lenger når du starter en trening. Historikken beholdes, og du kan aktivere konteksten igjen.</p>
    <div class="actions"><button class="btn text" onclick="openDialog(null)">Avbryt</button><button class="btn primary" onclick="setArchived(${d.id}, true)">Arkiver</button></div>`,
  delete: (d) => `<h2>Slette «${esc(R(d.id).name)}»?</h2><p class="body">Konteksten slettes permanent.</p>
    <div class="actions"><button class="btn text" onclick="openDialog(null)">Avbryt</button><button class="btn destructive" onclick="deleteRoutine(${d.id})">Slett</button></div>`,
  abort: () => `<h2>Avbryt treningen?</h2><p class="body">Treningen slettes permanent og vises ikke i historikken.</p>
    <div class="actions"><button class="btn text" onclick="openDialog(null)">Fortsett</button><button class="btn destructive" onclick="S.active=null;S.stack=['home'];S.dialog=null;render()">Avbryt treningen</button></div>`,
};

// ---------- rendering ----------
function render() {
  const top = S.stack[S.stack.length - 1];
  const s = screens[top]();
  document.getElementById('screen-title').textContent = s.title;
  document.getElementById('screen').innerHTML = s.html;
  document.getElementById('back').style.visibility = S.stack.length > 1 ? 'visible' : 'hidden';
  document.getElementById('overlay').innerHTML =
    (S.dialog ? `<div class="scrim"><div class="dialog" role="dialog">${dialogs[S.dialog.t](S.dialog)}</div></div>` : '') +
    (S.toast ? `<div class="toast">${esc(S.toast)}</div>` : '');
  const v = variant();
  document.getElementById('variant-label').textContent = `${v} (${VARIANTS[v].name})`;
  document.getElementById('variant-description').textContent = VARIANTS[v].description;
  document.getElementById('scenario-controls').innerHTML = Object.entries(SCENARIOS)
    .map(([k, label]) => `<button class="control ${S.scenario === k ? 'on' : ''}" onclick="seed('${k}');render()">${label}</button>`).join('');
  document.getElementById('state').textContent = JSON.stringify({
    skjerm: top,
    kontekster: S.routines.map((r) => `${r.name}${r.archived ? ' (arkivert)' : ''}: ${countFor(r.id)} treninger`),
    aktivTrening: S.active ? R(S.active.r).name : null,
    filter: withHistory().length > 1 ? withHistory().filter((r) => selected().has(r.id)).map((r) => r.name) : 'skjult',
  }, null, 2);
}

document.getElementById('back').onclick = back;
document.getElementById('prev').onclick = () => setVariant(KEYS[(KEYS.indexOf(variant()) + KEYS.length - 1) % KEYS.length]);
document.getElementById('next').onclick = () => setVariant(KEYS[(KEYS.indexOf(variant()) + 1) % KEYS.length]);
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input,textarea,[contenteditable]')) return;
  if (e.key === 'ArrowLeft') document.getElementById('prev').click();
  if (e.key === 'ArrowRight') document.getElementById('next').click();
});
document.querySelectorAll('[data-theme-choice]').forEach((b) => b.onclick = () => {
  document.getElementById('phone').dataset.theme = b.dataset.themeChoice;
  document.querySelectorAll('[data-theme-choice]').forEach((x) => x.classList.toggle('on', x === b));
});
seed('many');
render();
