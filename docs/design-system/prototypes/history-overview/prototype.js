// PROTOTYPE – kastes etter beslutning. Ingen persistens; alt ligger i minnet.
// Tre varianter av «Tidligere treninger», byttes via ?variant=A|B|C.

const TODAY = new Date(2026, 10, 8); // søndag 8. november 2026
const VARIANTS = [
  { key: 'A', name: 'Kalender (heatmap, loddrett)' },
  { key: 'B', name: 'Måneder, sammenfoldet' },
  { key: 'C', name: 'Månedskalendere med vurdering' },
];
const EXERCISES = ['Knebøy', 'Benkpress', 'Markløft', 'Roing', 'Skulderpress', 'Pull-ups', 'Utfall', 'Planke'];
const WEEKDAYS = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'];

// ---------- data ----------
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const sameDay = (a, b) => dayKey(a) === dayKey(b);
const daysBetween = (a, b) => Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
const mondayIndex = (d) => (d.getDay() + 6) % 7;

function generate(start, probabilityFor, seed) {
  const r = rng(seed);
  const out = [];
  for (let d = start; d <= TODAY; d = addDays(d, 1)) {
    if (r() < probabilityFor(d)) {
      const at = new Date(d); at.setHours(6 + Math.floor(r() * 14), Math.floor(r() * 60));
      out.push({ completedAt: at, exerciseCount: 2 + Math.floor(r() * 5), seed: Math.floor(r() * 1e6) });
    }
  }
  return out;
}

const SCENARIOS = {
  regular: {
    label: 'Jevn trener', detail: '≈3 treninger/uke siden januar',
    make: () => generate(new Date(2026, 0, 12), (d) => ([0, 2, 4].includes(mondayIndex(d)) ? 0.85 : 0.06), 7),
  },
  uneven: {
    label: 'Ujevn trener', detail: 'Gode og dårlige måneder, lang pause i sommer',
    make: () => generate(new Date(2025, 8, 3), (d) => {
      const m = monthKey(d);
      const map = { '2025-09': .45, '2025-10': .3, '2025-11': .12, '2025-12': .05, '2026-01': .4, '2026-02': .35, '2026-03': .2, '2026-04': .15, '2026-05': .1, '2026-06': .03, '2026-07': 0, '2026-08': .08, '2026-09': .25, '2026-10': .38, '2026-11': .3 };
      return map[m] ?? .2;
    }, 42),
  },
  fresh: {
    label: 'Ny bruker', detail: 'Første trening for halvannen uke siden',
    make: () => [new Date(2026, 9, 28, 17, 5), new Date(2026, 9, 31, 10, 30), new Date(2026, 10, 3, 18, 0), new Date(2026, 10, 6, 7, 15)].map((d, i) => ({ completedAt: d, exerciseCount: 3 + i, seed: i })),
  },
  empty: { label: 'Ingen treninger', detail: 'Tom tilstand', make: () => [] },
};

// ---------- state ----------
const params = new URLSearchParams(location.search);
const state = {
  variant: VARIANTS.some((v) => v.key === params.get('variant')) ? params.get('variant') : 'C',
  scenario: params.get('data') in SCENARIOS ? params.get('data') : 'uneven',
  theme: params.get('theme') === 'dark' ? 'dark' : 'light',
  openMonths: new Set(),
  detail: null,
};
let workouts = [];
function loadScenario() {
  workouts = SCENARIOS[state.scenario].make()
    .map((w, i) => ({ ...w, id: i + 1 }))
    .sort((a, b) => b.completedAt - a.completedAt);
  state.openMonths = new Set();
  // Nyeste måned med trening starter utvidet.
  if (workouts.length) state.openMonths.add(monthKey(workouts[0].completedAt));
}

// ---------- formatting & stats ----------
const fmtDateTime = new Intl.DateTimeFormat('nb-NO', { dateStyle: 'long', timeStyle: 'short' });
const fmtMonth = new Intl.DateTimeFormat('nb-NO', { month: 'long', year: 'numeric' });
const fmtShortMonth = new Intl.DateTimeFormat('nb-NO', { month: 'short' });
const fmtWeekday = new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
const dec = (n) => n.toLocaleString('nb-NO', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function byDay() {
  const map = new Map();
  for (const w of workouts) { const k = dayKey(w.completedAt); if (!map.has(k)) map.set(k, []); map.get(k).push(w); }
  return map;
}

function months() {
  if (!workouts.length) return [];
  const first = workouts[workouts.length - 1].completedAt;
  const list = [];
  for (let m = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1); m >= new Date(first.getFullYear(), first.getMonth(), 1); m = new Date(m.getFullYear(), m.getMonth() - 1, 1)) {
    const items = workouts.filter((w) => monthKey(w.completedAt) === monthKey(m));
    list.push({ date: m, items, ...rate(m, items) });
  }
  return list;
}

function rate(m, items) {
  const n = items.length;
  const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const current = monthKey(m) === monthKey(TODAY);
  const elapsed = current ? TODAY.getDate() : daysInMonth;
  const days = [...new Set(items.map((w) => dayKey(w.completedAt)))].sort();
  let gapText;
  if (days.length >= 2) {
    const gap = daysBetween(new Date(days[0]), new Date(days[days.length - 1])) / (days.length - 1);
    gapText = `i snitt ${dec(gap)} dager mellom treningene`;
  } else if (n === 1) gapText = 'bare én trening';
  else gapText = 'ingen treninger';
  const projected = (n / elapsed) * daysInMonth;
  let level = projected >= 10 ? 'good' : projected >= 5 ? 'ok' : 'low';
  if (current && elapsed < 7 && level === 'low') level = 'ok';
  const tone = current
    ? { good: 'God start på måneden!', ok: 'Måneden er i gang', low: 'Fortsatt tid til å ta igjen – en trening i dag?' }[level]
    : { good: 'Sterk måned!', ok: 'Jevn innsats', low: 'Rolig måned – hver trening teller' }[level];
  return { level, gapText, tone, current, perWeek: (n / elapsed) * 7 };
}

function illustration(level) {
  if (level === 'good') return `<svg class="illu" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="var(--secondary)"/><g stroke="var(--primary)" stroke-width="3" stroke-linecap="round" fill="none"><path d="M24 8v5M24 35v5M8 24h5M35 24h5M12.7 12.7l3.5 3.5M31.8 31.8l3.5 3.5M12.7 35.3l3.5-3.5M31.8 16.2l3.5-3.5"/></g><circle cx="24" cy="24" r="8" fill="var(--primary)"/></svg>`;
  if (level === 'ok') return `<svg class="illu" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="var(--surface-alt)"/><path d="M10 30c5-8 9-8 14 0s9 8 14 0" stroke="var(--primary)" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
  return `<svg class="illu" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="var(--surface-alt)"/><path d="M24 38V22" stroke="var(--muted)" stroke-width="3" stroke-linecap="round"/><path d="M24 26c-7 0-10-5-10-10 6 0 10 3 10 10zM24 22c0-6 4-9 10-9 0 6-4 9-10 9z" fill="var(--primary)" opacity=".75"/></svg>`;
}

// ---------- shared pieces ----------
const row = (w) => `<button class="nav-row" data-open="${w.id}"><span class="copy"><b>${fmtDateTime.format(w.completedAt)}</b><small>${plural(w.exerciseCount, 'øvelse', 'øvelser')}</small></span><span class="chevron">›</span></button>`;

function summary() {
  const first = workouts[workouts.length - 1].completedAt;
  const last30 = workouts.filter((w) => daysBetween(w.completedAt, TODAY) < 30).length;
  const weeks = Math.max(1, daysBetween(first, TODAY) / 7);
  return `<div class="summary">
    <div class="stat"><b>${workouts.length}</b><small>treninger totalt</small></div>
    <div class="stat"><b>${last30}</b><small>siste 30 dager</small></div>
    <div class="stat"><b>${dec(workouts.length / weeks)}</b><small>treninger per uke i snitt</small></div>
  </div>`;
}

function dayCell(d, map, firstDay, extraClass = '') {
  const items = map.get(dayKey(d));
  const cls = ['day', extraClass];
  if (d > TODAY) cls.push('future');
  else if (d < firstDay) cls.push('before');
  if (items) cls.push('trained');
  if (sameDay(d, TODAY)) cls.push('today');
  const label = `${fmtWeekday.format(d)}${items ? `, ${plural(items.length, 'trening', 'treninger')}` : ''}`;
  return `<button class="${cls.join(' ')}" ${items ? `data-open="${items[0].id}"` : 'tabindex="-1"'} aria-label="${label}" title="${label}"><span class="num">${d.getDate()}</span></button>`;
}

// ---------- Variant A: loddrett heatmap ----------
function VariantA() {
  const map = byDay();
  const first = workouts[workouts.length - 1].completedAt;
  const firstDay = new Date(first.getFullYear(), first.getMonth(), first.getDate());
  const startMonday = addDays(firstDay, -mondayIndex(firstDay));
  const lastMonday = addDays(TODAY, -mondayIndex(TODAY));
  let html = summary();
  html += `<div class="legend"><i style="background:var(--surface-alt)"></i>Ingen trening <i style="background:var(--primary)"></i>Trent</div>`;
  html += `<div class="weekday-head"><span></span>${WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}</div>`;
  for (let mon = lastMonday; mon >= startMonday; mon = addDays(mon, -7)) {
    const days = [...Array(7)].map((_, i) => addDays(mon, i));
    const firstOfMonth = days.find((d) => d.getDate() === 1);
    const labelDay = firstOfMonth || (sameDay(mon, lastMonday) ? TODAY : null);
    const gutter = labelDay ? `${fmtShortMonth.format(labelDay).replace('.', '')}${labelDay.getMonth() === 0 || sameDay(mon, lastMonday) ? `<br>${labelDay.getFullYear()}` : ''}` : '';
    html += `<div class="week-row ${firstOfMonth ? 'month-start' : ''}"><span class="month-gutter">${gutter}</span>${days.map((d) => dayCell(d, map, firstDay, d.getDate() === 1 ? 'month-first' : '')).join('')}</div>`;
  }
  html += `<p class="start-marker">Første trening: ${fmtDateTime.format(first)}</p>`;
  return html;
}

// ---------- Variant B: måneder, sammenfoldet ----------
function VariantB() {
  return months().map((m) => {
    const key = monthKey(m.date);
    const open = state.openMonths.has(key);
    const head = `<button class="month-header" data-toggle="${key}" aria-expanded="${open}" ${m.items.length ? '' : 'disabled'}>
      ${illustration(m.level)}
      <span>
        <h4>${fmtMonth.format(m.date)}${m.current ? ' · pågår' : ''}</h4>
        <p><span class="count">${plural(m.items.length, 'trening', 'treninger')}</span> · ${m.gapText}</p>
        <p class="tone ${m.level}">${m.tone}</p>
      </span>
      <span class="chev">${m.items.length ? '›' : ''}</span>
    </button>`;
    const body = open ? `<div class="month-body">${m.items.map(row).join('')}</div>` : '';
    return `<div class="card month ${m.level} ${open ? 'open' : ''}">${head}${body}</div>`;
  }).join('');
}

// ---------- Variant C: månedskalendere ----------
function VariantC() {
  const map = byDay();
  const first = workouts[workouts.length - 1].completedAt;
  const firstDay = new Date(first.getFullYear(), first.getMonth(), first.getDate());
  return months().map((m) => {
    const y = m.date.getFullYear(), mo = m.date.getMonth();
    const len = new Date(y, mo + 1, 0).getDate();
    const pad = mondayIndex(m.date);
    let cells = WEEKDAYS.map((w) => `<span class="wd">${w}</span>`).join('');
    cells += '<span></span>'.repeat(pad);
    for (let i = 1; i <= len; i++) cells += dayCell(new Date(y, mo, i), map, firstDay);
    // Snitt per uke regnes over dagene som faktisk er «med» i måneden:
    // fra første trening (første måned) og til i dag (inneværende måned).
    const from = monthKey(firstDay) === monthKey(m.date) ? firstDay.getDate() : 1;
    const to = m.current ? TODAY.getDate() : len;
    const perWeek = (m.items.length / (to - from + 1)) * 7;
    const n = m.items.length;
    const countText = n === 0
      ? `Ingen treninger${m.current ? ' så langt' : ''}.`
      : `${plural(n, 'trening', 'treninger')}${m.current ? ' så langt' : ''}.`;
    const weekText = n === 0 ? '' : ` I snitt ${dec(perWeek)} per uke.`;
    const key = monthKey(m.date);
    const open = state.openMonths.has(key);
    return `<section class="card mblock ${open ? 'open' : ''}">
      <button class="mblock-toggle" data-toggle="${key}" aria-expanded="${open}">
        <span><h4>${fmtMonth.format(m.date)}</h4><p class="mblock-stats">${countText}${weekText}</p></span>
        <svg class="chev-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="${open ? 'm5.75 14.75 6.25-5.5 6.25 5.5' : 'm5.75 9.25 6.25 5.5 6.25-5.5'}" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      ${open ? `<div class="mini-cal">${cells}</div>` : ''}
    </section>`;
  }).join('');
}

// ---------- detalj (mock av CompletedWorkout) ----------
function Detail(w) {
  const r = rng(w.seed);
  const names = [...EXERCISES].sort(() => r() - 0.5).slice(0, w.exerciseCount);
  return `<div class="detail"><p>${fmtDateTime.format(w.completedAt)}</p><div class="card">${names.map((n) => `<div class="nav-row"><span class="copy"><b>${n}</b><small>3 sett · ${20 + Math.floor(r() * 80)} kg</small></span></div>`).join('')}</div></div>`;
}

// ---------- render ----------
const screen = document.getElementById('screen');
function render() {
  document.documentElement.dataset.theme = state.theme;
  const v = VARIANTS.find((x) => x.key === state.variant);
  document.getElementById('variant-label').textContent = `${v.key} (${v.name})`;
  document.getElementById('screen-title').textContent = state.detail ? 'Treningsøkt' : 'Tidligere treninger';
  document.querySelectorAll('[data-theme-choice]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.themeChoice === state.theme));
  document.querySelectorAll('[data-scenario]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.scenario === state.scenario));
  if (state.detail) { screen.innerHTML = Detail(state.detail); return; }
  if (!workouts.length) { screen.innerHTML = '<div class="empty"><h3>Ingen treninger ennå</h3><p>Fullførte treninger vises her.</p></div>'; return; }
  screen.innerHTML = { A: VariantA, B: VariantB, C: VariantC }[state.variant]();
}

function syncUrl() {
  const p = new URLSearchParams({ variant: state.variant, data: state.scenario, theme: state.theme });
  history.replaceState(null, '', `?${p}`);
}

function cycle(dir) {
  const i = VARIANTS.findIndex((v) => v.key === state.variant);
  state.variant = VARIANTS[(i + dir + VARIANTS.length) % VARIANTS.length].key;
  state.detail = null;
  screen.scrollTop = 0;
  syncUrl(); render();
}

document.getElementById('scenario-controls').innerHTML = Object.entries(SCENARIOS)
  .map(([k, s]) => `<button class="control" data-scenario="${k}">${s.label}<small>${s.detail}</small></button>`).join('');

document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.scenario) { state.scenario = t.dataset.scenario; state.detail = null; loadScenario(); syncUrl(); render(); }
  else if (t.dataset.themeChoice) { state.theme = t.dataset.themeChoice; syncUrl(); render(); }
  else if (t.dataset.toggle) { const k = t.dataset.toggle; state.openMonths.has(k) ? state.openMonths.delete(k) : state.openMonths.add(k); render(); }
  else if (t.dataset.open) { state.scrollTop = screen.scrollTop; state.detail = workouts.find((w) => w.id === Number(t.dataset.open)); render(); screen.scrollTop = 0; }
  else if (t.id === 'back' && state.detail) { state.detail = null; render(); screen.scrollTop = state.scrollTop || 0; }
  else if (t.id === 'prev') cycle(-1);
  else if (t.id === 'next') cycle(1);
});
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, [contenteditable]')) return;
  if (e.key === 'ArrowLeft') cycle(-1);
  if (e.key === 'ArrowRight') cycle(1);
});

loadScenario();
syncUrl();
render();
