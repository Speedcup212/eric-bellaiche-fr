import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'cabinet_access_token';

export async function verifyCabinetCode(code: string) {
  const cleanCode = code.trim();
  if (!/^\d{6}$/.test(cleanCode)) throw new Error('Saisissez votre code personnel à 6 chiffres.');

  const { data, error } = await supabase.rpc('verify_cabinet_access_code', {
    p_code: cleanCode,
  });

  if (error) throw new Error('Vérification du code impossible.');
  if (!data || typeof data !== 'string') throw new Error('Code incorrect.');

  sessionStorage.setItem(STORAGE_KEY, data);
  return true;
}

export async function hasValidCabinetAccess() {
  const token = sessionStorage.getItem(STORAGE_KEY);
  if (!token) return false;

  const { data, error } = await supabase.rpc('validate_cabinet_access_token', {
    p_token: token,
  });

  if (error || data !== true) {
    sessionStorage.removeItem(STORAGE_KEY);
    return false;
  }

  return true;
}

export function clearCabinetAccess() {
  sessionStorage.removeItem(STORAGE_KEY);
}
