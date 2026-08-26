const fs = require('fs');

const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let text = fs.readFileSync(path, 'utf8');

text = text.replace(
  "      if (form.has_credits === true && (form.items ?? []).length === 0) throw new Error('Ajoutez au moins un crédit.');\n      for (const item of form.items ?? []) {\n        if ([item.type_credit, item.capital_restant_du, item.mensualite, item.date_fin].some(isBlank)) throw new Error('Complétez les quatre informations essentielles de chaque crédit.');\n        if (!isNonNegativeNumber(item.capital_restant_du) || !isNonNegativeNumber(item.mensualite)) throw new Error('Le capital restant dû et la mensualité doivent être positifs ou nuls.');\n        if (!/^\\d{4}-\\d{2}$/.test(String(item.date_fin))) throw new Error('Indiquez le mois et l’année de fin approximative de chaque crédit.');\n      }",
  "      if (form.has_credits === true && (form.items ?? []).length === 0) throw new Error('Ajoutez au moins un crédit.');\n      for (const item of form.items ?? []) {\n        if ([item.type_credit, item.mensualite].some(isBlank)) throw new Error('Complétez le type et la mensualité de chaque crédit.');\n        if (!isNonNegativeNumber(item.mensualite)) throw new Error('La mensualité doit être positive ou nulle.');\n      }"
);

text = text.replaceAll(
  "{ type_credit: '', capital_restant_du: '', mensualite: '', date_fin: '' }",
  "{ type_credit: '', mensualite: '' }"
);

text = text.replace(
  '                <MoneyField label="Capital restant dû approximatif (€)" required value={item.capital_restant_du} onChange={(value) => updateList(\'items\', index, { capital_restant_du: value })} />\n',
  ''
);

text = text.replace(
  '                <MonthYearField label="Fin approximative du crédit" required value={String(item.date_fin ?? \'\')} onChange={(value) => updateList(\'items\', index, { date_fin: value })} />\n',
  ''
);

text = text.replace(
  'Une fiche courte par crédit. Les informations détaillées seront reprises depuis les justificatifs.',
  'Indiquez uniquement le type et la mensualité. Le capital restant dû, la durée et les autres informations seront repris depuis le tableau d’amortissement.'
);

if (text.includes('Capital restant dû approximatif (€)') || text.includes('Fin approximative du crédit')) {
  throw new Error('Les champs CRD ou fin de crédit sont encore présents');
}

fs.writeFileSync(path, text);
console.log('Credit recueil reduced to type + monthly payment');
