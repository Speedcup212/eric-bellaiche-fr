export type HouseholdRole = 'investisseur_1' | 'investisseur_2' | string;

export type HouseholdSectionRow = {
  investisseur_id: string;
  role_dossier: HouseholdRole;
  section_code: string;
  payload?: Record<string, unknown> | null;
};

export type HouseholdProperty = {
  sourceInvestorId: string;
  sourceRole: HouseholdRole;
  sourceIndex: number;
  owner: 'investisseur_1' | 'investisseur_2' | 'joint' | 'unknown';
  type: string;
  usage: string;
  city: string;
  value: number | null;
  key: string;
};

export type HouseholdConsolidation = {
  isCouple: boolean;
  canonicalFamilyInvestorId: string | null;
  properties: HouseholdProperty[];
  realEstate: {
    count: number;
    totalValue: number;
    jointValue: number;
    investor1Value: number;
    investor2Value: number;
    unknownOwnershipValue: number;
    duplicatesIgnored: number;
  };
  financialCategories: string[];
  warnings: string[];
};

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('fr-FR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function propertyOwner(value: unknown): HouseholdProperty['owner'] {
  const owner = normalize(value);
  if (owner.includes('1 et 2') || owner.includes('1 & 2') || owner.includes('commun') || owner.includes('joint')) return 'joint';
  if (owner.includes('identifiant 1')) return 'investisseur_1';
  if (owner.includes('identifiant 2')) return 'investisseur_2';
  return 'unknown';
}

function propertyKey(item: Record<string, unknown>): string {
  const value = numberOrNull(item.valeur_actuelle);
  return [normalize(item.type_bien), normalize(item.usage), normalize(item.ville), value ?? ''].join('|');
}

function sectionPayload(rows: HouseholdSectionRow[], role: HouseholdRole, sectionCode: string): Record<string, unknown> | null {
  return rows.find((row) => row.role_dossier === role && row.section_code === sectionCode)?.payload ?? null;
}

export function consolidateHousehold(rows: HouseholdSectionRow[]): HouseholdConsolidation {
  const roles = new Set(rows.map((row) => row.role_dossier));
  const isCouple = roles.has('investisseur_1') && roles.has('investisseur_2');
  const investor1Id = rows.find((row) => row.role_dossier === 'investisseur_1')?.investisseur_id ?? null;
  const canonicalFamilyInvestorId = isCouple ? investor1Id : (rows.find((row) => row.section_code === 'family')?.investisseur_id ?? investor1Id);
  const warnings: string[] = [];

  const properties: HouseholdProperty[] = [];
  const primaryKeys = new Set<string>();
  let duplicatesIgnored = 0;

  for (const row of rows.filter((item) => item.section_code === 'patrimony').sort((a, b) => a.role_dossier.localeCompare(b.role_dossier))) {
    const payload = row.payload ?? {};
    const items = Array.isArray(payload.immobilier) ? payload.immobilier as Record<string, unknown>[] : [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const key = propertyKey(item);
      const owner = propertyOwner(item.proprietaire);

      if (row.role_dossier === 'investisseur_2' && primaryKeys.has(key)) {
        duplicatesIgnored += 1;
        continue;
      }

      properties.push({
        sourceInvestorId: row.investisseur_id,
        sourceRole: row.role_dossier,
        sourceIndex: index,
        owner,
        type: String(item.type_bien ?? ''),
        usage: String(item.usage ?? ''),
        city: String(item.ville ?? ''),
        value: numberOrNull(item.valeur_actuelle),
        key,
      });
      if (row.role_dossier === 'investisseur_1') primaryKeys.add(key);
    }
  }

  if (duplicatesIgnored > 0) warnings.push(`${duplicatesIgnored} bien(s) ressaisi(s) par l’Identifiant 2 ont été ignorés dans la consolidation du foyer.`);

  const totalValue = properties.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const sumByOwner = (owner: HouseholdProperty['owner']) => properties.filter((item) => item.owner === owner).reduce((sum, item) => sum + (item.value ?? 0), 0);
  const unknownOwnership = properties.filter((item) => item.owner === 'unknown');
  if (unknownOwnership.length > 0) warnings.push(`${unknownOwnership.length} bien(s) immobilier(s) ont une propriété à préciser avant calcul définitif.`);

  const categories = new Set<string>();
  for (const role of ['investisseur_1', 'investisseur_2'] as const) {
    const financial = sectionPayload(rows, role, 'financial');
    const values = Array.isArray(financial?.categories) ? financial?.categories as unknown[] : [];
    for (const value of values) {
      const category = String(value ?? '').trim();
      if (category && category !== 'none') categories.add(category);
    }
  }

  return {
    isCouple,
    canonicalFamilyInvestorId,
    properties,
    realEstate: {
      count: properties.length,
      totalValue,
      jointValue: sumByOwner('joint'),
      investor1Value: sumByOwner('investisseur_1'),
      investor2Value: sumByOwner('investisseur_2'),
      unknownOwnershipValue: sumByOwner('unknown'),
      duplicatesIgnored,
    },
    financialCategories: [...categories].sort(),
    warnings,
  };
}
