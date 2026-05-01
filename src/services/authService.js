import { APP_CONFIG } from '../config.js';
import { load, remove, save } from './storage.js';
import { getSupabaseClient } from './supabaseClient.js';

export class AccountAlreadyExistsError extends Error {
  constructor(email) {
    super('Já existe uma conta cadastrada com este e-mail. Entre pela aba Login.');
    this.name = 'AccountAlreadyExistsError';
    this.code = 'ACCOUNT_ALREADY_EXISTS';
    this.email = email;
  }
}

export function isAccountAlreadyExistsError(error) {
  return error?.code === 'ACCOUNT_ALREADY_EXISTS' || error?.name === 'AccountAlreadyExistsError';
}

function isDuplicateSupabaseError(error) {
  const message = error?.message?.toLowerCase() || '';
  return (
    message.includes('already registered') ||
    message.includes('already been registered') ||
    message.includes('user already registered') ||
    message.includes('already exists')
  );
}


export function isAdminEmail(email = '') {
  const normalizedEmail = email.trim().toLowerCase();
  return (APP_CONFIG.admin?.emails ?? []).some((adminEmail) => adminEmail.trim().toLowerCase() === normalizedEmail);
}

function normalizeRole(role, email) {
  if (role === 'admin' || isAdminEmail(email)) return 'admin';
  return 'student';
}

function isSessionExpired(session) {
  if (!session?.signedInAt) return true;
  const ttlMs = Number(APP_CONFIG.sessionDurationHours || 10) * 60 * 60 * 1000;
  return Date.now() - new Date(session.signedInAt).getTime() > ttlMs;
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
  const session = load('authSession', null);
  if (!session) return null;

  if (isSessionExpired(session)) {
    clearAuthSession();
    return null;
  }

  return session;
}

export function clearAuthSession() {
  remove('authSession');
  remove('student');
}

export function isCurrentAdmin() {
  return getStoredAuthSession()?.role === 'admin';
}

export async function registerStudentAccount({ name, email, phone, classGroup, password }) {
  const normalizedEmail = email.trim().toLowerCase();
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

    if (error) {
      if (isDuplicateSupabaseError(error)) throw new AccountAlreadyExistsError(email);
      throw new Error(error.message);
    }

    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new AccountAlreadyExistsError(email);
    }

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

  const existingLocalAccount = load('studentAccount', null);
  if (existingLocalAccount?.email?.toLowerCase() === normalizedEmail) {
    throw new AccountAlreadyExistsError(email);
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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

export async function signOut() {
  const supabase = await getSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  clearAuthSession();
}
