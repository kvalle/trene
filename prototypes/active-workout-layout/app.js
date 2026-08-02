// PROTOTYPE: Two refinements of the card-stack layout, switchable with ?variant=A1|A2.
const variants = {
  A1: { name: "Kompakte rader" },
  A2: { name: "Delt arbeidsflate" },
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
  return variants[key] ? key : "A1";
}

function completedCount(exercise) {
  return exercise.sets.filter((set) => set.status === "complete").length;
}

function progress(exercise) {
  return `${completedCount(exercise)} av ${exercise.sets.length} sett gjennomført`;
}

function completedRow(exerciseIndex, set, setIndex, grouped = false) {
  return `
    <div class="completed-row ${grouped ? "completed-row--grouped" : ""}">
      <span class="set-number">${setIndex + 1}</span>
      <span class="completed-value"><strong>${set.load} kg</strong><small>Belastning</small></span>
      <span class="completed-value"><strong>${set.reps}</strong><small>Repetisjoner</small></span>
      <span class="completed-mark"><span aria-hidden="true">✓</span><span class="sr-only">Gjennomført</span></span>
      <button class="undo-button" data-unconfirm="${exerciseIndex}:${setIndex}" aria-label="Avkreft sett ${setIndex + 1}">Avkreft</button>
    </div>`;
}

function suggestedRow(exerciseIndex, set, setIndex) {
  return `
    <div class="set-row">
      <div class="set-row-heading">
        <strong>Sett ${setIndex + 1}</strong>
        <span>Ikke gjennomført</span>
        <button class="remove-button" data-remove="${exerciseIndex}:${setIndex}" aria-label="Fjern sett ${setIndex + 1}">Fjern</button>
      </div>
      <label>
        <span class="field-label">Belastning</span>
        <span class="input-unit"><input inputmode="decimal" value="${set.load}" aria-label="Belastning for sett ${setIndex + 1}" data-field="load" data-exercise-index="${exerciseIndex}" data-set="${setIndex}" /><span>kg</span></span>
      </label>
      <label>
        <span class="field-label">Repetisjoner</span>
        <input inputmode="numeric" value="${set.reps}" aria-label="Repetisjoner for sett ${setIndex + 1}" data-field="reps" data-exercise-index="${exerciseIndex}" data-set="${setIndex}" />
      </label>
      <button class="confirm" data-confirm="${exerciseIndex}:${setIndex}">✓ Bekreft sett</button>
    </div>`;
}

function cardContentsA1(exercise, exerciseIndex) {
  return `<div class="sets sets--a1">${exercise.sets.map((set, index) => set.status === "complete" ? completedRow(exerciseIndex, set, index) : suggestedRow(exerciseIndex, set, index)).join("")}</div>`;
}

function cardContentsA2(exercise, exerciseIndex) {
  const completed = exercise.sets.map((set, index) => ({ set, index })).filter(({ set }) => set.status === "complete");
  const suggested = exercise.sets.map((set, index) => ({ set, index })).filter(({ set }) => set.status === "suggested");
  return `
    ${completed.length ? `<section class="completed-group"><h3>Gjennomført</h3>${completed.map(({ set, index }) => completedRow(exerciseIndex, set, index, true)).join("")}</section>` : ""}
    ${suggested.length ? `<section class="next-group"><h3>Neste sett</h3><div class="sets">${suggested.map(({ set, index }) => suggestedRow(exerciseIndex, set, index)).join("")}</div></section>` : ""}`;
}

function exerciseCard(exercise, exerciseIndex, expanded, variant) {
  return `
    <article class="exercise-card ${expanded ? "is-expanded" : ""}">
      <button class="exercise-heading" data-toggle-exercise="${exerciseIndex}" aria-expanded="${expanded}">
        <span><strong>${exercise.name}</strong><small>${progress(exercise)}</small></span>
        <span class="toggle-label"><span>${expanded ? "Lukk" : "Åpne"}</span><span aria-hidden="true">${expanded ? "−" : "+"}</span></span>
      </button>
      ${expanded ? `<div class="card-body">${variant === "A1" ? cardContentsA1(exercise, exerciseIndex) : cardContentsA2(exercise, exerciseIndex)}<button class="secondary full" data-add-set="${exerciseIndex}">+ Legg til sett</button></div>` : ""}
    </article>`;
}

function header() {
  const total = state.exercises.reduce((sum, exercise) => sum + completedCount(exercise), 0);
  return `
    <header class="workout-header">
      <button class="icon-button" aria-label="Tilbake til hovedskjermen">‹</button>
      <div><span class="eyebrow">Pågående</span><h1>Treningsøkt</h1></div>
      <button class="text-button">Ferdig</button>
      <p class="workout-status" aria-live="polite">${total} sett gjennomført totalt</p>
    </header>`;
}

function workout(variant) {
  const note = variant === "A1"
    ? "Gjennomførte og ufullførte sett står i samme rekkefølge, men ferdige rader trekkes sammen."
    : "Gjennomførte sett samles øverst, mens ufullførte sett får en egen arbeidsflate.";
  return `${header()}
    <main class="stack-layout">
      <p class="variant-note">${note}</p>
      ${state.exercises.map((exercise, index) => exerciseCard(exercise, index, index === state.activeExercise, variant)).join("")}
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
  app.innerHTML = `<div class="phone-shell">${workout(variant)}</div>${switcher(variant)}`;
}

function cycle(direction) {
  const keys = Object.keys(variants);
  const index = keys.indexOf(currentVariant());
  const url = new URL(location.href);
  url.searchParams.set("variant", keys[(index + direction + keys.length) % keys.length]);
  history.replaceState({}, "", url);
  render();
}

function indices(value) {
  return value.split(":").map(Number);
}

app.addEventListener("input", (event) => {
  const input = event.target.closest("input[data-field]");
  if (!input) return;
  state.exercises[input.dataset.exerciseIndex].sets[input.dataset.set][input.dataset.field] = input.value;
});

app.addEventListener("click", (event) => {
  const cycleButton = event.target.closest("[data-cycle]");
  if (cycleButton) return cycle(Number(cycleButton.dataset.cycle));

  const exerciseButton = event.target.closest("[data-toggle-exercise]");
  if (exerciseButton) {
    const selected = Number(exerciseButton.dataset.toggleExercise);
    state.activeExercise = state.activeExercise === selected ? null : selected;
    return render();
  }

  const confirmButton = event.target.closest("[data-confirm]");
  if (confirmButton) {
    const [exerciseIndex, setIndex] = indices(confirmButton.dataset.confirm);
    state.exercises[exerciseIndex].sets[setIndex].status = "complete";
    return render();
  }

  const unconfirmButton = event.target.closest("[data-unconfirm]");
  if (unconfirmButton) {
    const [exerciseIndex, setIndex] = indices(unconfirmButton.dataset.unconfirm);
    state.exercises[exerciseIndex].sets[setIndex].status = "suggested";
    return render();
  }

  const removeButton = event.target.closest("[data-remove]");
  if (removeButton) {
    const [exerciseIndex, setIndex] = indices(removeButton.dataset.remove);
    if (state.exercises[exerciseIndex].sets[setIndex].status === "suggested") {
      state.exercises[exerciseIndex].sets.splice(setIndex, 1);
    }
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
