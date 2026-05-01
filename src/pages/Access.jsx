import { useState } from 'react';
import { isValidEmail, isValidPhoneShape } from '../utils/validators.js';
import { loginStudentAccount, registerStudentAccount, saveAuthSession } from '../services/authService.js';
import { save } from '../services/storage.js';

export function Access({ config, student, onAuthenticated, showToast }) {
  const [tab, setTab] = useState('register');
  const [loading, setLoading] = useState(false);

  async function handleRegister(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
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
      showToast(authResult.needsEmailConfirmation ? 'Conta criada. Verifique seu e-mail, se a confirmação estiver ativa.' : 'Conta criada com sucesso.');
      onAuthenticated(session, 'atividades');
    } catch (error) {
      showToast(error.message || 'Não foi possível criar a conta.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const validationError = validateAccessData(data, config, false);
    if (validationError) return showToast(validationError, 'error');

    setLoading(true);
    try {
      const authResult = await loginStudentAccount({ email: data.email.trim(), password: data.password });
      const session = persistAuthenticatedAccess(authResult, { classCode: data.classCode.trim().toUpperCase(), terms: true });
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
          <form className="panel form-card auth-panel" onSubmit={handleRegister}>
            <div className="form-card__intro">
              <h2>Criar conta</h2>
              <p>Use seus dados principais para acessar os simulados da turma.</p>
            </div>

            <label>Nome completo<input name="name" defaultValue={student?.name ?? ''} placeholder="Ex.: Maria Eduarda Silva" required /></label>
            <label>E-mail<input type="email" name="email" defaultValue={student?.email ?? ''} placeholder="aluno@email.com" required /></label>
            <label>WhatsApp/telefone<input name="phone" defaultValue={student?.phone ?? ''} placeholder="(81) 99999-9999" required /></label>
            <label>Escola ou turma<input name="classGroup" defaultValue={student?.classGroup ?? ''} placeholder="Ex.: Sementes Digitais — Turma A" /></label>
            <label>Senha<input type="password" name="password" placeholder="Crie uma senha de acesso" minLength="6" required /></label>
            <label>Código da atividade<input name="classCode" defaultValue={student?.classCode ?? config.classCode} placeholder="Código informado pela equipe" required /></label>
            <label className="check-row"><input type="checkbox" name="terms" defaultChecked={Boolean(student?.terms)} required /><span>Confirmo que desejo participar do simulado e aceito o uso dos dados para fins educacionais.</span></label>
            <button className="button button--primary button--full" type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Criar conta e continuar'}</button>
          </form>
        ) : (
          <form className="panel form-card auth-panel" onSubmit={handleLogin}>
            <div className="form-card__intro">
              <h2>Entrar na conta</h2>
              <p>Use o mesmo e-mail e senha cadastrados para continuar.</p>
            </div>
            <label>E-mail<input type="email" name="email" defaultValue={student?.email ?? ''} placeholder="aluno@email.com" required /></label>
            <label>Senha<input type="password" name="password" placeholder="Sua senha" minLength="6" required /></label>
            <label>Código da atividade<input name="classCode" defaultValue={student?.classCode ?? config.classCode} placeholder="Código informado pela equipe" required /></label>
            <button className="button button--primary button--full" type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar e continuar'}</button>
          </form>
        )}

        <aside className="panel side-note">
          <h2>Antes de começar</h2>
          <p>Depois do acesso, você verá as atividades disponíveis antes de iniciar a prova.</p>
          <div className="mini-stats">
            <span><strong>{config.questionCount}</strong> questões</span>
            <span><strong>{config.durationMinutes}</strong> min</span>
            <span><strong>Objetiva</strong> única</span>
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
