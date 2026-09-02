const fs = require('fs');

const file = 'src/pages/portal/ClientRecueilJourneyBase.tsx';
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(from, to, label) {
  if (!source.includes(from)) {
    throw new Error(`Patch impossible (${label}) : motif introuvable`);
  }
  source = source.replace(from, to);
}

replaceOnce(
  "    void supabase.auth.getUser().then(({ data }) => setAccountEmail(data.user?.email ?? '')).catch(() => setAccountEmail(''));\n",
  '',
  'suppression email session connectee'
);

replaceOnce(
  "supabase.from('investisseurs').select('civilite,prenom,nom,nom_naissance,date_naissance,lieu_naissance,pays_naissance,nationalite,mobile,telephone_bureau,telephone_domicile,numero_fiscal').eq('id', row.investisseur_id).single(),",
  "supabase.from('investisseurs').select('civilite,prenom,nom,nom_naissance,date_naissance,lieu_naissance,pays_naissance,nationalite,mobile,email,telephone_bureau,telephone_domicile,numero_fiscal').eq('id', row.investisseur_id).single(),",
  'chargement email investisseur'
);

replaceOnce(
  "      if (investorError) throw investorError;\n      const nextForms = structuredClone(initial) as Record<SectionCode, AnyPayload>;",
  "      if (investorError) throw investorError;\n      setAccountEmail(investor?.email ?? '');\n      const nextForms = structuredClone(initial) as Record<SectionCode, AnyPayload>;",
  'affectation email investisseur'
);

replaceOnce(
  'help="Adresse liée à votre accès sécurisé : elle est reprise automatiquement afin d’éviter une erreur de saisie."',
  'help="Adresse e-mail enregistrée pour cette personne dans le dossier."',
  'texte aide email'
);

fs.writeFileSync(file, source);
console.log('Patch email investisseur appliqué.');
