import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'cabinet_access_token';

async function callAccessEndpoint(body: Record<string, string>) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Session expirée. Reconnecte-toi.');

  const response = await fetch('/.netlify/functions/verify-cabinet-code', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({})) as {
    valid?: boolean;
    accessToken?: string;
    error?: string;
  };

  if (!response.ok) throw new Error(payload.error || 'Vérification du code impossible.');
  return payload;
}

export async function verifyCabinetCode(code: string) {
  const payload = await callAccessEndpoint({ code });
  if (!payload.valid || !payload.accessToken) throw new Error('Code incorrect.');
  sessionStorage.setItem(STORAGE_KEY, payload.accessToken);
  return true;
}

export async function hasValidCabinetAccess() {
  const token = sessionStorage.getItem(STORAGE_KEY);
  if (!token) return false;
  try {
    const payload = await callAccessEndpoint({ accessToken: token });
    if (!payload.valid) {
      sessionStorage.removeItem(STORAGE_KEY);
      return false;
    }
    return true;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return false;
  }
}

export function clearCabinetAccess() {
  sessionStorage.removeItem(STORAGE_KEY);
}
