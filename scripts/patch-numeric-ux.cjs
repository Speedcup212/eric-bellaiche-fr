const fs = require('fs');

const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let s = fs.readFileSync(path, 'utf8');

const replaceExact = (oldText, newText, label) => {
  if (!s.includes(oldText)) throw new Error(`${label} not found`);
  s = s.replace(oldText, newText);
};

replaceExact(
  `function MoneyField(props: Omit<React.ComponentProps<typeof Field>, 'type'>) { return <Field {...props} type="number" />; }`,
  `function MoneyField(props: Omit<React.ComponentProps<typeof Field>, 'type'>) {
  const { onChange, help, ...rest } = props;
  return <Field {...rest} type="text" onChange={(value) => onChange(String(value).replace(/[^\\d,.-]/g, '').replace(',', '.'))} help={help || 'Saisissez uniquement le montant, sans le symbole €. Exemple : 200000.'} />;
}`,
  'MoneyField block',
);

replaceExact(
  `        for (const item of form.immobilier ?? []) {
          if ([item.intitule, item.type_bien, item.usage, item.proprietaire, item.mode_detention, item.valeur_actuelle, item.ville].some(isBlank)) throw new Error('Complétez le nom et les informations principales de chaque bien immobilier.');
          if (item.type_bien === 'Autre' && isBlank(item.type_bien_autre)) throw new Error('Précisez le type du bien immobilier.');
          if (item.usage === 'Autre' && isBlank(item.usage_autre)) throw new Error('Précisez l’usage du bien immobilier.');
          if (item.mode_detention === 'Autre' && isBlank(item.mode_detention_autre)) throw new Error('Précisez comment le bien immobilier est détenu.');
          const quotePartValue = Number(String(item.quote_part ?? '').replace(',', '.').replace('%', '').trim());
          if ((item.proprietaire === 'Identifiant 1 et 2' || item.mode_detention === 'En indivision') && (isBlank(item.quote_part) || !Number.isFinite(quotePartValue) || quotePartValue <= 0 || quotePartValue >= 100)) throw new Error('Indiquez une quote-part comprise entre 1 % et 99 % lorsque le bien est détenu à plusieurs.');
          if (item.usage === 'Locatif' && isBlank(item.loyer_annuel)) throw new Error('Indiquez le loyer annuel hors charges pour chaque bien locatif.');
        }`,
  `        for (const [index, item] of (form.immobilier ?? []).entries()) {
          const prefix = \`Bien immobilier \${index + 1}\`;
          if (isBlank(item.proprietaire)) throw new Error(\`\${prefix} : choisissez le propriétaire du bien.\`);
          if (isBlank(item.intitule)) throw new Error(\`\${prefix} : indiquez un nom pour identifier le bien.\`);
          if (isBlank(item.type_bien)) throw new Error(\`\${prefix} : choisissez le type de bien.\`);
          if (item.type_bien === 'Autre' && isBlank(item.type_bien_autre)) throw new Error(\`\${prefix} : précisez le type de bien.\`);
          if (isBlank(item.usage)) throw new Error(\`\${prefix} : choisissez l’usage du bien.\`);
          if (item.usage === 'Autre' && isBlank(item.usage_autre)) throw new Error(\`\${prefix} : précisez l’usage du bien.\`);
          if (isBlank(item.ville)) throw new Error(\`\${prefix} : indiquez la ville du bien.\`);
          if (isBlank(item.mode_detention)) throw new Error(\`\${prefix} : indiquez comment le bien est détenu.\`);
          if (item.mode_detention === 'Autre' && isBlank(item.mode_detention_autre)) throw new Error(\`\${prefix} : précisez le mode de détention.\`);
          const quotePartValue = Number(String(item.quote_part ?? '').replace(',', '.').replace('%', '').trim());
          if ((item.proprietaire === 'Identifiant 1 et 2' || item.mode_detention === 'En indivision') && (isBlank(item.quote_part) || !Number.isFinite(quotePartValue) || quotePartValue <= 0 || quotePartValue >= 100)) throw new Error(\`\${prefix} : indiquez une quote-part comprise entre 1 et 99. Le symbole % n’est pas nécessaire.\`);
          const currentValue = Number(String(item.valeur_actuelle ?? '').replace(/[^\\d,.-]/g, '').replace(',', '.'));
          if (isBlank(item.valeur_actuelle) || !Number.isFinite(currentValue) || currentValue <= 0) throw new Error(\`\${prefix} : indiquez une valeur estimée actuelle supérieure à 0. Le symbole € n’est pas nécessaire.\`);
          if (!isBlank(item.date_acquisition)) {
            const year = Number(item.date_acquisition);
            const maxYear = new Date().getFullYear();
            if (!Number.isInteger(year) || year < 1800 || year > maxYear) throw new Error(\`\${prefix} : indiquez une année d’acquisition comprise entre 1800 et \${maxYear}.\`);
          }
          if (!isBlank(item.prix_acquisition)) {
            const acquisitionValue = Number(String(item.prix_acquisition).replace(/[^\\d,.-]/g, '').replace(',', '.'));
            if (!Number.isFinite(acquisitionValue) || acquisitionValue < 0) throw new Error(\`\${prefix} : indiquez un prix d’acquisition valide. Le symbole € n’est pas nécessaire.\`);
          }
          if (item.usage === 'Locatif') {
            const annualRent = Number(String(item.loyer_annuel ?? '').replace(/[^\\d,.-]/g, '').replace(',', '.'));
            if (isBlank(item.loyer_annuel) || !Number.isFinite(annualRent) || annualRent <= 0) throw new Error(\`\${prefix} : indiquez le loyer annuel hors charges. Le symbole € n’est pas nécessaire.\`);
          }
        }`,
  'Patrimony validation block',
);

replaceExact(
  `                {(item.proprietaire === 'Identifiant 1 et 2' || item.mode_detention === 'En indivision') && <Field label={item.proprietaire === 'Identifiant 1 et 2' ? 'Quote-part de l’Identifiant 1 (%)' : 'Quote-part détenue (%)'} required type="number" value={item.quote_part} onChange={(v) => updateList('immobilier', index, { quote_part: v })} placeholder="Ex. 50" help={item.proprietaire === 'Identifiant 1 et 2' ? 'La part de l’Identifiant 2 sera déduite automatiquement (100 % moins cette valeur).' : 'Indiquez la part réellement détenue dans le bien.'} />}`,
  `                {(item.proprietaire === 'Identifiant 1 et 2' || item.mode_detention === 'En indivision') && <Field label={item.proprietaire === 'Identifiant 1 et 2' ? 'Quote-part de l’Identifiant 1 (%)' : 'Quote-part détenue (%)'} required type="text" value={item.quote_part} onChange={(v) => updateList('immobilier', index, { quote_part: String(v).replace(/[^\\d,.-]/g, '').replace(',', '.') })} placeholder="Ex. 50" help={item.proprietaire === 'Identifiant 1 et 2' ? 'Saisissez uniquement le nombre, sans le symbole %. Exemple : 50. La part de l’Identifiant 2 sera déduite automatiquement.' : 'Saisissez uniquement le nombre, sans le symbole %. Exemple : 50.'} />}`,
  'Quote-part field block',
);

replaceExact(
  `                {item.usage === 'Locatif' && <MoneyField label="Loyer annuel hors charges (€)" required value={item.loyer_annuel} onChange={(v) => updateList('immobilier', index, { loyer_annuel: v })} />}`,
  `                {item.usage === 'Locatif' && <MoneyField label="Loyer annuel hors charges (€)" required value={item.loyer_annuel} onChange={(v) => updateList('immobilier', index, { loyer_annuel: v })} help="Saisissez le total annuel hors charges, sans le symbole €. Exemple : 9600 pour un loyer mensuel de 800 €." />}`,
  'Annual rent field block',
);

replaceExact(
  `      document.getElementById('recueil-validation-alert')?.scrollIntoView({ behavior: 'smooth', block: 'center' });`,
  `      const alert = document.getElementById('recueil-validation-alert');
      alert?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      alert?.focus({ preventScroll: true });`,
  'Validation alert scroll block',
);

fs.writeFileSync(path, s);
console.log('Patrimony crash-test UX patch applied');
