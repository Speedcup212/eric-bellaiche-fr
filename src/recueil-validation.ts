const ACTION_LABELS = ['Enregistrer et continuer', 'Valider le recueil'];

function textOfRequiredContainer(container: HTMLElement) {
  const firstLabel = container.matches('label')
    ? Array.from(container.childNodes).find((node) => node.nodeType === Node.TEXT_NODE)?.textContent
    : container.querySelector(':scope > p')?.textContent;
  return (firstLabel || '').replace('*', '').trim();
}

function getFieldControl(container: HTMLElement) {
  return container.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');
}

function hasSelectedChoice(container: HTMLElement) {
  const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button[type="button"]'));
  return buttons.some((button) => button.className.includes('bg-[#3B82F6]') && button.className.includes('text-white'));
}

function isFieldValid(container: HTMLElement) {
  const label = textOfRequiredContainer(container).toLowerCase();
  const control = getFieldControl(container);

  if (control) {
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

  return hasSelectedChoice(container);
}

function validationMessage(container: HTMLElement) {
  const label = textOfRequiredContainer(container) || 'Information';
  if (label.toLowerCase() === 'mobile') return 'Numéro de mobile obligatoire et valide';
  if (label.toLowerCase() === 'date de naissance') return 'Date de naissance obligatoire et valide';
  return `${label} obligatoire`;
}

function requiredContainers(scope: ParentNode = document) {
  const containers = Array.from(scope.querySelectorAll<HTMLElement>('.recueil-question-grid > label, .recueil-question-grid > div'));
  return containers.filter((container) => {
    if (container.matches('label')) {
      return Array.from(container.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.includes('*'));
    }
    return Boolean(container.querySelector(':scope > p')?.textContent?.includes('*'));
  });
}

function refreshField(container: HTMLElement) {
  const valid = isFieldValid(container);
  if (valid) {
    container.removeAttribute('data-validation-error');
    container.removeAttribute('data-validation-message');
    getFieldControl(container)?.removeAttribute('aria-invalid');
    return;
  }

  container.setAttribute('data-validation-error', 'true');
  container.setAttribute('data-validation-message', validationMessage(container));
  getFieldControl(container)?.setAttribute('aria-invalid', 'true');
}

function markCurrentErrors() {
  const visibleGrids = Array.from(document.querySelectorAll<HTMLElement>('.recueil-question-grid')).filter((grid) => grid.offsetParent !== null);
  const scope = visibleGrids.length ? visibleGrids[0].closest('[class*="space-y"]') || document : document;
  const containers = requiredContainers(scope);
  containers.forEach(refreshField);
  return containers.find((container) => container.getAttribute('data-validation-error') === 'true') || null;
}

function scrollToFirstError() {
  const first = document.querySelector<HTMLElement>('[data-validation-error="true"]');
  if (!first) return;
  first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  getFieldControl(first)?.focus({ preventScroll: true });
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
