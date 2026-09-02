const ACTION_LABELS = ['Enregistrer et continuer', 'Valider le recueil'];

function directText(container: HTMLElement) {
  return Array.from(container.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent || '')
    .join(' ')
    .trim();
}

function textOfRequiredContainer(container: HTMLElement) {
  let raw = '';
  if (container.matches('label')) raw = directText(container);
  else if (container.matches('fieldset')) raw = container.querySelector(':scope > legend')?.textContent || '';
  else raw = container.querySelector(':scope > p')?.textContent || '';
  return raw.replace(/\s*\*\s*$/, '').replace('*', '').trim();
}

function controlsOf(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea'));
}

function hasSelectedChoice(container: HTMLElement) {
  const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button[type="button"]'));
  return buttons.some((button) => button.getAttribute('aria-pressed') === 'true' || (button.className.includes('bg-[#3B82F6]') && button.className.includes('text-white')));
}

function isControlValid(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, label: string) {
  const value = String(control.value || '').trim();
  if (!value) return false;

  if (control instanceof HTMLInputElement && control.type === 'date') {
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime()) || parsed > new Date()) return false;
  }

  if (label === 'mobile') {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 10 || /^0+$/.test(digits)) return false;
  }

  return true;
}

function isFieldValid(container: HTMLElement) {
  const label = textOfRequiredContainer(container).toLowerCase();
  const controls = controlsOf(container);

  if (controls.length > 0) {
    return controls.every((control) => isControlValid(control, label));
  }

  return hasSelectedChoice(container);
}

function validationMessage(container: HTMLElement) {
  const label = textOfRequiredContainer(container) || 'Information';
  const normalized = label.toLowerCase();
  if (normalized === 'mobile') return 'Numéro de mobile obligatoire et valide';
  if (normalized === 'date de naissance') return 'Date de naissance obligatoire et valide';
  if (normalized.includes('date d’entrée')) return 'Mois et année d’entrée obligatoires';
  return `${label} obligatoire`;
}

function hasRequiredMarker(container: HTMLElement) {
  if (container.matches('label')) return directText(container).includes('*');
  if (container.matches('fieldset')) return Boolean(container.querySelector(':scope > legend')?.textContent?.includes('*'));
  return Boolean(container.querySelector(':scope > p')?.textContent?.includes('*'));
}

function requiredContainers(scope: ParentNode = document) {
  const candidates = Array.from(scope.querySelectorAll<HTMLElement>('label, fieldset, div'));
  return candidates.filter((container) => {
    if (container.offsetParent === null) return false;
    if (!hasRequiredMarker(container)) return false;
    if (container.closest('#recueil-validation-alert')) return false;
    if (container.matches('div') && !container.querySelector(':scope > p')) return false;
    return true;
  });
}

function refreshField(container: HTMLElement) {
  const valid = isFieldValid(container);
  const controls = controlsOf(container);

  if (valid) {
    container.removeAttribute('data-validation-error');
    container.removeAttribute('data-validation-message');
    controls.forEach((control) => control.removeAttribute('aria-invalid'));
    return;
  }

  container.setAttribute('data-validation-error', 'true');
  container.setAttribute('data-validation-message', validationMessage(container));
  controls.forEach((control) => control.setAttribute('aria-invalid', 'true'));
}

function markCurrentErrors() {
  document.querySelectorAll<HTMLElement>('[data-validation-error="true"]').forEach((node) => {
    node.removeAttribute('data-validation-error');
    node.removeAttribute('data-validation-message');
  });

  const containers = requiredContainers(document);
  containers.forEach(refreshField);
  return containers.find((container) => container.getAttribute('data-validation-error') === 'true') || null;
}

function firstFocusable(container: HTMLElement) {
  return container.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>('input, select, textarea, button[type="button"]');
}

function scrollToFirstError() {
  const first = document.querySelector<HTMLElement>('[data-validation-error="true"]');
  if (!first) return;
  first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  firstFocusable(first)?.focus({ preventScroll: true });
}

function isValidationAction(target: EventTarget | null) {
  const button = target instanceof Element ? target.closest('button') : null;
  if (!(button instanceof HTMLButtonElement)) return false;
  return ACTION_LABELS.some((label) => button.textContent?.includes(label));
}

document.addEventListener('click', (event) => {
  if (!isValidationAction(event.target)) return;
  const first = markCurrentErrors();
  if (!first) return;
  window.setTimeout(scrollToFirstError, 80);
  window.setTimeout(scrollToFirstError, 180);
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const container = target.closest<HTMLElement>('[data-validation-error="true"]');
  if (container) refreshField(container);
});

document.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const container = target.closest<HTMLElement>('[data-validation-error="true"]');
  if (container) refreshField(container);
});

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const container = target.closest<HTMLElement>('[data-validation-error="true"]');
  if (container) window.setTimeout(() => refreshField(container), 0);
});

const observer = new MutationObserver(() => {
  if (!document.getElementById('recueil-validation-alert')) return;
  markCurrentErrors();
  window.setTimeout(scrollToFirstError, 120);
});
observer.observe(document.body, { childList: true, subtree: true });
