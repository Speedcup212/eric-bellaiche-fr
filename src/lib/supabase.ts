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

// Centralise la traçabilité des accès documentaires sans dupliquer le nom du
// fichier dans les logs. La base ne conserve qu'un hash du chemin de l'objet.
// Cette instrumentation couvre toutes les générations d'URL signées effectuées
// via le client Supabase partagé par l'application.
const storageFrom = supabase.storage.from.bind(supabase.storage);
supabase.storage.from = ((bucketId: string) => {
  const bucket = storageFrom(bucketId);
  const createSignedUrl = bucket.createSignedUrl.bind(bucket);

  bucket.createSignedUrl = (async (...args: Parameters<typeof createSignedUrl>) => {
    const result = await createSignedUrl(...args);
    const [path] = args;

    if (
      !result.error &&
      typeof path === 'string' &&
      (bucketId === SOURCE_DOCUMENTS_BUCKET || bucketId === REGULATORY_DOCUMENTS_BUCKET)
    ) {
      void supabase.rpc('log_document_access_event', {
        p_bucket: bucketId,
        p_path: path,
        p_action: 'document_signed_url',
      });
    }

    return result;
  }) as typeof bucket.createSignedUrl;

  return bucket;
}) as typeof supabase.storage.from;
