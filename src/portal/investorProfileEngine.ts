export type ProfileRank = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const PROFILE_BY_RANK: Record<ProfileRank, string> = {
  1: 'Très prudent',
  2: 'Prudent',
  3: 'Prudent défensif',
  4: 'Équilibré prudent',
  5: 'Équilibré dynamique',
  6: 'Dynamique',
  7: 'Offensif',
};

const CAPACITY_MAP = {
  Q3: { A: 1, B: 2, C: 4, D: 6 },
  Q4: { A: 7, B: 2, C: 3, D: 4 },
  Q9: { A: 1, B: 2, C: 4, D: 7 },
  Q10: { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 },
} as const;

export type CapacityAnswers = {
  Q3?: string | null;
  Q4?: string | null;
  Q9?: string | null;
  Q10?: string | null;
};

export type InvestorProfileInput = {
  toleranceScores?: number[];
  capacity?: CapacityAnswers;
  knowledgeCorrect?: number;
  knowledgeAnswered?: number;
  practicedProductFamilies?: number;
};

export type InvestorProfileResult = {
  complete: boolean;
  missing: string[];
  toleranceScore: number | null;
  toleranceRank: ProfileRank | null;
  toleranceProfile: string | null;
  capacityRank: ProfileRank | null;
  capacityProfile: string | null;
  operationalRank: ProfileRank | null;
  operationalProfile: string | null;
  capacityLossPct: number | null;
  gap: boolean;
  knowledgeLevel: 'À compléter' | 'Insuffisant' | 'Intermédiaire' | 'Suffisant';
  practicedProductFamilies: number;
  controls: {
    knowledgeOrExperienceReview: boolean;
    liquidityConstraint: boolean;
    futureProjectConstraint: boolean;
  };
};

export function profileRankFromScore(score: number): ProfileRank | null {
  if (!Number.isInteger(score) || score < 5 || score > 25) return null;
  if (score <= 7) return 1;
  if (score <= 10) return 2;
  if (score <= 13) return 3;
  if (score <= 16) return 4;
  if (score <= 19) return 5;
  if (score <= 22) return 6;
  return 7;
}

export function lossPctFromQ10(code?: string | null): number | null {
  return ({ A: 0, B: 5, C: 10, D: 20, E: 30, F: 30 } as Record<string, number>)[String(code ?? '')] ?? null;
}

export function capacityRankFromAnswers(answers: CapacityAnswers): ProfileRank | null {
  const keys = ['Q3', 'Q4', 'Q9', 'Q10'] as const;
  const ranks: number[] = [];
  for (const key of keys) {
    const code = String(answers[key] ?? '');
    const rank = (CAPACITY_MAP[key] as Record<string, number>)[code];
    if (!rank) return null;
    ranks.push(rank);
  }
  return Math.min(...ranks) as ProfileRank;
}

export function knowledgeLevel(answered: number, correct: number): InvestorProfileResult['knowledgeLevel'] {
  if (answered < 5) return 'À compléter';
  if (correct >= 4) return 'Suffisant';
  if (correct >= 3) return 'Intermédiaire';
  return 'Insuffisant';
}

export function computeInvestorProfile(input: InvestorProfileInput): InvestorProfileResult {
  const scores = input.toleranceScores ?? [];
  const capacity = input.capacity ?? {};
  const missing: string[] = [];

  const validTolerance = scores.length === 5 && scores.every((score) => Number.isInteger(score) && score >= 1 && score <= 5);
  if (!validTolerance) missing.push('tolérance au risque');

  for (const key of ['Q3', 'Q4', 'Q9', 'Q10'] as const) {
    const code = String(capacity[key] ?? '');
    if (!(code in CAPACITY_MAP[key])) missing.push(key);
  }

  const toleranceScore = validTolerance ? scores.reduce((sum, score) => sum + score, 0) : null;
  const toleranceRank = toleranceScore === null ? null : profileRankFromScore(toleranceScore);
  const capacityRank = capacityRankFromAnswers(capacity);
  const operationalRank = toleranceRank !== null && capacityRank !== null
    ? Math.min(toleranceRank, capacityRank) as ProfileRank
    : null;
  const answered = Math.max(0, Math.min(5, input.knowledgeAnswered ?? 0));
  const correct = Math.max(0, Math.min(answered, input.knowledgeCorrect ?? 0));
  const practiced = Math.max(0, Math.min(5, input.practicedProductFamilies ?? 0));

  return {
    complete: missing.length === 0,
    missing,
    toleranceScore,
    toleranceRank,
    toleranceProfile: toleranceRank === null ? null : PROFILE_BY_RANK[toleranceRank],
    capacityRank,
    capacityProfile: capacityRank === null ? null : PROFILE_BY_RANK[capacityRank],
    operationalRank,
    operationalProfile: operationalRank === null ? null : PROFILE_BY_RANK[operationalRank],
    capacityLossPct: lossPctFromQ10(capacity.Q10),
    gap: toleranceRank !== null && capacityRank !== null && toleranceRank > capacityRank,
    knowledgeLevel: knowledgeLevel(answered, correct),
    practicedProductFamilies: practiced,
    controls: {
      knowledgeOrExperienceReview: answered === 5 && (correct < 5 || practiced === 0),
      liquidityConstraint: capacity.Q3 === 'A' || capacity.Q3 === 'B',
      futureProjectConstraint: capacity.Q4 === 'B' || capacity.Q4 === 'C' || capacity.Q4 === 'D',
    },
  };
}

export function commonOperationProfile(ranks: Array<number | null | undefined>): { rank: ProfileRank | null; profile: string | null } {
  const valid = ranks.filter((rank): rank is ProfileRank => Number.isInteger(rank) && Number(rank) >= 1 && Number(rank) <= 7);
  if (valid.length === 0) return { rank: null, profile: null };
  const rank = Math.min(...valid) as ProfileRank;
  return { rank, profile: PROFILE_BY_RANK[rank] };
}
