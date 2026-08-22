import { useEffect, useState } from 'react';

type MissingState = { attempted: boolean; sections: number; fields: number };

function isFilled(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): boolean {
  if (control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio')) return control.checked;
  return control.value.trim() !== '';
}

function selectedChoice(container: HTMLElement): boolean {
  const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
  if (buttons.some((button) => button.getAttribute('aria-pressed') === 'true' || button.className.includes('bg-slate-950') || button.className.includes('bg-[#0b1f3a]'))) return true;
  const controls = Array.from(container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea'));
  return controls.some(isFilled);
}

function findSectionButtons(root: HTMLElement): HTMLButtonElement[] {
  for (const group of Array.from(root.querySelectorAll<HTMLElement>('div'))) {
    const buttons = Array.from(group.children).filter((child): child is HTMLButtonElement => child instanceof HTMLButtonElement);
    if (buttons.length !== 7) continue;
    const valid = buttons.every((button, index) => {
      const text = (button.textContent ?? '').replace('✓', '').trim();
      return text === String(index + 1) || text.startsWith(`${index + 1}.`);
    });
    if (valid) return buttons;
  }
  return [];
}

function scanMissing(root: HTMLElement): { sections: number; fields: number; firstMissing: HTMLElement | null } {
  let fields = 0;
  let firstMissing: HTMLElement | null = null;

  for (const old of Array.from(root.querySelectorAll<HTMLElement>('[data-recueil-missing="1"]'))) old.removeAttribute('data-recueil-missing');
  for (const old of Array.from(root.querySelectorAll<HTMLElement>('[data-recueil-section-missing="1"]'))) old.removeAttribute('data-recueil-section-missing');

  for (const label of Array.from(root.querySelectorAll<HTMLLabelElement>('label'))) {
    if (!(label.textContent ?? '').includes('*')) continue;
    const controls = Array.from(label.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea'));
    if (!controls.length || controls.some(isFilled)) continue;
    label.dataset.recueilMissing = '1';
    fields += 1;
    firstMissing ??= label;
  }

  for (const paragraph of Array.from(root.querySelectorAll<HTMLParagraphElement>('p'))) {
    if (!(paragraph.textContent ?? '').includes('*') || paragraph.closest('label')) continue;
    const container = paragraph.parentElement;
    if (!container || !container.querySelector('button') || selectedChoice(container)) continue;
    container.dataset.recueilMissing = '1';
    fields += 1;
    firstMissing ??= container;
  }

  let sections = 0;
  for (const button of findSectionButtons(root)) {
    const completed = (button.textContent ?? '').includes('✓');
    if (!completed) {
      button.dataset.recueilSectionMissing = '1';
      sections += 1;
    }
  }

  return { sections, fields, firstMissing };
}

export default function RecueilValidationGuard() {
  const [state, setState] = useState<MissingState>({ attempted: false, sections: 0, fields: 0 });

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('main');
    if (!root) return;
    let attempted = false;
    let frame = 0;

    const runScan = (scroll = false) => {
      if (!attempted) return;
      const result = scanMissing(root);
      setState({ attempted: true, sections: result.sections, fields: result.fields });
      if (scroll && (result.sections > 0 || result.fields > 0)) {
        window.requestAnimationFrame(() => {
          const target = result.firstMissing ?? root.querySelector<HTMLElement>('[data-recueil-section-missing="1"]');
          target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    };

    const schedule = (scroll = false) => {
      if (!attempted || frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        runScan(scroll);
      });
    };

    const onClick = (event: Event) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
      if (!button) return;
      if ((button.textContent ?? '').includes('Valider le recueil')) {
        attempted = true;
        window.setTimeout(() => schedule(true), 0);
        window.setTimeout(() => schedule(true), 250);
        return;
      }
      if (attempted) window.setTimeout(() => schedule(false), 0);
    };

    const onInput = () => schedule(false);
    root.addEventListener('click', onClick, true);
    root.addEventListener('input', onInput, true);
    root.addEventListener('change', onInput, true);

    return () => {
      root.removeEventListener('click', onClick, true);
      root.removeEventListener('input', onInput, true);
      root.removeEventListener('change', onInput, true);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  if (!state.attempted || (state.sections === 0 && state.fields === 0)) return null;

  return (
    <div className="mb-5 rounded-2xl border-2 border-red-200 bg-red-50 px-5 py-4 text-red-800 shadow-sm" role="alert">
      <p className="font-semibold">Validation impossible : éléments à compléter</p>
      <p className="mt-1 text-sm leading-6">
        {state.sections > 0 ? `${state.sections} partie${state.sections > 1 ? 's' : ''} non finalisée${state.sections > 1 ? 's' : ''}` : 'Toutes les parties sont enregistrées'}
        {state.fields > 0 ? ` · ${state.fields} champ${state.fields > 1 ? 's' : ''} obligatoire${state.fields > 1 ? 's' : ''} à compléter sur la page affichée.` : '.'}
      </p>
    </div>
  );
}
