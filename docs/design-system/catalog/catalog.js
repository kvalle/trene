const groups = [
  ['Navigasjon og struktur', [
    ['stack-header', 'Stakk-header', 'Standard toppfelt med tilbakehandling og skjermtittel.', 'Brukeren navigerer til en underliggende skjerm og må kunne gå tilbake.', 'exercises', '#app-header'],
    ['modal-route', 'Modal skjerm', 'En hel skjerm presentert som en modal arbeidsflyt.', 'En avgrenset oppgave skal fullføres eller avbrytes før brukeren fortsetter.', 'picker', '#app-header'],
    ['hero-layout', 'Hero-layout', 'Romslig startside med én tydelig hovedoppgave.', 'Skjermen er et startpunkt med én dominerende handling og få alternativer.', 'home', '.hero-title'],
    ['section-layout', 'Seksjonert detaljside', 'Sidetittel, redigerbar identitet og historikk i én flyt.', 'Flere nært beslektede oppgaver gjelder samme objekt og bør samles på én side.', 'detail', '.page-title'],
  ]],
  ['Handlinger', [
    ['primary-button', 'Primærknapp', 'Den viktigste handlingen i gjeldende kontekst.', 'Brukeren skal ledes mot skjermens ene viktigste neste steg.', 'home', '.primary'],
    ['secondary-button', 'Sekundærknapp', 'Overflatefarget støttehandling med nøytral kant og lavere visuell vekt.', 'En tilgjengelig handling er viktig, men ikke skjermens foretrukne neste steg.', 'home', '.secondary'],
    ['text-button', 'Tekstknapp', 'Laveste handlingsnivå, ofte avbryt eller tilbake.', 'Handlingen skal være tilgjengelig uten å konkurrere med primære eller sekundære valg.', 'picker', '.text'],
    ['destructive-button', 'Destruktiv knapp', 'Permanent sletting eller erstatning.', 'Handlingen har irreversible eller alvorlige konsekvenser som må være umiddelbart synlige.', 'completed', '.danger'],
    ['busy-button', 'Opptatt knapp', 'Handling under arbeid med spinner og presis status.', 'En igangsatt handling tar merkbar tid og gjentatte trykk må forhindres.', 'data-busy', '.busy'],
    ['compact-action', 'Liten handling', 'Kompakt tekstknapp med ikon og etikett for en tydelig lokal handling.', 'En handling gjelder én bestemt rad eller ett lite innholdselement. Velg ikon etter handlingen, for eksempel blyant, pluss eller søppelbøtte.', 'small-actions', '.small-button.text-small'],
  ]],
  ['Skjema og inndata', [
    ['search-field', 'Søkefelt', 'Filtrerer en liste fortløpende.', 'En liste kan bli lang nok til at visuell skanning ikke er effektiv.', 'exercises', '.field'],
    ['text-field', 'Tekstfelt', 'Lar brukeren skrive inn kort, fritt innhold.', 'Brukeren må opprette eller endre tekst som navn og etiketter.', 'create', '.field'],
    ['numeric-fields', 'Tallfelt', 'Belastning og repetisjoner i et planlagt sett.', 'Verdien er numerisk og riktig tastatur, validering og enhet reduserer feil.', 'workout', '.fields'],
    ['field-error', 'Feltfeil', 'Feilkant og forklarende tekst knyttet til feltet.', 'Ett bestemt felt inneholder en feil brukeren kan rette direkte.', 'create-error', '.invalid'],
    ['form-section', 'Skjemadel', 'Avgrenset gruppe med relaterte felt og handlinger.', 'Flere felt og handlinger skal forstås, valideres og lagres som én enhet.', 'form-section', '.planned'],
  ]],
  ['Lister og beholdere', [
    ['card', 'Kort', 'Generell beholder som grupperer nært beslektet innhold.', 'Innhold trenger visuell avgrensning, men ikke egen navigasjon eller utvidbarhet.', 'card', '.basic-card'],
    ['list-container', 'Listebeholder', 'Grupperer ensartede rader og eier ytterkant, avrunding, klipping og skillelinjer.', 'To eller flere beslektede rader skal oppleves som én samling. Bruk ikke beholderen rundt et enkelt kort eller fritt innhold.', 'list-container', '.list-container-example'],
    ['row', 'Rad', 'Felles layout med valgfritt ledende innhold, tekstblokk og etterfølgende innhold.', 'Innhold skal kunne skannes horisontalt i en liste. Velg deretter variant ut fra om raden navigerer, velger eller bare viser data.', 'row-anatomy', '.row-anatomy'],
    ['navigation-row', 'Rad · navigasjon', 'Trykkbar rad med tittel, valgfri beskrivelse og pil.', 'Hele raden åpner en ny skjerm. Bruk beskrivelse bare når den hjelper brukeren å velge.', 'navigation-rows', '.navigation-example'],
    ['selection-row', 'Rad · valg', 'Trykkbar rad med normal, deaktivert og opptatt tilstand.', 'Raden utfører et valg på stedet i stedet for å åpne en detaljskjerm.', 'selection-rows', '.selection-examples'],
    ['data-row', 'Rad · data', 'Skrivebeskyttet rad med etikett, verdi og valgfri lokal handling.', 'Strukturert informasjon skal skannes raskt. Legg bare til handling når den gjelder den aktuelle raden.', 'data-rows', '.data-row-examples'],
    ['disclosure-card', 'Utvidbart kort', 'Kort med kollapset sammendrag og en åpen detaljvisning.', 'Flere innholdsrike elementer deler skjerm, men bare noen trenger detaljert oppmerksomhet samtidig.', 'disclosure-cards', '.disclosure-examples'],
  ]],
  ['Feedback', [
    ['loader', 'Loader', 'Aktivitetsindikator i stor sidevariant og kompakt inline-variant, begge med valgfri statusetikett.', 'Bruk stor loader når hovedinnholdet på en hel skjerm venter. Bruk kompakt loader i en knapp, rad eller lokal operasjon.', 'loader', '.loader-examples'],
    ['notice-card', 'Informasjonsvarsel', 'Avgrenset forklaring som ikke signaliserer feil.', 'Viktig kontekst, personvern eller konsekvenser må leses før en handling.', 'data', '.notice'],
    ['error-alert', 'Feilvarsel', 'Lokal feilmelding med fareikon, svak fareflate og valgfri gjenopprettingshandling.', 'En avgrenset operasjon feiler, mens resten av skjermen fortsatt er gyldig og nyttig.', 'workout-error', '.failure'],
  ]],
  ['Sidevisninger', [
    ['page-status', 'Sidestatus', 'Sentrert sideoppsett for lasting, tomt innhold, ingen treff, feil eller manglende ressurs.', 'Skjermens hovedinnhold ikke kan vises. Velg variant etter om brukeren venter, mangler innhold, har filtrert bort innhold, kan prøve igjen eller må navigere bort.', 'page-states', '.page-state-gallery'],
  ]],
  ['Dialoger', [
    ['dialog', 'Dialog', 'Modal beholder med tittel, forklaring og handlinger som krever brukerens oppmerksomhet.', 'Brukeren må ta stilling før den underliggende skjermen kan brukes videre.', 'dialog-anatomy', '.dialog-examples'],
    ['confirmation-dialog', 'Dialog · bekreftelse', 'Dialog med en trygg avbryt-handling og en tydelig bekreftelse.', 'En betydningsfull handling trenger en siste kontroll, men er ikke permanent destruktiv.', 'confirm-dialog', '.dialog'],
    ['destructive-dialog', 'Dialog · destruktiv', 'Bekreftelsesdialog med tydelig faretekst og destruktiv hovedhandling.', 'En permanent eller vanskelig reverserbar handling må bekreftes eksplisitt.', 'delete-dialog', '.dialog'],
  ]],
];

const screen = document.querySelector('#screen');
const dialogLayer = document.querySelector('#dialog-layer');
let selected = 'stack-header';

const button = (label, kind = 'primary', extra = '') => `<button class="button ${kind} ${extra}" type="button"${extra.includes('disabled') ? ' disabled' : ''}>${label}</button>`;
const row = (name, meta, extra = '') => `<button class="list-row ${extra}" type="button"><span><b>${name}</b>${meta ? `<small>${meta}</small>` : ''}</span><i class="chevron">›</i></button>`;
const field = (label, value, extra = '', type = 'text') => `<label class="field ${extra}"><span>${label}</span><input type="${type}" value="${value}"></label>`;
const editAction = (label) => `<button class="small-button text-small" type="button" aria-label="Rediger ${label}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11-4-4L4 16v4Zm10-13 4 4M13.5 6.5l4 4"/></svg><span>Rediger</span></button>`;
const errorIcon = '<span class="error-icon" aria-hidden="true">!</span>';

function home() {
  return `<h1 class="hero-title">Klar for en økt?</h1><p class="intro">Registrer øvelser og sett mens du trener.</p><div class="home-actions">${button('Start økt')}${button('Tidligere økter', 'secondary')}${button('Øvelser', 'secondary')}${button('Innstillinger', 'secondary')}</div>`;
}
function exercises(query = false) {
  return `${field('Søk i øvelser', query ? 'press' : '', '', 'search')}<div class="list">${row('Benkpress', 'Brukt i 12 økter')}${row('Knebøy', 'Brukt i 10 økter')}${row('Markløft', 'Brukt i 8 økter')}</div>${button('Opprett øvelse', 'secondary')}`;
}
function picker(busy = false) {
  return `${field('Søk i øvelser', '', '', 'search')}<div class="list">${row('Benkpress', busy ? 'Legger til…' : 'Trykk for å legge til', busy ? 'busy-row disabled' : '')}${row('Knebøy', 'Trykk for å legge til', busy ? 'disabled' : '')}${row('Markløft', 'Trykk for å legge til', busy ? 'disabled' : '')}</div>${button('Opprett øvelse', 'secondary')}${button('Avbryt', 'text')}`;
}
function create(hasError = false) {
  return `<h1 class="page-title">Opprett øvelse</h1>${field('Navn', 'Benkpress', hasError ? 'invalid' : '')}${hasError ? '<p class="field-error">Det finnes allerede en øvelse med dette navnet.</p>' : ''}${button('Opprett')}${button('Avbryt', 'text')}`;
}
function workout(mode = '') {
  const failure = mode === 'error' ? `<aside class="failure" role="alert">${errorIcon}<div><h3>Endringene er ikke lagret</h3><p>Kontroller tilkoblingen og prøv å lagre igjen.</p>${button('Prøv å lagre igjen', 'secondary')}</div></aside>` : '';
  return `<article class="card exercise-card"><button class="exercise-header" type="button" aria-expanded="true"><span><b>Benkpress</b><small>2 av 3 sett gjennomført</small></span><i>−</i></button><div class="set-row"><span><b>Sett 1</b><small>80 kg · 8 repetisjoner</small></span>${editAction('sett 1')}</div><div class="set-row"><span><b>Sett 2</b><small>80 kg · 8 repetisjoner</small></span>${editAction('sett 2')}</div><section class="planned"><b>Planlagt sett</b><div class="fields">${field('Belastning', '80', '', 'number')}${field('Repetisjoner', '8', '', 'number')}</div>${failure}<div class="button-row">${button('Bekreft')}${button('Slett', 'secondary')}</div></section></article><article class="card"><button class="exercise-header" type="button" aria-expanded="false"><span><b>Knebøy</b><small>0 av 3 sett gjennomført</small></span><i>+</i></button></article>${button('Legg til øvelse', 'secondary')}${button('Ferdig', 'primary', mode === 'disabled' ? 'disabled' : '')}${button('Avbryt', 'text')}`;
}
function basicCard() {
  return `<h1 class="page-title">Kort</h1><p class="intro">Kortet grupperer innhold uten å tilføre egen interaksjon.</p><article class="card basic-card"><h3>Benkpress</h3><p>Tre gjennomførte sett · Sist brukt i dag</p></article>`;
}
function smallActions() {
  return `<h1 class="page-title">Liten handling</h1><p class="intro">En kompakt tekstknapp der ikonet tydeliggjør handlingen og etiketten fjerner tvetydighet.</p><article class="card"><h3>Benkpress</h3><div class="set-row"><span><b>Sett 1</b><small>80 kg · 8 repetisjoner</small></span>${editAction('sett 1')}</div><div class="set-row"><span><b>Sett 2</b><small>80 kg · 8 repetisjoner</small></span>${editAction('sett 2')}</div></article>`;
}
function completed() {
  return `<h1 class="page-title">Fullført økt</h1><p class="timestamp">Lørdag 22. august 2026 kl. 08:42</p><article class="card result-card"><h3>Benkpress</h3><div class="result-set"><b>Sett 1</b><span>80 kg · 8 repetisjoner</span></div><div class="result-set"><b>Sett 2</b><span>80 kg · 8 repetisjoner</span></div><div class="result-set"><b>Sett 3</b><span>80 kg · 7 repetisjoner</span></div></article>${button('Slett økt', 'danger')}${button('Tilbake til forsiden')}`;
}
function data(busy = false) {
  return `<h1 class="page-title">Dine data</h1><p class="intro">Lag en fil med alle øvelser og treningsøkter i Trene.</p><aside class="notice"><h3>Filen inneholder treningsdata</h3><p>Sikkerhetskopien er ikke kryptert av Trene. Oppbevar og del den på en trygg måte.</p></aside>${button(busy ? '<span class="spinner"></span>Lager sikkerhetskopi' : 'Lag sikkerhetskopi', 'primary', busy ? 'busy' : '')}${button('Gjenopprett fra fil', 'secondary', busy ? 'disabled' : '')}`;
}
function detail() {
  return `<h1 class="page-title">Benkpress</h1><section><h2>Endre navn</h2>${field('Navn', 'Benkpress')}${button('Lagre navn')}</section><section><h2>Historikk</h2><article class="card"><h3>22. august 2026</h3><div class="result-set"><b>Sett 1</b><span>80 kg · 8 repetisjoner</span></div><div class="result-set"><b>Sett 2</b><span>80 kg · 8 repetisjoner</span></div></article></section>${button('Slett øvelse', 'danger')}`;
}
function navigationRows() {
  return `<h1 class="page-title">Navigasjonsrader</h1><p class="intro">Beskrivelse er valgfri og brukes bare når den støtter valget.</p><div class="list navigation-example">${row('Benkpress', 'Brukt i 12 økter')}${row('Data', '')}</div>`;
}
function listContainer() {
  return `<h1 class="page-title">Listebeholder</h1><p class="intro">Beholderen gir forskjellige radtyper en felles kant, rytme og skillelinjer.</p><div class="list list-container-example">${row('Øvelser', 'Administrer øvelser')}<div class="data-row"><span><b>Sist sikkerhetskopiert</b><small>I går kl. 20:14</small></span></div><button class="selection-row" type="button"><span>Standardprogram</span><small>Velg</small></button></div>`;
}
function rowAnatomy() {
  return `<h1 class="page-title">Rad</h1><p class="intro">Raden har tre plasser. Bare tekstblokken er påkrevd.</p><div class="list"><div class="row-anatomy"><span class="leading-slot" aria-hidden="true">B</span><span class="row-copy"><b>Benkpress</b><small>Brukt i 12 økter</small></span><span class="trailing-slot"><i class="chevron">›</i></span></div></div><div class="anatomy-key"><p><b>Ledende</b><span>Valgfritt ikon eller identifikator</span></p><p><b>Tekstblokk</b><span>Tittel og valgfri beskrivelse</span></p><p><b>Etterfølgende</b><span>Pil, verdi, status, spinner eller liten handling</span></p></div>`;
}
function selectionRows() {
  return `<h1 class="page-title">Valgrader</h1><p class="intro">Raden utfører et valg på stedet og har derfor ingen navigasjonspil.</p><div class="list selection-examples"><button class="selection-row" type="button"><span>Benkpress</span><small>Velg</small></button><button class="selection-row busy-row" type="button" disabled><span>Knebøy</span><small><i class="mini-spinner"></i>Legger til…</small></button><button class="selection-row" type="button" disabled><span>Markløft</span><small>Ikke tilgjengelig</small></button></div>`;
}
function dataRows() {
  return `<h1 class="page-title">Datarader</h1><p class="intro">Handlingen er valgfri og brukes bare når den gjelder én bestemt rad.</p><article class="card data-row-examples"><div class="data-row"><span><b>Sett 1</b><small>80 kg · 8 repetisjoner</small></span></div><div class="data-row"><span><b>Sett 2</b><small>80 kg · 8 repetisjoner</small></span>${editAction('sett 2')}</div></article>`;
}
function disclosureCards() {
  return `<h1 class="page-title">Utvidbare kort</h1><p class="intro">Samme komponent i kollapset og åpen tilstand.</p><div class="disclosure-examples"><article class="card"><button class="exercise-header" type="button" aria-expanded="false"><span><b>Knebøy</b><small>0 av 3 sett gjennomført</small></span><i>+</i></button></article><article class="card"><button class="exercise-header" type="button" aria-expanded="true"><span><b>Benkpress</b><small>2 av 3 sett gjennomført</small></span><i>−</i></button><div class="data-row"><span><b>Sett 1</b><small>80 kg · 8 repetisjoner</small></span></div><div class="data-row"><span><b>Sett 2</b><small>80 kg · 8 repetisjoner</small></span>${editAction('sett 2')}</div></article></div>`;
}
function formSection() {
  return `<h1 class="page-title">Skjemadel</h1><p class="intro">Feltene og handlingene behandles som én redigerbar enhet.</p><article class="card"><section class="planned"><b>Planlagt sett</b><div class="fields">${field('Belastning', '80', '', 'number')}${field('Repetisjoner', '8', '', 'number')}</div><div class="button-row">${button('Bekreft')}${button('Slett', 'secondary')}</div></section></article>`;
}
function disabledButtons() {
  return `<h1 class="page-title">Deaktiverte handlinger</h1><p class="intro">Når en handling ikke er tilgjengelig, fjernes fargesignalene som ellers viser hierarki.</p><section class="card"><h3>Primær</h3><p>Ingen sett er bekreftet ennå.</p>${button('Ferdig', 'primary', 'disabled disabled-primary')}</section><section class="card"><h3>Sekundær</h3><p>Kan ikke legge til flere øvelser akkurat nå.</p>${button('Legg til øvelse', 'secondary', 'disabled disabled-secondary')}</section>`;
}
function loaderExamples() {
  return `<h1 class="page-title">Loader</h1><p class="intro">To størrelser dekker helskjerminnhold og lokale operasjoner.</p><section class="card loader-examples"><div class="loader-example"><span class="variant-label">Stor · sideinnhold</span><div class="loader-row page-loader"><span class="spinner large-spinner"></span><span>Laster øvelser</span></div></div><div class="loader-example"><span class="variant-label">Kompakt · inline</span><div class="loader-row"><span class="spinner compact-spinner"></span><span>Lagrer</span></div></div></section>`;
}
function pageStates() {
  return `<h1 class="page-title">Sidestatus</h1><p class="intro">Samme sentrerte oppsett med innhold tilpasset årsaken.</p><div class="page-state-gallery"><section class="state-sample"><span class="state-kind">Laster</span><span class="spinner large-spinner"></span><b>Laster øvelser</b></section><section class="state-sample"><span class="state-kind">Tom</span><b>Ingen fullførte økter ennå</b><small>Fullfør en økt for å se den her.</small><span class="sample-action">Start økt</span></section><section class="state-sample"><span class="state-kind">Ingen treff</span><b>Ingen øvelser funnet</b><small>Prøv et annet søk eller opprett en ny øvelse.</small><span class="sample-action">Opprett øvelse</span></section><section class="state-sample error-sample"><span class="state-kind">Feil</span>${errorIcon}<b>Kunne ikke laste inn</b><small>Dataene dine er ikke endret.</small><span class="sample-action">Prøv igjen</span></section><section class="state-sample"><span class="state-kind">Mangler</span><b>Økten finnes ikke lenger</b><small>Den kan ha blitt slettet.</small><span class="sample-action">Tilbake</span></section></div>`;
}
function dialogAnatomy() {
  return `${data()}<aside class="prototype-controls" aria-label="Prototypetilstander"><span class="variant-label">Interaktiv prototype</span><p>Velg en tilstand for å kontrollere hele gjenopprettingsflyten.</p><div>${['Filfeil', 'Forhåndsvisning', 'Nåværende data', 'Bekreft erstatt', 'Gjenoppretter', 'Ferdig', 'Gjenopprettbar feil', 'Sikkerhetsstopp'].map((label, index) => `<button class="small-button text-small" type="button" data-restore-stage="${['file-error', 'preview', 'current-data', 'confirm', 'committing', 'success', 'recoverable-error', 'safe-stop'][index]}">${label}</button>`).join('')}</div></aside>`;
}

function restoreDialog(stage) {
  const preview = '<p>Opprettet fredag 21. august 2026 kl. 20:14</p><div class="counts"><b>24 treningsøkter</b><b>8 øvelser</b></div>';
  const current = '<p>Nåværende data som blir erstattet:</p><div class="counts"><b>12 treningsøkter</b><b>6 øvelser</b></div><p>Sikkerhetskopien som gjenopprettes:</p><div class="counts"><b>24 treningsøkter</b><b>8 øvelser</b></div>';
  const dialogs = {
    'file-error': ['Sikkerhetskopien kan ikke brukes', `${errorIcon}<p>Sikkerhetskopien er skadet eller kan ikke leses. Dataene dine er ikke endret.</p>`, button('Velg en annen fil', 'primary')],
    preview: ['Kontroller sikkerhetskopien', `${preview}<p>Ingenting er gjenopprettet ennå.</p>`, button('Avbryt', 'secondary') + button('Fortsett', 'primary')],
    'current-data': ['Kontrollerer nåværende data', `${preview}<div class="loader-row"><span class="spinner compact-spinner"></span><span>Kontrollerer dataene som kan bli erstattet</span></div>`, button('Avbryt', 'secondary')],
    confirm: ['Erstatt alle data?', `${current}<p class="danger-copy">Dette erstatter alle data i Trene og kan ikke angres.</p>`, button('Avbryt', 'secondary') + button('Erstatt og gjenopprett', 'danger')],
    committing: ['Gjenoppretter data', '<div class="loader-row page-loader"><span class="spinner large-spinner"></span><span>Ikke lukk Trene mens dataene erstattes.</span></div><p>Avbryt er ikke tilgjengelig etter at gjenopprettingen har startet.</p>', ''],
    success: ['Gjenopprettingen er fullført', '<p>24 treningsøkter og 8 øvelser er gjenopprettet.</p><p>De tidligere dataene er erstattet.</p>', button('Ferdig', 'primary')],
    'recoverable-error': ['Gjenopprettingen mislyktes', `${errorIcon}<p>De opprinnelige dataene er kontrollert og gjenopprettet. Dataene dine er ikke endret.</p>`, button('Ferdig', 'primary')],
    'safe-stop': ['Trene kan ikke åpne dataene trygt', `${errorIcon}<p>Gjenopprettingen ble avbrutt, og ingen av databasene kunne bekreftes. Dataene er bevart for hjelp med gjenoppretting.</p><p class="danger-copy">Ikke slett eller installer appen på nytt.</p><small>Ingen handlinger vises når videre bruk kan skade data.</small>`, ''],
  };
  const [title, copy, actions] = dialogs[stage];
  const controls = ['file-error', 'preview', 'current-data', 'confirm', 'committing', 'success', 'recoverable-error', 'safe-stop'];
  return `<section class="dialog restore-dialog ${stage === 'safe-stop' ? 'locked-dialog' : ''}" role="dialog" aria-modal="true" aria-labelledby="restore-title"><span class="variant-label">${stage === 'safe-stop' ? 'Låst sikkerhetsstopp' : 'Gjenoppretting'}</span><h2 id="restore-title">${title}</h2>${copy}<div class="restore-actions">${actions}</div><details class="prototype-state-picker"><summary>Vis prototypetilstand</summary><div>${controls.map((name) => `<button class="small-button text-small" type="button" data-restore-stage="${name}">${name.replaceAll('-', ' ')}</button>`).join('')}</div></details></section>`;
}

function showRestoreDialog(stage) {
  dialogLayer.innerHTML = restoreDialog(stage);
  dialogLayer.hidden = false;
  dialogLayer.querySelectorAll('[data-restore-stage]').forEach((control) => control.addEventListener('click', () => showRestoreDialog(control.dataset.restoreStage)));
  const primary = dialogLayer.querySelector('.primary, .danger');
  if (stage === 'preview' && primary) primary.addEventListener('click', () => showRestoreDialog('current-data'));
  if (stage === 'current-data') window.setTimeout(() => showRestoreDialog('confirm'), 900);
  if (stage === 'confirm' && primary) primary.addEventListener('click', () => showRestoreDialog('committing'));
  if (stage === 'committing') window.setTimeout(() => showRestoreDialog('success'), 1300);
}
function showDialog(kind) {
  const dialogs = {
    confirm: ['Fullfør økten?', 'Økten lagres i historikken. Ett planlagt sett blir ikke tatt med.', button('Fortsett økten', 'secondary') + button('Fullfør økt')],
    delete: ['Slett fullført økt?', 'Den fullførte økten slettes permanent. Dette kan ikke angres.', button('Avbryt', 'secondary') + button('Slett', 'danger')],
  };
  const [title, copy, actions] = dialogs[kind];
  dialogLayer.innerHTML = `<section class="dialog" role="dialog" aria-modal="true"><h2>${title}</h2><p>${copy}</p>${actions}</section>`;
  dialogLayer.hidden = false;
}

const examples = {
  home: ['Trene', false, home], exercises: ['Øvelser', true, exercises], picker: ['Legg til øvelse', false, picker],
  'picker-busy': ['Legg til øvelse', false, () => picker(true)], create: ['Ny øvelse', false, create],
  'create-error': ['Ny øvelse', false, () => create(true)], workout: ['Treningsøkt', true, workout],
  'small-actions': ['Treningsøkt', true, smallActions],
  'workout-disabled': ['Treningsøkt', true, () => workout('disabled')], 'workout-error': ['Treningsøkt', true, () => workout('error')],
  completed: ['Fullført økt', true, completed], data: ['Data', true, data], 'data-busy': ['Data', true, () => data(true)],
  detail: ['Øvelse', true, detail], card: ['Komponentvarianter', true, basicCard], 'list-container': ['Komponentvarianter', true, listContainer],
  'row-anatomy': ['Komponentvarianter', true, rowAnatomy], 'navigation-rows': ['Komponentvarianter', true, navigationRows],
  'selection-rows': ['Komponentvarianter', true, selectionRows], 'data-rows': ['Komponentvarianter', true, dataRows],
  'disclosure-cards': ['Komponentvarianter', true, disclosureCards], 'form-section': ['Komponentvarianter', true, formSection],
  loader: ['Komponentvarianter', true, loaderExamples], 'page-states': ['Komponentvarianter', true, pageStates],
  'buttons-disabled': ['Komponenttilstander', true, disabledButtons],
  'dialog-anatomy': ['Komponentvarianter', true, dialogAnatomy],
  'confirm-dialog': ['Treningsøkt', true, workout, 'confirm'], 'delete-dialog': ['Fullført økt', true, completed, 'delete'],
};

function renderCatalog(filter = '') {
  const query = filter.trim().toLocaleLowerCase('nb');
  const html = groups.map(([group, items]) => {
    const matches = items.filter(([, name, description, usage]) => `${name} ${description} ${usage}`.toLocaleLowerCase('nb').includes(query));
    if (!matches.length) return '';
    return `<section class="catalog-group"><h2>${group}</h2>${matches.map(([id, name]) => `<button class="catalog-item ${id === selected ? 'active' : ''}" data-component="${id}" type="button">${name}</button>`).join('')}</section>`;
  }).join('');
  document.querySelector('#catalog').innerHTML = html || '<p class="catalog-empty">Ingen komponenter funnet.</p>';
  document.querySelectorAll('[data-component]').forEach((item) => item.addEventListener('click', () => selectComponent(item.dataset.component)));
}

function selectComponent(id) {
  const entry = groups.flatMap(([, items]) => items).find(([itemId]) => itemId === id);
  if (!entry) return;
  selected = id;
  const [, name, description, usage, exampleId, target] = entry;
  const [title, hasBack, render, dialog] = examples[exampleId];
  document.querySelector('#component-category').textContent = groups.find(([, items]) => items.includes(entry))[0];
  document.querySelector('#component-name').textContent = name;
  document.querySelector('#component-description').textContent = description;
  document.querySelector('#component-usage').textContent = usage;
  document.querySelector('#screen-label').textContent = `Eksempel: ${title}`;
  document.querySelector('#screen-title').textContent = title;
  document.querySelector('#back').classList.toggle('invisible', !hasBack);
  document.querySelector('#app-header').classList.remove('highlight');
  dialogLayer.hidden = true;
  screen.innerHTML = render();
  if (exampleId === 'dialog-anatomy') {
    screen.querySelectorAll('[data-restore-stage]').forEach((control) => control.addEventListener('click', () => showRestoreDialog(control.dataset.restoreStage)));
    showRestoreDialog('preview');
  } else if (dialog) showDialog(dialog);
  requestAnimationFrame(() => {
    const element = document.querySelector(target);
    if (element) {
      element.classList.add('highlight');
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  });
  const url = new URL(location.href);
  url.searchParams.set('component', id);
  history.replaceState(null, '', url);
  renderCatalog(document.querySelector('#catalog-search').value);
}

document.querySelector('#catalog-search').addEventListener('input', (event) => renderCatalog(event.target.value));
document.querySelector('#theme-toggle').addEventListener('click', (event) => {
  const dark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  event.currentTarget.textContent = dark ? 'Mørk modus' : 'Lys modus';
});

const initial = new URLSearchParams(location.search).get('component');
renderCatalog();
selectComponent(groups.flatMap(([, items]) => items).some(([id]) => id === initial) ? initial : selected);
