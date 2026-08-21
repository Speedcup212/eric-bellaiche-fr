import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const frenchMonths = [
  ['01', 'Janvier'],
  ['02', 'Février'],
  ['03', 'Mars'],
  ['04', 'Avril'],
  ['05', 'Mai'],
  ['06', 'Juin'],
  ['07', 'Juillet'],
  ['08', 'Août'],
  ['09', 'Septembre'],
  ['10', 'Octobre'],
  ['11', 'Novembre'],
  ['12', 'Décembre'],
] as const;

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

export default function RecueilUxEnhancements() {
  useEffect(() => {
    let stopped = false;
    let accountEmail = '';

    const enhanceDateEntry = (labels: HTMLLabelElement[]) => {
      const oldDateLabel = labels.find((label) => label.textContent?.includes('Depuis quelle date travaillez-vous dans cette entreprise / activité ?'));
      if (oldDateLabel) replaceLabelText(oldDateLabel, 'Depuis quelle date travaillez-vous dans cette entreprise / activité ?', 'Date d’entrée dans l’entreprise : mois / année');

      const dateLabel = labels.find((label) => label.textContent?.includes('Date d’entrée dans l’entreprise : mois / année'));
      const input = dateLabel?.querySelector<HTMLInputElement>('input');
      if (!dateLabel || !input) return;

      input.style.display = 'none';
      input.tabIndex = -1;
      input.setAttribute('aria-hidden', 'true');

      let wrapper = dateLabel.querySelector<HTMLDivElement>('[data-french-month-year="1"]');
      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.dataset.frenchMonthYear = '1';
        wrapper.className = 'mt-2 grid grid-cols-[1fr_auto_1fr] items-end gap-2';

        const monthBox = document.createElement('div');
        const monthCaption = document.createElement('span');
        monthCaption.className = 'block text-xs font-medium text-slate-600';
        monthCaption.textContent = 'Mois';
        const monthSelect = document.createElement('select');
        monthSelect.dataset.monthSelect = '1';
        monthSelect.className = 'mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-normal text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white';
        monthSelect.append(createOption('', 'Choisir le mois'));
        for (const [code] of frenchMonths) monthSelect.append(createOption(code, code));
        monthBox.append(monthCaption, monthSelect);

        const yearBox = document.createElement('div');
        const yearCaption = document.createElement('span');
        yearCaption.className = 'block text-xs font-medium text-slate-600';
        yearCaption.textContent = 'Année';
        const yearSelect = document.createElement('select');
        yearSelect.dataset.yearSelect = '1';
        yearSelect.className = 'mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-normal text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white';
        yearSelect.append(createOption('', 'Choisir l’année'));
        const currentYear = new Date().getFullYear();
        for (let year = currentYear; year >= 1940; year -= 1) yearSelect.append(createOption(String(year), String(year)));
        yearBox.append(yearCaption, yearSelect);

        const commit = () => {
          const month = monthSelect.value;
          const year = yearSelect.value;
          setReactInputValue(input, month && year ? `${year}-${month}` : '');
        };
        monthSelect.addEventListener('change', commit);
        yearSelect.addEventListener('change', commit);

        const separator = document.createElement('span');
        separator.className = 'pb-3 text-base font-semibold text-slate-500';
        separator.textContent = '/';
        wrapper.append(monthBox, separator, yearBox);
        dateLabel.append(wrapper);
      }

      const monthSelect = wrapper.querySelector<HTMLSelectElement>('[data-month-select="1"]');
      const yearSelect = wrapper.querySelector<HTMLSelectElement>('[data-year-select="1"]');
      const match = /^(\d{4})-(0[1-9]|1[0-2])/.exec(input.value);
      if (match) {
        if (yearSelect && yearSelect.value !== match[1]) yearSelect.value = match[1];
        if (monthSelect && monthSelect.value !== match[2]) monthSelect.value = match[2];
      } else if (input.value) {
        setReactInputValue(input, '');
        if (yearSelect) yearSelect.value = '';
        if (monthSelect) monthSelect.value = '';
      }
    };

    const enhance = () => {
      if (stopped) return;
      const labels = Array.from(document.querySelectorAll<HTMLLabelElement>('label'));

      const mobileLabel = labels.find((label) => label.textContent?.trim().startsWith('Mobile'));
      const mobileInput = mobileLabel?.querySelector<HTMLInputElement>('input');
      if (mobileInput && mobileInput.dataset.contactGuard !== '1') {
        mobileInput.dataset.contactGuard = '1';
        mobileInput.inputMode = 'tel';
        mobileInput.placeholder = '06 12 34 56 78 ou +33 6 12 34 56 78';
        const validate = () => {
          if (!mobileInput.value) {
            mobileInput.setCustomValidity('Indiquez votre numéro de mobile.');
          } else if (!isValidMobile(mobileInput.value)) {
            mobileInput.setCustomValidity('Numéro de mobile invalide. Les numéros fictifs comme 0000000000 sont refusés.');
          } else {
            mobileInput.setCustomValidity('');
          }
        };
        mobileInput.addEventListener('input', validate);
        mobileInput.addEventListener('blur', () => { validate(); if (!mobileInput.checkValidity()) mobileInput.reportValidity(); });
        validate();
      }

      const existingEmail = document.querySelector<HTMLInputElement>('[data-secure-email-field="1"] input');
      if (existingEmail && accountEmail) existingEmail.value = accountEmail;

      if (mobileLabel && accountEmail && !document.querySelector('[data-secure-email-field="1"]')) {
        const emailLabel = document.createElement('label');
        emailLabel.dataset.secureEmailField = '1';
        emailLabel.className = 'text-sm font-semibold text-slate-700';
        emailLabel.append(document.createTextNode('E-mail *'));
        const emailInput = document.createElement('input');
        emailInput.type = 'email';
        emailInput.readOnly = true;
        emailInput.value = accountEmail;
        emailInput.className = 'mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-700 outline-none';
        emailInput.title = 'Cette adresse correspond à votre accès sécurisé.';
        emailLabel.append(emailInput);
        const help = document.createElement('span');
        help.className = 'mt-1.5 block text-xs font-normal leading-5 text-slate-500';
        help.textContent = 'Adresse liée à votre accès sécurisé : elle est reprise automatiquement afin d’éviter une erreur de saisie.';
        emailLabel.append(help);
        mobileLabel.insertAdjacentElement('afterend', emailLabel);
      }

      const companyLabel = labels.find((label) => label.textContent?.includes('Société / employeur'));
      if (companyLabel) replaceLabelText(companyLabel, 'Société / employeur', 'Entreprise');

      enhanceDateEntry(labels);
    };

    void supabase.auth.getUser().then(({ data }) => {
      accountEmail = data.user?.email ?? '';
      enhance();
    });

    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    enhance();

    return () => {
      stopped = true;
      observer.disconnect();
    };
  }, []);

  return null;
}
