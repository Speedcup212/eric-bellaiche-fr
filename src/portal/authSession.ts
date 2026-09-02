import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const AUTH_TRANSITION_KEY = 'cgp_auth_transition_at';
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function markFreshAuthTransition() {
  sessionStorage.setItem(AUTH_TRANSITION_KEY, String(Date.now()));
}

function hasFreshAuthTransition() {
  const raw = sessionStorage.getItem(AUTH_TRANSITION_KEY);
  const timestamp = Number(raw ?? 0);
  return Number.isFinite(timestamp) && timestamp > 0 && Date.now() - timestamp < 5000;
}

function clearAuthTransition() {
  sessionStorage.removeItem(AUTH_TRANSITION_KEY);
}

export async function stabilizeAuthSession(session: Session | null): Promise<Session> {
  if (!session) throw new Error('La connexion a été acceptée, mais aucune session sécurisée n’a été créée. Veuillez réessayer.');

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session?.user.id === session.user.id) {
      markFreshAuthTransition();
      return data.session;
    }

    if (attempt === 1) {
      const { data: restored, error: restoreError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (restoreError) throw restoreError;
      if (restored.session?.user.id === session.user.id) {
        markFreshAuthTransition();
        return restored.session;
      }
    }

    await wait(120 * (attempt + 1));
  }

  clearAuthTransition();
  throw new Error('Votre identification a réussi mais la session n’a pas pu être conservée. Rechargez la page puis reconnectez-vous.');
}

export async function restoreAuthSession(): Promise<Session | null> {
  const attempts = hasFreshAuthTransition() ? 6 : 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session) {
      clearAuthTransition();
      return data.session;
    }
    if (attempt < attempts - 1) await wait(120 * (attempt + 1));
  }

  clearAuthTransition();
  return null;
}
