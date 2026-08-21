import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';

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

export default function RecueilUxEnhancements() {
  useEffect(() => {
    let stopped = false;
    let accountEmail = '';

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

      const dateLabel = labels.find((label) => label.textContent?.includes('Depuis quelle date travaillez-vous dans cette entreprise / activité ?'));
      if (dateLabel) {
        replaceLabelText(dateLabel, 'Depuis quelle date travaillez-vous dans cette entreprise / activité ?', 'Depuis quel mois travaillez-vous dans cette entreprise / activité ?');
        const input = dateLabel.querySelector<HTMLInputElement>('input');
        if (input && input.type !== 'month') {
          const current = input.value;
          input.type = 'month';
          if (current) input.value = current.slice(0, 7);
        }
      }
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
