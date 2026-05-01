import { useState } from 'react';
import { saveExamConfig } from '../services/examService.js';
import { createActivity, getActivities, getActivityResponses, updateActivityStatus } from '../services/activityService.js';

export function Admin({ config, onConfigSaved, showToast, navigate }) {
  const [form, setForm] = useState({ sourceMode: 'enem-dev', examYear: 'mixed', ...config, publishNow: true });
  const [activities, setActivities] = useState(() => getActivities());

  const publishedCount = activities.filter((activity) => activity.status === 'published').length;
  const totalStarted = activities.reduce((total, activity) => total + getActivityResponses(activity.id).length, 0);

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const activity = createActivity({ ...form, status: form.publishNow ? 'published' : 'draft' });
    const updatedConfig = saveExamConfig(activity);
    const nextActivities = getActivities();
    setActivities(nextActivities);
    onConfigSaved(updatedConfig);
    showToast(activity.status === 'published' ? 'Atividade criada e publicada para os alunos.' : 'Atividade criada como rascunho.');
    setForm((current) => ({
      ...current,
      title: '',
      publishNow: true
    }));
  }

  function handleStatusChange(activityId, status) {
    const updated = updateActivityStatus(activityId, status);
    setActivities(updated);
    showToast(status === 'published' ? 'Atividade publicada para os alunos.' : 'Atividade ocultada dos alunos.');
  }

  function openResponses(activityId) {
    navigate(`admin-respostas/${encodeURIComponent(activityId)}`);
  }

  return (
    <>
      <section className="section-header">
        <span className="eyebrow">Painel administrativo</span>
        <h1>Gerenciar simulados</h1>
        <p>Crie atividades para a turma, mantenha o histórico dos simulados e acompanhe os alunos que iniciaram cada prova.</p>
      </section>

      <section className="form-layout">
        <form className="panel form-card" onSubmit={handleSubmit}>
          <div className="form-card__intro">
            <h2>Nova atividade</h2>
            <p>Defina os dados principais do simulado que será disponibilizado para os estudantes.</p>
          </div>

          <label>Nome da atividade<input name="title" value={form.title} onChange={updateField} placeholder="Ex.: Simulado de Matemática 01" required /></label>

          <div className="form-grid">
            <label>Quantidade de questões<input type="number" min="5" max="60" name="questionCount" value={form.questionCount} onChange={updateField} required /></label>
            <label>Duração em minutos<input type="number" min="1" max="300" name="durationMinutes" value={form.durationMinutes} onChange={updateField} required /></label>
          </div>

          <label>Código da atividade<input name="classCode" value={form.classCode} onChange={updateField} required /></label>

          <div className="form-grid">
            <label>
              Fonte de questões
              <select name="sourceMode" value={form.sourceMode || 'enem-dev'} onChange={updateField}>
                <option value="enem-dev">API enem.dev — questões reais do ENEM</option>
                <option value="mock">Banco interno de demonstração</option>
              </select>
              <small>Para o MVP, o app busca enunciados, alternativas e imagens direto da API.</small>
            </label>

            <label>
              Ano da prova
              <select name="examYear" value={form.examYear || 'mixed'} onChange={updateField} disabled={(form.sourceMode || 'enem-dev') === 'mock'}>
                <option value="mixed">Misturar anos 2009–2023</option>
                {Array.from({ length: 15 }, (_, index) => 2023 - index).map((year) => (
                  <option key={year} value={year}>ENEM {year}</option>
                ))}
              </select>
              <small>Use “misturar anos” para aproveitar o banco com mais variedade.</small>
            </label>
          </div>

          <label className="check-row">
            <input type="checkbox" name="publishNow" checked={Boolean(form.publishNow)} onChange={updateField} />
            <span>Publicar atividade para os alunos assim que salvar.</span>
          </label>

          <button className="button button--primary button--full" type="submit">Criar atividade</button>
        </form>

        <aside className="panel side-note admin-summary-card">
          <h2>Resumo do painel</h2>
          <div className="summary-list">
            <span><strong>Atividades criadas:</strong> {activities.length}</span>
            <span><strong>Publicadas:</strong> {publishedCount}</span>
            <span><strong>Rascunhos:</strong> {activities.length - publishedCount}</span>
            <span><strong>Alunos iniciaram:</strong> {totalStarted}</span>
          </div>
          <button className="button button--ghost button--full" type="button" onClick={() => navigate('atividades')}>Ver área de atividades</button>
        </aside>
      </section>

      <section className="admin-activities-section">
        <div className="section-header section-header--compact">
          <span className="eyebrow">Atividades cadastradas</span>
          <h2>Simulados da turma</h2>
          <p>As atividades publicadas aparecem para os alunos. As antigas continuam disponíveis no histórico para consulta de resultados.</p>
        </div>

        {activities.length === 0 ? (
          <article className="notice-card notice-card--soft">
            <strong>Nenhuma atividade criada ainda</strong>
            <p>Crie a primeira atividade acima para que ela possa aparecer na área dos alunos.</p>
          </article>
        ) : (
          <div className="admin-activity-list admin-activity-list--cards">
            {activities.map((activity, index) => {
              const activityResponses = getActivityResponses(activity.id);
              const isLatestPublished = activity.status === 'published' && index === activities.findIndex((item) => item.status === 'published');

              return (
                <article className={`panel admin-activity-card ${isLatestPublished ? 'admin-activity-card--latest' : ''}`} key={activity.id}>
                  <div className="admin-activity-card__main">
                    <span className={`badge ${activity.status === 'published' ? '' : 'badge--muted'}`}>
                      {isLatestPublished ? 'Mais recente' : activity.status === 'published' ? 'Publicada' : 'Rascunho'}
                    </span>
                    <h3>{activity.title}</h3>
                    <p>{activity.questionCount} questões • {activity.durationMinutes} minutos • Criada em {formatDate(activity.createdAt)}</p>
                    <div className="admin-activity-card__mini-stats">
                      <span><strong>{activityResponses.length}</strong> iniciaram</span>
                      <span><strong>{activityResponses.filter((item) => item.result).length}</strong> finalizaram</span>
                    </div>
                  </div>

                  <div className="admin-activity-card__actions">
                    <button className="button button--ghost" type="button" onClick={() => openResponses(activity.id)}>Ver respostas</button>
                    {activity.status === 'published' ? (
                      <button className="button button--ghost" type="button" onClick={() => handleStatusChange(activity.id, 'draft')}>Ocultar</button>
                    ) : (
                      <button className="button button--primary" type="button" onClick={() => handleStatusChange(activity.id, 'published')}>Publicar</button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}
