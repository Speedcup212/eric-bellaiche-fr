const fs = require('fs');

function patch(path, replacements) {
  let source = fs.readFileSync(path, 'utf8');
  let changed = false;
  for (const [before, after, label] of replacements) {
    if (source.includes(before)) {
      source = source.replace(before, after);
      changed = true;
      console.log(`Applied: ${label}`);
    } else if (!source.includes(after)) {
      throw new Error(`Patch anchor not found: ${label}`);
    }
  }
  if (changed) fs.writeFileSync(path, source);
  return changed;
}

const questionnaireChanged = patch('src/pages/portal/QuestionnairePageBase.tsx', [
  [
`    const nextPath = mode === 'QPI' && qpiNextIsEsg
      ? dossierHref('/espace-client/esg', progress.dossier_id)
      : dossierHref('/espace-client/synthese', progress.dossier_id);
    const title = mode === 'QPI' ? 'Profil investisseur terminé' : 'Préférences de durabilité terminées';
    const nextTitle = mode === 'QPI' && qpiNextIsEsg ? 'Préférences de durabilité' : 'Synthèse du dossier';
    const nextDescription = mode === 'QPI'
      ? (qpiNextIsEsg
        ? 'Vous allez maintenant préciser vos préférences de durabilité.'
        : 'Vous allez maintenant accéder à la synthèse de votre dossier.')
      : 'Vous pouvez maintenant accéder à la synthèse de votre dossier.';
    const completionCta = mode === 'QPI' && qpiNextIsEsg ? 'Continuer' : 'Voir ma synthèse';`,
`    const nextPath = mode === 'QPI' && qpiNextIsEsg
      ? dossierHref('/espace-client/esg', progress.dossier_id)
      : dossierHref('/espace-client/documents', progress.dossier_id);
    const title = mode === 'QPI' ? 'Profil investisseur terminé' : 'Préférences de durabilité terminées';
    const nextTitle = mode === 'QPI' && qpiNextIsEsg ? 'Préférences de durabilité' : 'Documents du dossier';
    const nextDescription = mode === 'QPI'
      ? (qpiNextIsEsg
        ? 'Vous allez maintenant préciser vos préférences de durabilité.'
        : 'Vous allez maintenant vérifier votre situation documentaire et transmettre uniquement les justificatifs utiles à votre dossier.')
      : 'Vous allez maintenant vérifier votre situation documentaire et transmettre uniquement les justificatifs utiles à votre dossier.';
    const completionCta = mode === 'QPI' && qpiNextIsEsg ? 'Continuer' : 'Finaliser mon dossier';`,
    'questionnaire completion routes to documents'
  ],
  [
    `Tu peux laisser ce champ vide et préciser ce point plus tard avec ton conseiller.`,
    `Vous pouvez laisser ce champ vide et préciser ce point plus tard avec votre conseiller.`,
    'client-facing ESG copy uses vous'
  ],
]);

const documentsChanged = patch('src/pages/portal/ClientDocumentsPage.tsx', [
  [
`function contextComplete(context: DocumentContext | undefined): boolean {
  if (!context || context.tax_status === null || context.has_financial_assets === null || context.has_real_estate === null || context.has_sci_company === null) return false;`,
`function contextComplete(context: DocumentContext | undefined): boolean {
  if (!context || context.tax_status === null || context.has_financial_assets === null || context.has_real_estate === null || context.has_credits === null || context.has_sci_company === null) return false;`,
    'documents context requires credits answer'
  ],
  [
`            {boolChoice('Détenez-vous de l’épargne ou des placements à prendre en compte dans l’analyse patrimoniale ? Exemples : Livret A, LDDS, LEP, livrets bancaires, comptes à terme, assurance-vie, PER, PEA, compte-titres, SCPI.', 'has_financial_assets', currentContext?.has_financial_assets)}
            {boolChoice('Détenez-vous un ou plusieurs biens immobiliers à prendre en compte dans l’analyse patrimoniale ?', 'has_real_estate', currentContext?.has_real_estate)}
            {boolChoice('Détenez-vous une SCI ou une société à intégrer à l’analyse ?', 'has_sci_company', currentContext?.has_sci_company)}`,
`            {boolChoice('Détenez-vous de l’épargne ou des placements à prendre en compte dans l’analyse patrimoniale ? Exemples : Livret A, LDDS, LEP, livrets bancaires, comptes à terme, assurance-vie, PER, PEA, compte-titres, SCPI.', 'has_financial_assets', currentContext?.has_financial_assets)}
            {boolChoice('Détenez-vous un ou plusieurs biens immobiliers à prendre en compte dans l’analyse patrimoniale ?', 'has_real_estate', currentContext?.has_real_estate)}
            {boolChoice('Avez-vous un ou plusieurs crédits en cours à prendre en compte dans l’analyse patrimoniale ?', 'has_credits', currentContext?.has_credits)}
            {boolChoice('Détenez-vous une SCI ou une société à intégrer à l’analyse ?', 'has_sci_company', currentContext?.has_sci_company)}`,
    'documents situation asks about credits'
  ],
]);

if (!questionnaireChanged && !documentsChanged) {
  console.log('Final questionnaire/documents flow already corrected.');
} else {
  console.log('Final questionnaire/documents flow corrected.');
}
