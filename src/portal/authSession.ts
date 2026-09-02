import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export async function stabilizeAuthSession(session: Session | null): Promise<Session> {
  if (!session) throw new Error('La connexion a été acceptée, mais aucune session sécurisée n’a été créée. Veuillez réessayer.');

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session?.user.id === session.user.id) return data.session;

    if (attempt === 1) {
      const { data: restored, error: restoreError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (restoreError) throw restoreError;
      if (restored.session?.user.id === session.user.id) return restored.session;
    }

    await wait(120 * (attempt + 1));
  }

  throw new Error('Votre identification a réussi mais la session n’a pas pu être conservée. Rechargez la page puis reconnectez-vous.');
}

export async function restoreAuthSession(): Promise<Session | null> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session) return data.session;
    if (attempt < 5) await wait(120 * (attempt + 1));
  }
  return null;
}
