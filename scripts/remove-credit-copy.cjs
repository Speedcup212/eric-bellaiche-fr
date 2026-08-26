const fs = require('fs');
const p = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let s = fs.readFileSync(p, 'utf8');

const guidance = `          <GuidanceNote><p>Déclaration simplifiée</p><p>Indiquez simplement si vous avez des crédits, leur type, leur taux et à quoi ils sont rattachés. Les biens immobiliers déjà déclarés sont proposés automatiquement. Pour un crédit consommation ou une réserve, sélectionnez directement l’usage correspondant. Le tableau d’amortissement permettra ensuite au cabinet de reprendre les autres caractéristiques.</p></GuidanceNote>\n`;
if (!s.includes(guidance)) throw new Error('Credit guidance target not found');
s = s.replace(guidance, '');

const yesSub = `<span className={\`mt-1 block text-xs \${form.has_credits === true ? 'text-blue-100' : 'text-slate-500'}\`}>J’ai un ou plusieurs crédits</span>`;
const noSub = `<span className={\`mt-1 block text-xs \${form.has_credits === false ? 'text-blue-100' : 'text-slate-500'}\`}>Aucun crédit en cours</span>`;
s = s.replace(yesSub, '');
s = s.replace(noSub, '');

const helper = `<p className="mt-1 text-xs text-[#94A3B8]">Une ligne par crédit. Les biens immobiliers sont repris automatiquement sous la forme Usage — Type de bien — Ville ; les crédits consommation, réserves, auto, travaux, étudiants ou professionnels disposent aussi d’un rattachement dédié.</p>`;
s = s.replace(helper, '');

fs.writeFileSync(p, s);
console.log('Removed non-essential credit page copy');
