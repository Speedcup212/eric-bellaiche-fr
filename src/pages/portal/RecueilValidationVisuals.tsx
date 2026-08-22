import { useEffect } from 'react';

function directButtons(element: Element): HTMLButtonElement[] {
  return Array.from(element.children).filter((child): child is HTMLButtonElement => child instanceof HTMLButtonElement);
}

function findRecueilNavigation(main: HTMLElement): HTMLButtonElement[] {
  for (const element of Array.from(main.querySelectorAll('div'))) {
    const buttons = directButtons(element);
    if (buttons.length !== 7) continue;
    const looksLikeRecueil = buttons.every((button, index) => {
      const text = (button.textContent ?? '').replace('✓', '').replace('⚠', '').trim();
      return text === String(index + 1) || text.startsWith(`${index + 1}.`);
    });
    if (looksLikeRecueil) return buttons;
  }
  return [];
}

function hasValue(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): boolean {
  if (control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio')) return control.checked;
  return control.value.trim() !== '';
}

function selectedChoice(container: Element): boolean {
  const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
  const selectedButton = buttons.some((button) => {
    const className = button.className;
    return button.getAttribute('aria-pressed') === 'true' || className.includes('bg-slate-950') || className.includes('bg-[#0b1f3a]') || className.includes('bg-[#173967]');
  });
  if (selectedButton) return true;
  return Array.from(container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')).some(hasValue);
}

function setMissingStyle(element: HTMLElement, missing: boolean) {
  element.dataset.recueilMissing = missing ? '1' : '0';
  element.style.boxShadow = missing ? '0 0 0 2px rgba(220,38,38,.28)' : '';
  element.style.borderColor = missing ? 'rgb(248 113 113)' : '';

  const existing = Array.from(element.children).find((child) => child instanceof HTMLElement && child.dataset.recueilMissingLabel === '1') as HTMLElement | undefined;
  if (missing && !existing) {
    const badge = document.createElement('span');
    badge.dataset.recueilMissingLabel = '1';
    badge.className = 'mt-2 inline-flex rounded-lg bg-red-700 px-2.5 py-1 text-xs font-bold text-white';
    badge.textContent = 'À compléter';
    element.append(badge);
  } else if (!missing && existing) {
    existing.remove();
  }
}

function highlightCurrentRequiredFields(main: HTMLElement): number {
  let missingCount = 0;

  for (const label of Array.from(main.querySelectorAll<HTMLLabelElement>('label'))) {
    if (!(label.textContent ?? '').includes('*')) continue;
    const controls = Array.from(label.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea'));
    if (controls.length === 0) continue;
    const missing = !controls.some(hasValue);
    setMissingStyle(label, missing);
    if (missing) missingCount += 1;
  }

  for (const paragraph of Array.from(main.querySelectorAll<HTMLParagraphElement>('p'))) {
    if (!(paragraph.textContent ?? '').includes('*')) continue;
    if (paragraph.closest('label')) continue;
    const container = paragraph.parentElement;
    if (!container) continue;
    const buttons = container.querySelectorAll('button');
    if (buttons.length === 0) continue;
    const missing = !selectedChoice(container);
    setMissingStyle(container, missing);
    if (missing) missingCount += 1;
  }

  return missingCount;
}

function markIncompleteNavigation(buttons: HTMLButtonElement[]): number {
  let incomplete = 0;
  for (const button of buttons) {
    const completed = (button.textContent ?? '').includes('✓');
    if (!completed) incomplete += 1;
    button.dataset.recueilValidationMissing = completed ? '0' : '1';
    button.style.backgroundColor = completed ? '' : 'rgb(254 242 242)';
    button.style.color = completed ? '' : 'rgb(185 28 28)';
    button.style.borderColor = completed ? '' : 'rgb(252 165 165)';
    button.style.boxShadow = completed ? '' : '0 0 0 1px rgba(248,113,113,.35)';
    if (!completed) button.title = 'Cette partie doit être complétée ou enregistrée avant validation.';
  }
  return incomplete;
}

function updateSummary(main: HTMLElement, incompleteParts: number, visibleMissingFields: number) {
  const validateButton = Array.from(main.querySelectorAll<HTMLButtonElement>('button')).find((button) => (button.textContent ?? '').includes('Valider le recueil'));
  const card = validateButton?.closest('section');
  const content = card?.querySelector<HTMLElement>('.space-y-6');
  if (!content) return;

  let summary = content.querySelector<HTMLElement>('[data-recueil-validation-summary="1"]');
  if (incompleteParts === 0 && visibleMissingFields === 0) {
    summary?.remove();
    return;
  }

  if (!summary) {
    summary = document.createElement('div');
    summary.dataset.recueilValidationSummary = '1';
    summary.className = 'rounded-2xl border-2 border-red-200 bg-red-50 p-5 text-red-800';
    content.prepend(summary);
  }

  const partsLabel = `${incompleteParts} partie${incompleteParts > 1 ? 's' : ''} à compléter ou enregistrer`;
  const fieldsLabel = visibleMissingFields > 0 ? ` · ${visibleMissingFields} champ${visibleMissingFields > 1 ? 's' : ''} visible${visibleMissingFields > 1 ? 's' : ''} à compléter sur cette page` : '';
  const html = `<p class="font-semibold">Validation impossible : éléments à compléter</p><p class="mt-1 text-sm leading-6">${partsLabel}${fieldsLabel}. Les repères et champs concernés sont signalés en rouge.</p>`;
  if (summary.innerHTML !== html) summary.innerHTML = html;
}

export default function RecueilValidationVisuals() {
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('main');
    if (!main) return;

    let attempted = false;
    let frame = 0;

    const scan = () => {
      frame = 0;
      if (!attempted) return;
      const navigation = findRecueilNavigation(main);
      const incompleteParts = markIncompleteNavigation(navigation);
      const visibleMissingFields = highlightCurrentRequiredFields(main);
      updateSummary(main, incompleteParts, visibleMissingFields);
    };

    const scheduleScan = () => {
      if (!attempted || frame) return;
      frame = window.requestAnimationFrame(scan);
    };

    const onClick = (event: Event) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
      if (!target) return;
      if ((target.textContent ?? '').includes('Valider le recueil')) attempted = true;
      if (attempted) {
        scheduleScan();
        window.setTimeout(scheduleScan, 250);
      }
    };

    main.addEventListener('click', onClick, true);
    const observer = new MutationObserver(scheduleScan);
    observer.observe(main, { childList: true, subtree: true });

    return () => {
      main.removeEventListener('click', onClick, true);
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
