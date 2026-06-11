import { ArticleContent } from './articleTypes';

import conseillerScpi from './conseiller-scpi';
import auditPatrimonialEnLigne from './audit-patrimonial-en-ligne';
import scpiFiscalite from './scpi-fiscalite';
import scpiAssuranceVieOuDirect from './scpi-assurance-vie-ou-direct';
import perOuAssuranceVie from './per-ou-assurance-vie';
import perFiscalite from './per-fiscalite';
import assuranceVieFiscalite from './assurance-vie-fiscalite';
import assuranceVieApres70Ans from './assurance-vie-apres-70-ans';
import reduireImpotSansRisqueExcessif from './reduire-impot-sans-risque-excessif';
import fiscaliteRevenusFonciers from './fiscalite-revenus-fonciers';
import scpiACredit from './scpi-a-credit';
import scpiDemembrement from './scpi-demembrement';
import scpiRetraite from './scpi-retraite';
import scpiRevenusComplementaires from './scpi-revenus-complementaires';
import scpiSuccessionTransmission from './scpi-succession-transmission';
import lmnpOuLocationNue from './lmnp-ou-location-nue';
import sciIrOuSciIs from './sci-ir-ou-sci-is';
import immobilierLocatifFiscalite from './immobilier-locatif-fiscalite';
import deficitFoncier from './deficit-foncier';
import investissementLocatifRetraite from './investissement-locatif-retraite';
import conseillerPatrimoineEnLigne from './conseiller-patrimoine-en-ligne';
import structurerSonPatrimoine from './structurer-son-patrimoine';
import preparerRetraitePatrimoine from './preparer-retraite-patrimoine';
import transmissionPatrimoineFamilleRecomposee from './transmission-patrimoine-famille-recomposee';
import erreursGestionPatrimoine from './erreurs-gestion-patrimoine';

export const articles: ArticleContent[] = [
  conseillerScpi,
  auditPatrimonialEnLigne,
  scpiFiscalite,
  scpiAssuranceVieOuDirect,
  perOuAssuranceVie,
  scpiACredit,
  scpiDemembrement,
  scpiRetraite,
  scpiRevenusComplementaires,
  scpiSuccessionTransmission,
  perFiscalite,
  assuranceVieFiscalite,
  assuranceVieApres70Ans,
  reduireImpotSansRisqueExcessif,
  fiscaliteRevenusFonciers,
  lmnpOuLocationNue,
  sciIrOuSciIs,
  immobilierLocatifFiscalite,
  deficitFoncier,
  investissementLocatifRetraite,
  conseillerPatrimoineEnLigne,
  structurerSonPatrimoine,
  preparerRetraitePatrimoine,
  transmissionPatrimoineFamilleRecomposee,
  erreursGestionPatrimoine,
];

export const articlesBySlug: Record<string, ArticleContent> = {};
for (const article of articles) {
  articlesBySlug[article.slug] = article;
}

export function getArticleBySlug(slug: string): ArticleContent | undefined {
  return articlesBySlug[slug];
}

export function getArticlesByCategory(category: string): ArticleContent[] {
  return articles.filter((a) => a.category === category);
}
