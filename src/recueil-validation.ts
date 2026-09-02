const ACTION_LABELS = ['Enregistrer et continuer', 'Valider le recueil'];

function isVisible(element: HTMLElement) {
  return element.offsetParent !== null;
}

function directRequiredText(container: HTMLElement) {
  if (container.matches('label')) {
    return Array.from(container.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || '')
      .join(' ')
      .trim();
  }
  return (
    container.querySelector(':scope > legend')?.textContent ||
    container.querySelector(':scope > p')?.textContent ||
    ''
  ).trim();
}

function textOfRequiredContainer(container: HTMLElement) {
  return directRequiredText(container).replace('*', '').trim();
}

function controlsOf(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea'));
}

function buttonsOf(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button[type="button"]'));
}

function hasSelectedChoice(container: HTMLElement) {
  const buttons = buttonsOf(container);
  return buttons.some((button) => button.getAttribute('aria-pressed') === 'true' || (button.className.includes('bg-[#3B82F6]') && button.className.includes('text-white')));
}

function hasAnyControlValue(container: HTMLElement) {
  const controls = controlsOf(container);
  if (!controls.length) return false;
  return controls.every((control) => String(control.value || '').trim() !== '');
}

function isFieldValid(container: HTMLElement) {
  const label = textOfRequiredContainer(container).toLowerCase();
  const controls = controlsOf(container);

  if (controls.length) {
    if (!hasAnyControlValue(container)) return false;

    for (const control of controls) {
      const value = String(control.value || '').trim();
      if (control instanceof HTMLInputElement && control.type === 'date') {
        const parsed = new Date(`${value}T00:00:00`);
        if (Number.isNaN(parsed.getTime()) || parsed > new Date()) return false;
      }
    }

    if (label === 'mobile') {
      const value = String(controls[0]?.value || '');
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

function candidateRequiredContainers() {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('label, fieldset, div'))
    .filter(isVisible)
    .filter((container) => directRequiredText(container).includes('*'))
    .filter((container) => controlsOf(container).length > 0 || buttonsOf(container).length > 0);

  return candidates.filter((candidate) => !candidates.some((other) => other !== candidate && candidate.contains(other)));
}

function clearErrors() {
  document.querySelectorAll<HTMLElement>('[data-validation-error="true"], [data-validation-group-error="true"]').forEach((element) => {
    element.removeAttribute('data-validation-error');
    element.removeAttribute('data-validation-group-error');
    element.removeAttribute('data-validation-message');
    controlsOf(element).forEach((control) => control.removeAttribute('aria-invalid'));
  });
}

function refreshField(container: HTMLElement) {
  const valid = isFieldValid(container);
  if (valid) {
    container.removeAttribute('data-validation-error');
    container.removeAttribute('data-validation-message');
    controlsOf(container).forEach((control) => control.removeAttribute('aria-invalid'));
    return;
  }

  container.setAttribute('data-validation-error', 'true');
  container.setAttribute('data-validation-message', validationMessage(container));
  controlsOf(container).forEach((control) => control.setAttribute('aria-invalid', 'true'));
}

function markObjectiveGroupIfNeeded() {
  const alert = document.getElementById('recueil-validation-alert');
  const errorText = alert?.textContent || '';
  if (!errorText.includes('Sélectionnez au moins un objectif')) return null;

  const section = document.querySelector<HTMLElement>('section[aria-labelledby="available-objectives-title"]');
  if (!section || !isVisible(section)) return null;
  section.setAttribute('data-validation-group-error', 'true');
  section.setAttribute('data-validation-message', 'Sélectionnez au moins un objectif');
  return section;
}

function markCurrentErrors() {
  clearErrors();
  const containers = candidateRequiredContainers();
  containers.forEach(refreshField);
  const objectiveGroup = markObjectiveGroupIfNeeded();
  return containers.find((container) => container.getAttribute('data-validation-error') === 'true') || objectiveGroup || null;
}

function firstErrorElement() {
  return document.querySelector<HTMLElement>('[data-validation-error="true"], [data-validation-group-error="true"]');
}

function scrollToFirstError() {
  const first = firstErrorElement();
  if (!first) return;
  first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  controlsOf(first)[0]?.focus({ preventScroll: true });
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
  window.setTimeout(() => {
    markCurrentErrors();
    scrollToFirstError();
  }, 220);
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

  const objectiveGroup = target.closest<HTMLElement>('[data-validation-group-error="true"]');
  if (objectiveGroup) {
    window.setTimeout(() => {
      if (objectiveGroup.querySelector('button[aria-pressed="true"]')) {
        objectiveGroup.removeAttribute('data-validation-group-error');
        objectiveGroup.removeAttribute('data-validation-message');
      }
    }, 0);
  }
});

const observer = new MutationObserver(() => {
  if (!document.getElementById('recueil-validation-alert')) return;
  markCurrentErrors();
  window.setTimeout(scrollToFirstError, 120);
});
observer.observe(document.body, { childList: true, subtree: true });
