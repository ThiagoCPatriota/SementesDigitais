import { APP_CONFIG } from '../config.js';
import { load, save } from './storage.js';

let supabaseClientPromise = null;

function hasSupabaseConfig() {
  const url = APP_CONFIG.supabase?.url?.trim();
  const anonKey = APP_CONFIG.supabase?.anonKey?.trim();
  return Boolean(url && anonKey);
}

async function getSupabaseClient() {
  if (!hasSupabaseConfig()) return null;

  if (!supabaseClientPromise) {
    supabaseClientPromise = import('https://esm.sh/@supabase/supabase-js@2').then(({ createClient }) =>
      createClient(APP_CONFIG.supabase.url, APP_CONFIG.supabase.anonKey)
    );
  }

  return supabaseClientPromise;
}

export function isAdminEmail(email = '') {
  const normalizedEmail = email.trim().toLowerCase();
  return (APP_CONFIG.admin?.emails ?? []).some((adminEmail) => adminEmail.trim().toLowerCase() === normalizedEmail);
}

function normalizeRole(role, email) {
  if (role === 'admin' || isAdminEmail(email)) return 'admin';
  return 'student';
}

export function saveAuthSession({ student, role = 'student', provider = 'local' }) {
  const session = {
    role: normalizeRole(role, student.email),
    provider,
    authUserId: student.authUserId ?? null,
    email: student.email,
    name: student.name,
    signedInAt: new Date().toISOString()
  };

  save('authSession', session);
  return session;
}

export function getStoredAuthSession() {
  return load('authSession', null);
}

export function isCurrentAdmin() {
  return getStoredAuthSession()?.role === 'admin';
}

export async function registerStudentAccount({ name, email, phone, classGroup, password }) {
  const supabase = await getSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          phone,
          class_group: classGroup,
          role: 'student'
        }
      }
    });

    if (error) throw new Error(error.message);

    return {
      provider: 'supabase',
      role: 'student',
      needsEmailConfirmation: Boolean(data?.user && !data?.session),
      student: {
        name,
        email,
        phone,
        classGroup,
        authUserId: data?.user?.id ?? null
      }
    };
  }

  const localAccount = {
    name,
    email,
    phone,
    classGroup,
    role: 'student',
    createdAt: new Date().toISOString()
  };

  save('studentAccount', localAccount);

  return {
    provider: 'local',
    role: 'student',
    needsEmailConfirmation: false,
    student: localAccount
  };
}

export async function loginStudentAccount({ email, password }) {
  const supabase = await getSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw new Error(error.message);

    const metadata = data?.user?.user_metadata ?? {};
    const role = normalizeRole(data?.user?.app_metadata?.role || metadata.role, email);

    return {
      provider: 'supabase',
      role,
      student: {
        name: metadata.name || email.split('@')[0],
        email,
        phone: metadata.phone || '',
        classGroup: metadata.class_group || '',
        authUserId: data?.user?.id ?? null
      }
    };
  }

  const localAccount = load('studentAccount', null);

  if (localAccount && localAccount.email?.toLowerCase() === email.toLowerCase()) {
    return {
      provider: 'local',
      role: normalizeRole(localAccount.role, email),
      student: localAccount
    };
  }

  if (isAdminEmail(email)) {
    return {
      provider: 'local-admin-preview',
      role: 'admin',
      student: {
        name: 'Administrador',
        email,
        phone: '',
        classGroup: 'Equipe Sementes Digitais',
        authUserId: null
      }
    };
  }

  throw new Error('Conta não encontrada neste navegador. Faça o cadastro primeiro.');
}
