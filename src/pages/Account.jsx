export function Account({ student, session, onSignOut }) {
  if (!student || !session) return null;

  return (
    <>
      <section className="section-header dashboard-header">
        <span className="eyebrow">Conta</span>
        <h1>Perfil e acesso</h1>
        <p>Veja seus dados principais e encerre a sessão quando terminar de usar o sistema.</p>
      </section>

      <section className="form-layout account-layout">
        <article className="panel form-card">
          <div className="form-card__intro">
            <h2>{student.name}</h2>
            <p>{session.role === 'admin' ? 'Conta administrativa' : 'Conta de estudante'}</p>
          </div>
          <div className="summary-list">
            <span><strong>E-mail:</strong> {student.email}</span>
            <span><strong>Telefone:</strong> {student.phone || 'Não informado'}</span>
            <span><strong>Escola/turma:</strong> {student.classGroup || 'Não informado'}</span>
            <span><strong>Tipo de acesso:</strong> {session.role === 'admin' ? 'Administrador' : 'Aluno'}</span>
          </div>
        </article>

        <aside className="panel side-note account-menu-card">
          <h2>Menu da conta</h2>
          <p>A sessão local fica ativa por tempo limitado. Use o botão abaixo para sair imediatamente.</p>
          <button className="button button--danger button--full" type="button" onClick={onSignOut}>Sair da conta</button>
        </aside>
      </section>
    </>
  );
}
