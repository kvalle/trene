// PROTOTYPE: Three active-workout layouts, switchable with ?variant=A|B|C.
const variants = {
  A: { name: "Kortstokk" },
  B: { name: "Fokusmodus" },
  C: { name: "Kompakt liste" },
};

const state = {
  activeExercise: 0,
  exercises: [
    {
      name: "Knebøy",
      sets: [
        { load: "80", reps: "8", status: "complete" },
        { load: "80", reps: "8", status: "complete" },
        { load: "80", reps: "8", status: "suggested" },
      ],
    },
    {
      name: "Benkpress",
      sets: [
        { load: "60", reps: "10", status: "complete" },
        { load: "60", reps: "10", status: "suggested" },
      ],
    },
    {
      name: "Sittende roing",
      sets: [{ load: "55", reps: "10", status: "suggested" }],
    },
  ],
};

const app = document.querySelector("#app");

function currentVariant() {
  const key = new URLSearchParams(location.search).get("variant")?.toUpperCase();
  return variants[key] ? key : "A";
}

function completedCount(exercise) {
  return exercise.sets.filter((set) => set.status === "complete").length;
}

function setRow(exerciseIndex, set, setIndex, compact = false) {
  const isComplete = set.status === "complete";
  return `
    <div class="set-row ${isComplete ? "is-complete" : ""} ${compact ? "set-row--compact" : ""}" data-set-row>
      <span class="set-number" aria-label="Sett ${setIndex + 1}">${setIndex + 1}</span>
      <label>
        <span class="field-label">Belastning</span>
        <span class="input-unit"><input inputmode="decimal" value="${set.load}" aria-label="Belastning for sett ${setIndex + 1}" data-field="load" data-exercise="${exerciseIndex}" data-set="${setIndex}" /><span>kg</span></span>
      </label>
      <label>
        <span class="field-label">Repetisjoner</span>
        <input inputmode="numeric" value="${set.reps}" aria-label="Repetisjoner for sett ${setIndex + 1}" data-field="reps" data-exercise="${exerciseIndex}" data-set="${setIndex}" />
      </label>
      <button class="confirm ${isComplete ? "confirm--complete" : ""}" data-confirm="${exerciseIndex}:${setIndex}" aria-label="${isComplete ? `Rediger gjennomført sett ${setIndex + 1}` : `Bekreft sett ${setIndex + 1}`}">
        ${isComplete ? "✓ Gjennomført" : "Bekreft"}
      </button>
    </div>`;
}

function exerciseCard(exercise, exerciseIndex, expanded) {
  const count = completedCount(exercise);
  return `
    <article class="exercise-card ${expanded ? "is-expanded" : ""}">
      <button class="exercise-heading" data-exercise="${exerciseIndex}" aria-expanded="${expanded}">
        <span><strong>${exercise.name}</strong><small>${count} ${count === 1 ? "sett" : "sett"} gjennomført</small></span>
        <span aria-hidden="true">${expanded ? "−" : "+"}</span>
      </button>
      ${expanded ? `<div class="sets">${exercise.sets.map((set, index) => setRow(exerciseIndex, set, index)).join("")}</div><button class="secondary full" data-add-set="${exerciseIndex}">+ Legg til sett</button>` : ""}
    </article>`;
}

function header() {
  const total = state.exercises.reduce((sum, exercise) => sum + completedCount(exercise), 0);
  return `
    <header class="workout-header">
      <button class="icon-button" aria-label="Tilbake til hovedskjermen">‹</button>
      <div><span class="eyebrow">Pågående</span><h1>Treningsøkt</h1></div>
      <button class="text-button">Ferdig</button>
      <p class="workout-status" aria-live="polite">${total} sett gjennomført</p>
    </header>`;
}

function variantA() {
  return `${header()}
    <main class="stack-layout">
      <p class="variant-note">Alle øvelser i én rullbar kortstokk. Trykk et kort for å registrere.</p>
      ${state.exercises.map((exercise, index) => exerciseCard(exercise, index, index === state.activeExercise)).join("")}
      <button class="primary full">+ Legg til øvelse</button>
    </main>`;
}

function variantB() {
  const exercise = state.exercises[state.activeExercise];
  return `${header()}
    <nav class="exercise-tabs" aria-label="Øvelser">
      ${state.exercises.map((item, index) => `<button class="exercise-tab ${index === state.activeExercise ? "is-active" : ""}" data-exercise="${index}" aria-current="${index === state.activeExercise ? "page" : "false"}"><strong>${item.name}</strong><small>${completedCount(item)}/${item.sets.length} sett</small></button>`).join("")}
      <button class="exercise-tab exercise-tab--add">+ Ny</button>
    </nav>
    <main class="focus-layout">
      <p class="variant-note">Én øvelse fyller arbeidsflaten. Øvelsesstripen bytter fokus.</p>
      <div class="focus-title"><div><span class="eyebrow">Øvelse ${state.activeExercise + 1} av ${state.exercises.length}</span><h2>${exercise.name}</h2></div><button class="icon-button" aria-label="Flere valg for ${exercise.name}">•••</button></div>
      <div class="sets focus-sets">${exercise.sets.map((set, index) => setRow(state.activeExercise, set, index)).join("")}</div>
      <button class="secondary full" data-add-set="${state.activeExercise}">+ Legg til sett</button>
    </main>`;
}

function variantC() {
  return `${header()}
    <main class="table-layout">
      <p class="variant-note">Alle sett er synlige samtidig i en tett arbeidsliste uten ekspandering.</p>
      ${state.exercises.map((exercise, exerciseIndex) => `
        <section class="table-exercise">
          <div class="table-heading"><h2>${exercise.name}</h2><button class="icon-button" aria-label="Flere valg for ${exercise.name}">•••</button></div>
          <div class="sets compact-sets">${exercise.sets.map((set, setIndex) => setRow(exerciseIndex, set, setIndex, true)).join("")}</div>
          <button class="inline-add" data-add-set="${exerciseIndex}">+ Sett</button>
        </section>`).join("")}
      <button class="primary full">+ Legg til øvelse</button>
    </main>`;
}

function switcher(variant) {
  return `<nav class="prototype-switcher" aria-label="Prototypevariant">
    <button data-cycle="-1" aria-label="Forrige variant">←</button>
    <span><small>Prototype</small><strong>${variant} · ${variants[variant].name}</strong></span>
    <button data-cycle="1" aria-label="Neste variant">→</button>
  </nav>`;
}

function render() {
  const variant = currentVariant();
  app.innerHTML = `<div class="phone-shell">${variant === "A" ? variantA() : variant === "B" ? variantB() : variantC()}</div>${switcher(variant)}`;
}

function cycle(direction) {
  const keys = Object.keys(variants);
  const index = keys.indexOf(currentVariant());
  const next = keys[(index + direction + keys.length) % keys.length];
  const url = new URL(location.href);
  url.searchParams.set("variant", next);
  history.replaceState({}, "", url);
  render();
}

app.addEventListener("input", (event) => {
  const input = event.target.closest("input[data-field]");
  if (!input) return;
  state.exercises[input.dataset.exercise].sets[input.dataset.set][input.dataset.field] = input.value;
});

app.addEventListener("click", (event) => {
  const cycleButton = event.target.closest("[data-cycle]");
  if (cycleButton) return cycle(Number(cycleButton.dataset.cycle));

  const exerciseButton = event.target.closest("[data-exercise]:not(input)");
  if (exerciseButton) {
    state.activeExercise = Number(exerciseButton.dataset.exercise);
    return render();
  }

  const confirmButton = event.target.closest("[data-confirm]");
  if (confirmButton) {
    const [exerciseIndex, setIndex] = confirmButton.dataset.confirm.split(":").map(Number);
    state.exercises[exerciseIndex].sets[setIndex].status = "complete";
    return render();
  }

  const addButton = event.target.closest("[data-add-set]");
  if (addButton) {
    const exercise = state.exercises[Number(addButton.dataset.addSet)];
    const lastComplete = [...exercise.sets].reverse().find((set) => set.status === "complete") ?? { load: "", reps: "" };
    exercise.sets.push({ load: lastComplete.load, reps: lastComplete.reps, status: "suggested" });
    return render();
  }
});

document.addEventListener("keydown", (event) => {
  if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) return;
  if (event.key === "ArrowLeft") cycle(-1);
  if (event.key === "ArrowRight") cycle(1);
});

render();
