export interface CityData {
  slug: string;
  name: string;
  description: string;
  adTitle1: string;
  adTitle2: string;
  adTitle3: string;
  adDescription: string;
  metaDescription: string;
}

export const cities: Record<string, CityData> = {
  grenoble: {
    slug: 'conseil-investissement-grenoble',
    name: 'Grenoble',
    description: 'Grenoble et son agglo',
    adTitle1: 'Conseil Patrimoine Grenoble',
    adTitle2: 'Bilan Offert (100% Visio)',
    adTitle3: 'Éric Bellaiche (30 ans Exp.)',
    adDescription: 'Votre expert dédié pour Grenoble et agglo. Bilan 30min offert (SCPI, Fiscalité). Conseil 100% indépendant et en visio.',
    metaDescription: 'Conseil en investissement et gestion de patrimoine à Grenoble. Bilan personnalisé offert de 30min en visio avec Eric Bellaiche, expert indépendant (30 ans d\'expérience).',
  },
  montrouge: {
    slug: 'conseil-investissement-montrouge',
    name: 'Montrouge',
    description: 'Montrouge, Boulogne et Paris Sud-Ouest',
    adTitle1: 'Conseil Patrimoine Montrouge',
    adTitle2: 'Bilan Offert (100% Visio)',
    adTitle3: 'Éric Bellaiche (30 ans Exp.)',
    adDescription: 'Votre expert dédié pour Montrouge, Boulogne et Paris Sud-Ouest. Bilan 30min offert (SCPI, Fiscalité). Conseil 100% indépendant et en visio.',
    metaDescription: 'Conseil en investissement et gestion de patrimoine à Montrouge. Bilan personnalisé offert de 30min en visio avec Eric Bellaiche, expert indépendant (30 ans d\'expérience).',
  },
  toulouse: {
    slug: 'conseil-investissement-toulouse',
    name: 'Toulouse',
    description: 'Toulouse, Blagnac et Colomiers',
    adTitle1: 'Conseil Patrimoine Toulouse',
    adTitle2: 'Bilan Offert (100% Visio)',
    adTitle3: 'Éric Bellaiche (30 ans Exp.)',
    adDescription: 'Votre expert dédié pour Toulouse, Blagnac et Colomiers. Bilan 30min offert (SCPI, Fiscalité). Conseil 100% indépendant et en visio.',
    metaDescription: 'Conseil en investissement et gestion de patrimoine à Toulouse. Bilan personnalisé offert de 30min en visio avec Eric Bellaiche, expert indépendant (30 ans d\'expérience).',
  },
  rennes: {
    slug: 'conseil-investissement-rennes',
    name: 'Rennes',
    description: 'Rennes et Ille-et-Vilaine',
    adTitle1: 'Conseil Patrimoine Rennes',
    adTitle2: 'Bilan Offert (100% Visio)',
    adTitle3: 'Éric Bellaiche (30 ans Exp.)',
    adDescription: 'Votre expert dédié pour Rennes et Ille-et-Vilaine. Bilan 30min offert (SCPI, Fiscalité). Conseil 100% indépendant et en visio.',
    metaDescription: 'Conseil en investissement et gestion de patrimoine à Rennes. Bilan personnalisé offert de 30min en visio avec Eric Bellaiche, expert indépendant (30 ans d\'expérience).',
  },
  'aix-en-provence': {
    slug: 'conseil-investissement-aix-en-provence',
    name: 'Aix-en-Provence',
    description: 'Aix-en-Provence et Pays d\'Aix',
    adTitle1: 'Conseil Patrimoine Aix-en-Provence',
    adTitle2: 'Bilan Offert (100% Visio)',
    adTitle3: 'Éric Bellaiche (30 ans Exp.)',
    adDescription: 'Votre expert dédié pour Aix-en-Provence et Pays d\'Aix. Bilan 30min offert (SCPI, Fiscalité). Conseil 100% indépendant et en visio.',
    metaDescription: 'Conseil en investissement et gestion de patrimoine à Aix-en-Provence. Bilan personnalisé offert de 30min en visio avec Eric Bellaiche, expert indépendant (30 ans d\'expérience).',
  },
  nantes: {
    slug: 'conseil-investissement-nantes',
    name: 'Nantes',
    description: 'Nantes et Loire-Atlantique',
    adTitle1: 'Conseil Patrimoine Nantes',
    adTitle2: 'Bilan Offert (100% Visio)',
    adTitle3: 'Éric Bellaiche (30 ans Exp.)',
    adDescription: 'Votre expert dédié pour Nantes et Loire-Atlantique. Bilan 30min offert (SCPI, Fiscalité). Conseil 100% indépendant et en visio.',
    metaDescription: 'Conseil en investissement et gestion de patrimoine à Nantes. Bilan personnalisé offert de 30min en visio avec Eric Bellaiche, expert indépendant (30 ans d\'expérience).',
  },
};
