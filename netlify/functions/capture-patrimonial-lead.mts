function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const ALLOWED = {
  age_band: ['lt35','35_44','45_54','55_64','65plus'],
  household_status: ['single','couple'],
  professional_status: ['salarie','dirigeant','tns','retraite','autre'],
  income_band: ['lt35','35_60','60_90','90_150','150plus'],
  real_estate_band: ['none','lt200','200_400','400_700','700_1200','1200plus'],
  financial_assets_band: ['lt20','20_50','50_100','100_250','250_500','500plus'],
  savings_band: ['lt300','300_700','700_1500','1500_3000','3000plus'],
  primary_goal: ['placements','revenus','retraite','fiscalite','immobilier','transmission','tresorerie','autre'],
  horizon: ['12m','1_3y','later'],
  income_tax_band: ['lt1500','1500_3000','3000_6000','6000_12000','12000plus','unknown'],
  event_12m: ['vente','succession','cession','retraite','capital','none'],
} as const;

type Payload = {
  first_name?: string;
  email?: string;
  marketing_consent?: boolean;
  answers?: Record<string, string>;
  source_utm?: Record<string, string>;
  source_path?: string;
};

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function clean(value: unknown, max = 140) {
  return String(value ?? '').trim().slice(0, max);
}

function allowedValue<K extends keyof typeof ALLOWED>(key: K, value: unknown) {
  const v = clean(value, 40);
  return (ALLOWED[key] as readonly string[]).includes(v) ? v : '';
}

function qualification(a: Record<string, string>) {
  const f = {lt20:0,'20_50':1,'50_100':2,'100_250':3,'250_500':4,'500plus':5}[a.financial_assets_band] ?? 0;
  const s = {lt300:0,'300_700':1,'700_1500':2,'1500_3000':3,'3000plus':4}[a.savings_band] ?? 0;
  const i = {lt35:0,'35_60':1,'60_90':2,'90_150':3,'150plus':4}[a.income_band] ?? 0;
  const re = {none:0,lt200:1,'200_400':2,'400_700':3,'700_1200':4,'1200plus':5}[a.real_estate_band] ?? 0;
  const t = {lt1500:0,'1500_3000':1,'3000_6000':2,'6000_12000':3,'12000plus':4,unknown:-1}[a.income_tax_band] ?? -1;
  const taxGoal = ['fiscalite','immobilier'].includes(a.primary_goal);
  const major = ['vente','succession','cession','capital'].includes(a.event_12m);
  const soon = a.horizon === '12m';
  if (f >= 2 || s >= 3 || major || a.primary_goal === 'tresorerie' || (taxGoal && t >= 2)) return 'A';
  if ((f === 1 && s >= 2) || (['dirigeant','tns'].includes(a.professional_status) && re >= 3) || (taxGoal && t === 1 && i >= 2) || (taxGoal && a.income_tax_band === 'unknown' && i >= 2) || (a.event_12m === 'retraite' && f >= 1) || soon) return 'B';
  return 'C';
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée.' });
  try {
    const supabaseUrl = Netlify.env.get('VITE_SUPABASE_URL')?.trim() ?? '';
    const supabaseKey = Netlify.env.get('VITE_SUPABASE_PUBLISHABLE_KEY')?.trim() ?? '';
    if (!supabaseUrl || !supabaseKey) return json(500, { error: 'Configuration Supabase incomplète.' });

    const payload = await req.json() as Payload;
    const firstName = clean(payload.first_name, 100);
    const email = clean(payload.email, 254).toLowerCase();
    if (!firstName || !validEmail(email)) return json(400, { error: 'Prénom ou email invalide.' });

    const raw = payload.answers ?? {};
    const answers: Record<string,string> = {};
    for (const key of Object.keys(ALLOWED) as Array<keyof typeof ALLOWED>) {
      const value = allowedValue(key, raw[key]);
      if (value) answers[key] = value;
    }

    const required = ['age_band','household_status','professional_status','income_band','real_estate_band','financial_assets_band','savings_band','primary_goal','horizon','event_12m'];
    if (required.some((key) => !answers[key])) return json(400, { error: 'Réponses incomplètes.' });
    if (['fiscalite','immobilier'].includes(answers.primary_goal) && !answers.income_tax_band) return json(400, { error: 'Fiscalité à préciser.' });

    const q = qualification(answers);
    const id = crypto.randomUUID();
    const utm: Record<string,string> = {};
    for (const [k,v] of Object.entries(payload.source_utm ?? {})) {
      if (/^(utm_source|utm_medium|utm_campaign|utm_content|utm_term|ad_id|adgroup_id)$/.test(k)) utm[k] = clean(v, 160);
    }

    const row = {
      id,
      first_name: firstName,
      email,
      ...answers,
      qualification: q,
      marketing_consent: Boolean(payload.marketing_consent),
      questionnaire_version: 'chatgpt_ads_v1',
      source_path: clean(payload.source_path || '/conseil-patrimonial', 220),
      source_utm: utm,
      result_snapshot: { purpose: 'prepare_first_meeting' },
    };

    const response = await fetch(`${supabaseUrl}/rest/v1/prospect_leads`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'content-type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error('capture-patrimonial-lead supabase failed', detail);
      return json(500, { error: 'Enregistrement impossible.' });
    }

    return json(200, { ok: true, leadId: id, qualification: q });
  } catch (error) {
    console.error('capture-patrimonial-lead failed', error);
    return json(500, { error: 'Échec de l’enregistrement.' });
  }
};

export const config = { path: '/api/capture-patrimonial-lead' };
