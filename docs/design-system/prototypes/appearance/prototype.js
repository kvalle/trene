const variants = [
  {
    key: 'checkmark',
    short: 'A',
    title: 'Hakemerke',
    description: 'Valgt rad markeres med et tydelig hakemerke til høyre.',
  },
  {
    key: 'radio',
    short: 'B',
    title: 'Radiokontroll',
    description: 'En kjent radiokontroll foran etiketten viser at valgene hører sammen.',
  },
  {
    key: 'highlight',
    short: 'C',
    title: 'Uthevet rad',
    description: 'Hele den valgte raden får en tydelig flate, kant og statusmarkør.',
  },
];

const options = [
  { value: 'system', label: 'Følg telefonen' },
  { value: 'light', label: 'Lys' },
  { value: 'dark', label: 'Mørk' },
];

const params = new URLSearchParams(window.location.search);
let variantIndex = Math.max(0, variants.findIndex(({ key }) => key === params.get('variant')));
let selectedValue = 'system';

function labelForVariant(variant) {
  return `${variant.short} - ${variant.title}`;
}

function updateUrl() {
  const nextParams = new URLSearchParams(window.location.search);
  nextParams.set('variant', variants[variantIndex].key);
  window.history.replaceState({}, '', `${window.location.pathname}?${nextParams}`);
}

function renderChoices(focusValue) {
  const group = document.querySelector('#choice-group');
  group.innerHTML = options.map(({ value, label }) => {
    const selected = value === selectedValue;
    const checkmark = variants[variantIndex].key === 'checkmark' && selected ? '✓' : '';
    return `<button class="choice-row" type="button" role="radio" aria-checked="${selected}" data-value="${value}">
      <span class="choice-label">${label}</span>
      <span class="choice-indicator" aria-hidden="true">${checkmark}</span>
    </button>`;
  }).join('');

  group.querySelectorAll('.choice-row').forEach((button) => {
    button.addEventListener('click', () => {
      selectedValue = button.dataset.value;
      renderChoices(button.dataset.value);
      renderState();
    });
  });

  if (focusValue) group.querySelector(`[data-value="${focusValue}"]`).focus();
}

function renderState() {
  const variant = variants[variantIndex];
  const variantLabel = labelForVariant(variant);
  document.body.className = `variant-${variant.key}`;
  document.querySelector('#variant-title').textContent = variantLabel;
  document.querySelector('#variant-description').textContent = variant.description;
  document.querySelector('#switcher-label').textContent = variantLabel;
  document.querySelector('#state-variant').textContent = variantLabel;
  document.querySelector('#state-theme').textContent = document.documentElement.dataset.theme === 'dark' ? 'Mørk' : 'Lys';
  document.querySelector('#state-text').textContent = document.documentElement.dataset.textSize === 'large' ? 'Stor' : 'Normal';
  document.querySelector('#state-selection').textContent = options.find(({ value }) => value === selectedValue).label;
}

function selectVariant(offset) {
  variantIndex = (variantIndex + offset + variants.length) % variants.length;
  updateUrl();
  renderChoices();
  renderState();
}

document.querySelector('#previous-variant').addEventListener('click', () => selectVariant(-1));
document.querySelector('#next-variant').addEventListener('click', () => selectVariant(1));

document.querySelector('#choice-group').addEventListener('keydown', (event) => {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  const offset = ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1;
  const selectedIndex = options.findIndex(({ value }) => value === selectedValue);
  selectedValue = options[(selectedIndex + offset + options.length) % options.length].value;
  renderChoices(selectedValue);
  renderState();
});

document.querySelectorAll('[data-theme-option]').forEach((button) => {
  button.addEventListener('click', () => {
    document.documentElement.dataset.theme = button.dataset.themeOption;
    document.querySelectorAll('[data-theme-option]').forEach((option) => {
      option.setAttribute('aria-pressed', option === button);
    });
    renderState();
  });
});

document.querySelectorAll('[data-text-option]').forEach((button) => {
  button.addEventListener('click', () => {
    document.documentElement.dataset.textSize = button.dataset.textOption;
    document.querySelectorAll('[data-text-option]').forEach((option) => {
      option.setAttribute('aria-pressed', option === button);
    });
    renderState();
  });
});

document.addEventListener('keydown', (event) => {
  const target = event.target;
  if (target.matches('button, input, textarea, [contenteditable="true"]')) return;
  if (event.key === 'ArrowLeft') selectVariant(-1);
  if (event.key === 'ArrowRight') selectVariant(1);
});

updateUrl();
renderChoices();
renderState();
