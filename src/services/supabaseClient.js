import { APP_CONFIG } from '../config.js';

let supabaseClientPromise = null;

export function hasSupabaseConfig() {
  return Boolean(getSupabaseUrl() && getSupabaseKey());
}

export function getSupabaseModeLabel() {
  return hasSupabaseConfig() ? 'Supabase conectado' : 'Modo local';
}

export async function getSupabaseClient() {
  if (!hasSupabaseConfig()) return null;

  if (!supabaseClientPromise) {
    supabaseClientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(getSupabaseUrl(), getSupabaseKey(), {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      })
    );
  }

  try {
    return await supabaseClientPromise;
  } catch (error) {
    console.warn('Não foi possível inicializar o Supabase. O app continuará no modo local.', error);
    supabaseClientPromise = null;
    return null;
  }
}

function getSupabaseUrl() {
  return String(APP_CONFIG.supabase?.url || '').trim();
}

function getSupabaseKey() {
  return String(APP_CONFIG.supabase?.publishableKey || APP_CONFIG.supabase?.anonKey || '').trim();
}
