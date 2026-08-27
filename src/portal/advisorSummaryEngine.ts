import { resolveDataStatus, type DataStatusInput } from './dataStatusEngine';
import type { ConsistencyIssue } from './consistencyEngine';

export type ChecklistItemInput = { statut?: string | null };
export type SectionInput = { section_code?: string | null; completed_at?: string | null };
export type DossierRole = 'investisseur_1' | 'investisseur_2' | string;

export type AdvisorSummary = {
  sections: { completed: number; total: number; missing: string[] };
  provenance: {
    total: number;
    declared: number;
    extracted: number;
    toReview: number;
    verified: number;
    retained: number;
    rejected: number;
    cifReviewRequired: number;
  };
  documents: { total: number; validated: number; received: number; missing: number; requested: number; notApplicable: number };
  consistency: { total: number; blocking: number; review: number; info: number };
  readiness: 'blocked' | 'review' | 'ready';
};

export const REQUIRED_RECUEIL_SECTIONS = ['identity', 'family', 'professional', 'objectives', 'capacity', 'patrimony', 'financial', 'credits', 'regulatory'] as const;

export function requiredRecueilSectionsForRole(roleDossier?: DossierRole | null): string[] {
  return REQUIRED_RECUEIL_SECTIONS.filter((code) => !(roleDossier === 'investisseur_2' && code === 'family'));
}

export function summarizeAdvisorDossier(input: {
  sections?: SectionInput[];
  provenance?: DataStatusInput[];
  checklist?: ChecklistItemInput[];
  issues?: ConsistencyIssue[];
  roleDossier?: DossierRole | null;
}): AdvisorSummary {
  const requiredSections = requiredRecueilSectionsForRole(input.roleDossier);
  const sections = input.sections ?? [];
  const completedCodes = new Set(sections.filter((row) => Boolean(row.completed_at)).map((row) => row.section_code).filter(Boolean) as string[]);
  const missing = requiredSections.filter((code) => !completedCodes.has(code));

  const provenanceRows = input.provenance ?? [];
  const resolved = provenanceRows.map(resolveDataStatus);
  const count = (status: ReturnType<typeof resolveDataStatus>['status']) => resolved.filter((row) => row.status === status).length;

  const checklist = input.checklist ?? [];
  const docCount = (status: string) => checklist.filter((item) => item.statut === status).length;
  const issues = input.issues ?? [];
  const blocking = issues.filter((issue) => issue.severity === 'blocking').length;
  const review = issues.filter((issue) => issue.severity === 'review').length;
  const info = issues.filter((issue) => issue.severity === 'info').length;
  const cifReviewRequired = resolved.filter((row) => ['declared', 'extracted', 'to_review'].includes(row.status)).length;

  let readiness: AdvisorSummary['readiness'] = 'ready';
  if (blocking > 0 || missing.length > 0 || docCount('missing') > 0) readiness = 'blocked';
  else if (review > 0 || cifReviewRequired > 0 || docCount('requested') > 0 || docCount('received') > 0) readiness = 'review';

  return {
    sections: { completed: requiredSections.length - missing.length, total: requiredSections.length, missing },
    provenance: {
      total: resolved.length,
      declared: count('declared'),
      extracted: count('extracted'),
      toReview: count('to_review'),
      verified: count('verified'),
      retained: count('retained'),
      rejected: count('rejected'),
      cifReviewRequired,
    },
    documents: {
      total: checklist.length,
      validated: docCount('validated'),
      received: docCount('received'),
      missing: docCount('missing'),
      requested: docCount('requested'),
      notApplicable: docCount('not_applicable'),
    },
    consistency: { total: issues.length, blocking, review, info },
    readiness,
  };
}
