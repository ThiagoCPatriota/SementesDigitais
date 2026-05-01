import { useState } from 'react';
import { isValidEmail, isValidPhoneShape } from '../utils/validators.js';
import { isAccountAlreadyExistsError, loginStudentAccount, registerStudentAccount, saveAuthSession } from '../services/authService.js';
import { save } from '../services/storage.js';
import { Icon } from '../components/Icon.jsx';

const emptyRegisterForm = {
  name: '',
  email: '',
  phone: '',
  classGroup: '',
  password: '',
  classCode: '',
  terms: false
};

const emptyLoginForm = {
  email: '',
  password: '',
  classCode: ''
};

export function Access({ config, onAuthenticated, showToast }) {
  const [tab, setTab] = useState('register');
  const [loading, setLoading] = useState(false);
  const [registerForm, setRegisterForm] = useState(emptyRegisterForm);
  const [loginForm, setLoginForm] = useState(emptyLoginForm);

  function updateRegisterField(field, value) {
    setRegisterForm((current) => ({ ...current, [field]: value }));
  }

  function updateLoginField(field, value) {
    setLoginForm((current) => ({ ...current, [field]: value }));
  }

  function resetAccessForms() {
    setRegisterForm(emptyRegisterForm);
    setLoginForm(emptyLoginForm);
  }

  async function handleRegister(event) {
    event.preventDefault();
    const data = registerForm;
    const validationError = validateAccessData(data, config, true);
    if (validationError) return showToast(validationError, 'error');

    setLoading(true);
    try {
      const authResult = await registerStudentAccount({
        name: data.name.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        classGroup: data.classGroup.trim(),
        password: data.password
      });
      const session = persistAuthenticatedAccess(authResult, { classCode: data.classCode.trim().toUpperCase(), terms: data.terms });
      resetAccessForms();
      showToast(authResult.needsEmailConfirmation ? 'Conta criada. Verifique seu e-mail, se a confirmação estiver ativa.' : 'Conta criada com sucesso.');
      onAuthenticated(session, 'atividades');
    } catch (error) {
      if (isAccountAlreadyExistsError(error)) {
        resetAccessForms();
        setTab('login');
        showToast('Esse endereço de e-mail já existe. Entre pela aba Login.', 'error');
        return;
      }

      showToast(error.message || 'Não foi possível criar a conta.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    const data = loginForm;
    const validationError = validateAccessData(data, config, false);
    if (validationError) return showToast(validationError, 'error');

    setLoading(true);
    try {
      const authResult = await loginStudentAccount({ email: data.email.trim(), password: data.password });
      const session = persistAuthenticatedAccess(authResult, { classCode: data.classCode.trim().toUpperCase(), terms: true });
      resetAccessForms();
      showToast(session.role === 'admin' ? 'Login administrativo realizado.' : 'Login realizado com sucesso.');
      onAuthenticated(session, 'atividades');
    } catch (error) {
      showToast(error.message || 'Não foi possível fazer login.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="section-header section-header--auth">
        <span className="eyebrow">Área do aluno</span>
        <h1>Acesso do estudante</h1>
        <p>Crie sua conta ou entre novamente para visualizar as atividades disponíveis.</p>
        <div className="auth-tabs" role="tablist" aria-label="Cadastro ou login">
          <button className={`auth-tabs__button ${tab === 'register' ? 'auth-tabs__button--active' : ''}`} type="button" onClick={() => setTab('register')}>Cadastro</button>
          <button className={`auth-tabs__button ${tab === 'login' ? 'auth-tabs__button--active' : ''}`} type="button" onClick={() => setTab('login')}>Login</button>
        </div>
      </section>

      <section className="form-layout">
        {tab === 'register' ? (
          <form className="panel form-card auth-panel" onSubmit={handleRegister} autoComplete="off">
            <div className="form-card__intro">
              <h2>Criar conta</h2>
              <p>Use seus dados principais para acessar os simulados da turma.</p>
            </div>

            <label>
              Nome completo
              <input
                name="register-name"
                value={registerForm.name}
                onChange={(event) => updateRegisterField('name', event.target.value)}
                placeholder="Ex.: Maria Eduarda Silva"
                autoComplete="off"
                required
              />
            </label>
            <label>
              E-mail
              <input
                type="email"
                name="register-email"
                value={registerForm.email}
                onChange={(event) => updateRegisterField('email', event.target.value)}
                placeholder="aluno@email.com"
                autoComplete="off"
                required
              />
            </label>
            <label>
              WhatsApp/telefone
              <input
                name="register-phone"
                value={registerForm.phone}
                onChange={(event) => updateRegisterField('phone', event.target.value)}
                placeholder="(81) 99999-9999"
                autoComplete="off"
                required
              />
            </label>
            <label>
              Escola ou turma
              <input
                name="register-classGroup"
                value={registerForm.classGroup}
                onChange={(event) => updateRegisterField('classGroup', event.target.value)}
                placeholder="Ex.: Sementes Digitais — Turma A"
                autoComplete="off"
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                name="register-password"
                value={registerForm.password}
                onChange={(event) => updateRegisterField('password', event.target.value)}
                placeholder="Crie uma senha de acesso"
                minLength="6"
                autoComplete="new-password"
                required
              />
            </label>
            <label>
              Código da atividade
              <input
                name="register-classCode"
                value={registerForm.classCode}
                onChange={(event) => updateRegisterField('classCode', event.target.value)}
                placeholder="Código informado pela equipe"
                autoComplete="off"
                required
              />
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                name="register-terms"
                checked={registerForm.terms}
                onChange={(event) => updateRegisterField('terms', event.target.checked)}
                required
              />
              <span>Confirmo que desejo participar do simulado e aceito o uso dos dados para fins educacionais.</span>
            </label>
            <button className="button button--primary button--full" type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Criar conta e continuar'}</button>
          </form>
        ) : (
          <form className="panel form-card auth-panel" onSubmit={handleLogin} autoComplete="off">
            <div className="form-card__intro">
              <h2>Entrar na conta</h2>
              <p>Use o mesmo e-mail e senha cadastrados para continuar.</p>
            </div>
            <label>
              E-mail
              <input
                type="email"
                name="login-email"
                value={loginForm.email}
                onChange={(event) => updateLoginField('email', event.target.value)}
                placeholder="aluno@email.com"
                autoComplete="off"
                required
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                name="login-password"
                value={loginForm.password}
                onChange={(event) => updateLoginField('password', event.target.value)}
                placeholder="Sua senha"
                minLength="6"
                autoComplete="new-password"
                required
              />
            </label>
            <label>
              Código da atividade
              <input
                name="login-classCode"
                value={loginForm.classCode}
                onChange={(event) => updateLoginField('classCode', event.target.value)}
                placeholder="Código informado pela equipe"
                autoComplete="off"
                required
              />
            </label>
            <button className="button button--primary button--full" type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar e continuar'}</button>
          </form>
        )}

        <aside className="panel side-note access-info-card">
          <div className="access-info-card__icon-wrap">
            <Icon name="seed" className="access-info-card__icon" />
          </div>
          <span className="eyebrow">Sementes Digitais</span>
          <h2>Preparação com propósito</h2>
          <p>
            Entre com sua conta para acessar atividades, criar práticas pessoais
            e organizar sua rotina de estudos em um ambiente simples e focado.
          </p>
          <div className="access-benefits">
            <span>Acesso rápido</span>
            <span>Atividades organizadas</span>
            <span>Prática no seu ritmo</span>
          </div>
        </aside>
      </section>
    </>
  );
}

function validateAccessData(data, config, isRegister) {
  if (isRegister && !data.name?.trim()) return 'Informe seu nome completo.';
  if (!isValidEmail(data.email)) return 'Informe um e-mail válido.';
  if (isRegister && !isValidPhoneShape(data.phone)) return 'Informe um telefone válido com DDD.';
  if (!data.password || data.password.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (data.classCode.trim().toUpperCase() !== config.classCode.toUpperCase()) return 'Código da atividade incorreto.';
  return '';
}

function persistAuthenticatedAccess(authResult, { classCode, terms }) {
  const student = authResult.student;
  const normalizedStudent = {
    name: student.name?.trim() || student.email.split('@')[0],
    email: student.email.trim(),
    phone: student.phone?.trim() || '',
    classGroup: student.classGroup?.trim() || '',
    classCode,
    terms: Boolean(terms),
    authUserId: student.authUserId ?? null,
    createdAt: new Date().toISOString()
  };

  save('student', normalizedStudent);
  return saveAuthSession({
    student: normalizedStudent,
    role: authResult.role || 'student',
    provider: authResult.provider || 'local'
  });
}
