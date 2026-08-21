import { createClient } from '@supabase/supabase-js';

const fallbackUrl = 'https://xeloauyhlnhrvqojdudr.supabase.co';
const fallbackPublishableKey = 'sb_publishable_cbSjZNq4I5l_JlAobFUDVA_3UHkFaBA';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackUrl;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || fallbackPublishableKey;

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const SOURCE_DOCUMENTS_BUCKET = 'client-source-docs';
export const REGULATORY_DOCUMENTS_BUCKET = 'regulatory-docs';
