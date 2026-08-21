import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const monthCodes = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] as const;
const recueilStepLabels = ['Identité', 'Famille', 'Profession', 'Objectifs', 'Revenus', 'Réglementaire', 'Patrimoine'] as const;

function normalizedMobile(value: string): { compact: string; digits: string } {
  const compact = value.trim().replace(/[\s().-]/g, '');
  return { compact, digits: compact.replace(/\D/g, '') };
}

function isValidMobile(value: string): boolean {
  const { compact, digits } = normalizedMobile(value);
  if (!digits) return false;
  if (['0000000000', '0123456789', '1234567890'].includes(digits)) return false;
  if (/^(\d)\1+$/.test(digits) && digits.length >= 8) return false;
  if (/^0[67]\d{8}$/.test(compact)) return true;
  if (/^\+33[67]\d{8}$/.test(compact)) return true;
  return /^\+[1-9]\d{7,14}$/.test(compact);
}

function replaceLabelText(label: HTMLLabelElement, from: string, to: string) {
  for (const node of Array.from(label.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.includes(from)) {
      node.textContent = node.textContent.replace(from, to);
      return;
    }
  }
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function createOption(value: string, label: string): HTMLOptionElement {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

function directChild<T extends Element>(element: Element, tagName: string): T | null {
  return (Array.from(element.children).find((child) => child.tagName === tagName.toUpperCase()) as T | undefined) ?? null;
}

export default function RecueilUxEnhancements() {
  useEffect(() => {
    let stopped = false;
    let frame = 0;
    let accountEmail = '';

    const styleQuestions = (labels: HTMLLabelElement[]) => {
      for (const label of labels) {
        if (label.closest('[data-french-month-year="1"]')) continue;
        const input = directChild<HTMLInputElement>(label, 'input');
        const textarea = directChild<HTMLTextAreaElement>(label, 'textarea');
        if (!input && !textarea) continue;
        if (label.dataset.premiumQuestion === '1') continue;
        label.dataset.premiumQuestion = '1';
        label.className = 'block rounded-2xl bg-[#0b1f3a] p-3 text-sm font-semibold text-white shadow-sm ring-1 ring-[#173967]/15';
        const control = input ?? textarea;
        control?.classList.add('text-slate-800');
      }

      const paragraphs = Array.from(document.querySelectorAll<HTMLParagraphElement>('main p'));
      for (const paragraph of paragraphs) {
        const parent = paragraph.parentElement;
        if (!parent || parent.dataset.premiumChoiceQuestion === '1') continue;
        const directButtons = Array.from(parent.children).some((child) => child.tagName === 'DIV' && child.querySelector('button'));
        if (!directButtons) continue;
        const text = paragraph.textContent?.trim() ?? '';
        if (!text || text.length > 220) continue;
        parent.dataset.premiumChoiceQuestion = '1';
        parent.classList.add('rounded-2xl', 'bg-[#0b1f3a]', 'p-3', 'text-white', 'shadow-sm', 'ring-1', 'ring-[#173967]/15');
        paragraph.className = 'text-sm font-semibold text-white';
      }
    };

    const enhanceRecueilNavigation = () => {
      const groups = Array.from(document.querySelectorAll<HTMLDivElement>('main div.flex.flex-wrap.gap-2'));
      for (const group of groups) {
        const buttons = Array.from(group.children).filter((child): child is HTMLButtonElement => child instanceof HTMLButtonElement);
        if (buttons.length !== recueilStepLabels.length) continue;
        const normalized = buttons.map((button) => (button.textContent ?? '').replace('✓', '').trim().match(/^\d+/)?.[0] ?? '');
        if (!normalized.every((value, index) => value === String(index + 1))) continue;
        group.classList.add('flex-nowrap', 'overflow-x-auto', 'pb-1');
        buttons.forEach((button, index) => {
          const done = (button.textContent ?? '').includes('✓');
          const desired = `${done ? '✓ ' : ''}${index + 1}. ${recueilStepLabels[index]}`;
          if (button.textContent !== desired) button.textContent = desired;
          button.classList.add('shrink-0', 'whitespace-nowrap');
          button.title = recueilStepLabels[index];
        });
        break;
      }
    };

    const enhanceDateEntry = (labels: HTMLLabelElement[]) => {
      const oldDateLabel = labels.find((label) => label.textContent?.includes('Depuis quelle date travaillez-vous dans cette entreprise / activité ?'));
      if (oldDateLabel) replaceLabelText(oldDateLabel, 'Depuis quelle date travaillez-vous dans cette entreprise / activité ?', 'Date d’entrée dans l’entreprise : mois / année');

      const dateLabel = labels.find((label) => label.textContent?.includes('Date d’entrée dans l’entreprise : mois / année'));
      const input = dateLabel?.querySelector<HTMLInputElement>('input');
      if (!dateLabel || !input) return;

      dateLabel.dataset.premiumQuestion = '1';
      dateLabel.className = 'block rounded-2xl bg-[#0b1f3a] p-3 text-sm font-semibold text-white shadow-sm ring-1 ring-[#173967]/15';
      input.style.display = 'none';
      input.tabIndex = -1;
      input.setAttribute('aria-hidden', 'true');

      let wrapper = dateLabel.querySelector<HTMLDivElement>('[data-french-month-year="1"]');
      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.dataset.frenchMonthYear = '1';
        wrapper.className = 'mt-3 rounded-xl bg-white p-3 text-slate-700';

        const help = document.createElement('p');
        help.className = 'mb-2 text-xs font-normal leading-5 text-slate-500';
        help.textContent = 'Sélectionnez le mois puis l’année. Exemple : 05/2015.';

        const row = document.createElement('div');
        row.className = 'grid grid-cols-[1fr_auto_1fr] items-end gap-2';

        const monthBox = document.createElement('div');
        const monthCaption = document.createElement('span');
        monthCaption.className = 'block text-xs font-medium text-slate-600';
        monthCaption.textContent = 'Mois';
        const monthSelect = document.createElement('select');
        monthSelect.dataset.monthSelect = '1';
        monthSelect.className = 'mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-normal text-slate-800 outline-none transition focus:border-[#6f8fb4] focus:bg-white';
        monthSelect.append(createOption('', 'MM'));
        for (const code of monthCodes) monthSelect.append(createOption(code, code));
        monthBox.append(monthCaption, monthSelect);

        const yearBox = document.createElement('div');
        const yearCaption = document.createElement('span');
        yearCaption.className = 'block text-xs font-medium text-slate-600';
        yearCaption.textContent = 'Année';
        const yearSelect = document.createElement('select');
        yearSelect.dataset.yearSelect = '1';
        yearSelect.className = 'mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-normal text-slate-800 outline-none transition focus:border-[#6f8fb4] focus:bg-white';
        yearSelect.append(createOption('', 'AAAA'));
        const currentYear = new Date().getFullYear();
        for (let year = currentYear; year >= 1940; year -= 1) yearSelect.append(createOption(String(year), String(year)));
        yearBox.append(yearCaption, yearSelect);

        const separator = document.createElement('span');
        separator.className = 'pb-3 text-lg font-semibold text-slate-500';
        separator.textContent = '/';

        const commit = () => {
          const month = monthSelect.value;
          const year = yearSelect.value;
          if (month && year) {
            setReactInputValue(input, `${year}-${month}`);
          } else if (input.value) {
            setReactInputValue(input, '');
          }
        };
        monthSelect.addEventListener('change', commit);
        yearSelect.addEventListener('change', commit);

        row.append(monthBox, separator, yearBox);
        wrapper.append(help, row);
        dateLabel.append(wrapper);
      }

      const monthSelect = wrapper.querySelector<HTMLSelectElement>('[data-month-select="1"]');
      const yearSelect = wrapper.querySelector<HTMLSelectElement>('[data-year-select="1"]');
      const match = /^(\d{4})-(0[1-9]|1[0-2])/.exec(input.value);
      if (match) {
        if (yearSelect && yearSelect.value !== match[1]) yearSelect.value = match[1];
        if (monthSelect && monthSelect.value !== match[2]) monthSelect.value = match[2];
      } else if (input.dataset.dateSanitized !== '1') {
        input.dataset.dateSanitized = '1';
        setReactInputValue(input, '');
        if (yearSelect) yearSelect.value = '';
        if (monthSelect) monthSelect.value = '';
      }
    };

    const enhance = () => {
      if (stopped) return;
      const labels = Array.from(document.querySelectorAll<HTMLLabelElement>('main label'));

      const mobileLabel = labels.find((label) => label.textContent?.trim().startsWith('Mobile'));
      const mobileInput = mobileLabel?.querySelector<HTMLInputElement>('input');
      if (mobileInput && mobileInput.dataset.contactGuard !== '1') {
        mobileInput.dataset.contactGuard = '1';
        mobileInput.inputMode = 'tel';
        mobileInput.placeholder = '06 12 34 56 78 ou +33 6 12 34 56 78';
        const validate = () => {
          if (!mobileInput.value) mobileInput.setCustomValidity('Indiquez votre numéro de mobile.');
          else if (!isValidMobile(mobileInput.value)) mobileInput.setCustomValidity('Numéro de mobile invalide. Les numéros fictifs comme 0000000000 sont refusés.');
          else mobileInput.setCustomValidity('');
        };
        mobileInput.addEventListener('input', validate);
        mobileInput.addEventListener('blur', () => { validate(); if (!mobileInput.checkValidity()) mobileInput.reportValidity(); });
        validate();
      }

      const existingEmail = document.querySelector<HTMLInputElement>('[data-secure-email-field="1"] input');
      if (existingEmail && accountEmail && existingEmail.value !== accountEmail) existingEmail.value = accountEmail;

      if (mobileLabel && accountEmail && !document.querySelector('[data-secure-email-field="1"]')) {
        const emailLabel = document.createElement('label');
        emailLabel.dataset.secureEmailField = '1';
        emailLabel.dataset.premiumQuestion = '1';
        emailLabel.className = 'block rounded-2xl bg-[#0b1f3a] p-3 text-sm font-semibold text-white shadow-sm ring-1 ring-[#173967]/15';
        emailLabel.append(document.createTextNode('E-mail *'));
        const emailInput = document.createElement('input');
        emailInput.type = 'email';
        emailInput.readOnly = true;
        emailInput.value = accountEmail;
        emailInput.className = 'mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-700 outline-none';
        emailInput.title = 'Cette adresse correspond à votre accès sécurisé.';
        emailLabel.append(emailInput);
        const help = document.createElement('span');
        help.className = 'mt-1.5 block text-xs font-normal leading-5 text-blue-100';
        help.textContent = 'Adresse liée à votre accès sécurisé : elle est reprise automatiquement afin d’éviter une erreur de saisie.';
        emailLabel.append(help);
        mobileLabel.insertAdjacentElement('afterend', emailLabel);
      }

      const companyLabel = labels.find((label) => label.textContent?.includes('Société / employeur'));
      if (companyLabel) replaceLabelText(companyLabel, 'Société / employeur', 'Entreprise');

      enhanceDateEntry(labels);
      enhanceRecueilNavigation();
      styleQuestions(labels);
    };

    const scheduleEnhance = () => {
      if (stopped || frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        enhance();
      });
    };

    void supabase.auth.getUser().then(({ data }) => {
      accountEmail = data.user?.email ?? '';
      scheduleEnhance();
    });

    const observer = new MutationObserver(scheduleEnhance);
    const root = document.querySelector('main') ?? document.body;
    observer.observe(root, { childList: true, subtree: true });
    scheduleEnhance();

    return () => {
      stopped = true;
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
