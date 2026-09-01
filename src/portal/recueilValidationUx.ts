type MissingField = {
  label: string;
  wrapper: HTMLElement;
  focusTarget: HTMLElement | null;
};

const normalizeLabel = (value: string) => value.replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '').trim();

const isVisible = (element: HTMLElement) => {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
};

const isEmptyControl = (control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => {
  if (control.disabled) return false;
  if (control instanceof HTMLInputElement && ['checkbox', 'radio'].includes(control.type)) return !control.checked;
  return String(control.value ?? '').trim() === '';
};

const selectedChoiceExists = (wrapper: HTMLElement) => {
  const pressed = Array.from(wrapper.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'));
  if (pressed.length) return pressed.some((button) => button.getAttribute('aria-pressed') === 'true');

  const buttons = Array.from(wrapper.querySelectorAll<HTMLButtonElement>('button[type="button"]'));
  if (!buttons.length) return true;
  return buttons.some((button) => button.className.includes('scale-[0.97]') || button.className.includes('scale-[0.98]'));
};

const labelForWrapper = (wrapper: HTMLElement) => {
  if (wrapper instanceof HTMLLabelElement) {
    const clone = wrapper.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input,select,textarea,button,svg,span').forEach((node) => node.remove());
    return normalizeLabel(clone.textContent ?? '');
  }
  const legend = wrapper.querySelector(':scope > legend');
  if (legend) return normalizeLabel(legend.textContent ?? '');
  const paragraph = wrapper.querySelector(':scope > p');
  return normalizeLabel(paragraph?.textContent ?? '');
};

const findMissingFields = (): MissingField[] => {
  const result: MissingField[] = [];
  const seen = new Set<HTMLElement>();

  document.querySelectorAll<HTMLElement>('label, fieldset, div').forEach((wrapper) => {
    if (!isVisible(wrapper)) return;

    const directTitle = wrapper instanceof HTMLLabelElement
      ? wrapper.textContent ?? ''
      : (wrapper.querySelector(':scope > legend, :scope > p')?.textContent ?? '');
    if (!/\*\s*$/.test(directTitle.trim())) return;

    const controls = Array.from(wrapper.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea'))
      .filter((control) => isVisible(control));

    let missing = false;
    let focusTarget: HTMLElement | null = null;

    if (controls.length) {
      const relevant = controls.filter((control) => {
        if (control.disabled) return false;
        if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) return !control.readOnly;
        return true;
      });
      if (relevant.length) {
        missing = relevant.every(isEmptyControl);
        focusTarget = relevant[0] ?? null;
      }
    } else {
      const buttons = Array.from(wrapper.querySelectorAll<HTMLButtonElement>('button[type="button"], button[aria-pressed]')).filter(isVisible);
      if (buttons.length) {
        missing = !selectedChoiceExists(wrapper);
        focusTarget = buttons[0] ?? null;
      }
    }

    if (!missing || seen.has(wrapper)) return;
    const label = labelForWrapper(wrapper);
    if (!label) return;
    seen.add(wrapper);
    result.push({ label, wrapper, focusTarget });
  });

  return result;
};

const clearHighlights = () => {
  document.querySelectorAll<HTMLElement>('[data-validation-error="true"]').forEach((element) => {
    element.removeAttribute('data-validation-error');
  });
};

let scrollTimer: number | null = null;
let lastAlertText = '';

const enhanceValidationAlert = () => {
  const alert = document.getElementById('recueil-validation-alert');
  if (!alert) {
    clearHighlights();
    lastAlertText = '';
    return;
  }

  const missing = findMissingFields();
  clearHighlights();
  missing.forEach(({ wrapper }) => wrapper.setAttribute('data-validation-error', 'true'));

  if (!missing.length) return;

  const labels = [...new Set(missing.map(({ label }) => label))];
  const detail = labels.length === 1
    ? `1 information reste à compléter : ${labels[0]}.`
    : `${labels.length} informations restent à compléter : ${labels.join(', ')}.`;

  const paragraphs = alert.querySelectorAll('p');
  const messageNode = paragraphs.length > 1 ? paragraphs[1] : null;
  if (messageNode && messageNode.textContent !== detail) messageNode.textContent = detail;

  const signature = `${detail}|${labels[0]}`;
  if (signature === lastAlertText) return;
  lastAlertText = signature;

  if (scrollTimer) window.clearTimeout(scrollTimer);
  scrollTimer = window.setTimeout(() => {
    const first = missing[0];
    first.wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => first.focusTarget?.focus({ preventScroll: true }), 350);
  }, 80);
};

export function installRecueilValidationUx() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const schedule = () => window.requestAnimationFrame(enhanceValidationAlert);
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('input', schedule, true);
  document.addEventListener('change', schedule, true);
  document.addEventListener('click', schedule, true);
  schedule();
}
