const fs = require('fs');

const path = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let s = fs.readFileSync(path, 'utf8');

const moneyOld = `function MoneyField(props: Omit<React.ComponentProps<typeof Field>, 'type'>) { return <Field {...props} type="number" />; }`;
const moneyNew = `function MoneyField(props: Omit<React.ComponentProps<typeof Field>, 'type'>) {
  const { onChange, help, ...rest } = props;
  return <Field {...rest} type="text" onChange={(value) => onChange(String(value).replace(/[^\\d,.-]/g, '').replace(',', '.'))} help={help || 'Saisissez uniquement le montant, sans le symbole €. Exemple : 200000.'} />;
}`;
if (!s.includes(moneyOld)) throw new Error('MoneyField block not found');
s = s.replace(moneyOld, moneyNew);

const quoteOld = `                {(item.proprietaire === 'Identifiant 1 et 2' || item.mode_detention === 'En indivision') && <Field label={item.proprietaire === 'Identifiant 1 et 2' ? 'Quote-part de l’Identifiant 1 (%)' : 'Quote-part détenue (%)'} required type="number" value={item.quote_part} onChange={(v) => updateList('immobilier', index, { quote_part: v })} placeholder="Ex. 50" help={item.proprietaire === 'Identifiant 1 et 2' ? 'La part de l’Identifiant 2 sera déduite automatiquement (100 % moins cette valeur).' : 'Indiquez la part réellement détenue dans le bien.'} />}`;
const quoteNew = `                {(item.proprietaire === 'Identifiant 1 et 2' || item.mode_detention === 'En indivision') && <Field label={item.proprietaire === 'Identifiant 1 et 2' ? 'Quote-part de l’Identifiant 1 (%)' : 'Quote-part détenue (%)'} required type="text" value={item.quote_part} onChange={(v) => updateList('immobilier', index, { quote_part: String(v).replace(/[^\\d,.-]/g, '').replace(',', '.') })} placeholder="Ex. 50" help={item.proprietaire === 'Identifiant 1 et 2' ? 'Saisissez uniquement le nombre, sans le symbole %. Exemple : 50. La part de l’Identifiant 2 sera déduite automatiquement.' : 'Saisissez uniquement le nombre, sans le symbole %. Exemple : 50.'} />}`;
if (!s.includes(quoteOld)) throw new Error('Quote-part field block not found');
s = s.replace(quoteOld, quoteNew);

const messageOld = `throw new Error('Indiquez une quote-part comprise entre 1 % et 99 % lorsque le bien est détenu à plusieurs.');`;
const messageNew = `throw new Error('Indiquez une quote-part comprise entre 1 % et 99 %. Saisissez uniquement le nombre, sans le symbole %. Exemple : 50.');`;
if (!s.includes(messageOld)) throw new Error('Quote-part validation message not found');
s = s.replace(messageOld, messageNew);

fs.writeFileSync(path, s);
console.log('Numeric UX patch applied');
