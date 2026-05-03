import { useMemo, useState } from 'react';
import { saveExamConfig } from '../services/examService.js';
import { createActivity, getActivities, getActivityResponses, updateActivityStatus } from '../services/activityService.js';

export function Admin({ config, onConfigSaved, showToast, navigate }) {
  const [form, setForm] = useState({ sourceMode: 'enem-bank', examYear: 'mixed', ...config, publishNow: true });
  const [activities, setActivities] = useState(() => getActivities());
  const [selectedActivityId, setSelectedActivityId] = useState(() => getActivities()[0]?.id ?? null);

  const selectedActivity = useMemo(
    () => activities.find((activity) => activity.id === selectedActivityId) ?? activities[0] ?? null,
    [activities, selectedActivityId]
  );

  const responses = useMemo(
    () => (selectedActivity ? getActivityResponses(selectedActivity.id) : []),
    [selectedActivity, activities]
  );

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
    setSelectedActivityId(activity.id);
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

  function selectResponses(activityId) {
    setSelectedActivityId(activityId);
    window.setTimeout(() => {
      document.querySelector('#admin-responses')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    showToast('Painel de respostas atualizado.');
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
            <label>Quantidade de questões<input type="number" min="5" max="90" name="questionCount" value={form.questionCount} onChange={updateField} required /></label>
            <label>Duração em minutos<input type="number" min="1" max="330" name="durationMinutes" value={form.durationMinutes} onChange={updateField} required /></label>
          </div>

          <label>Código da atividade<input name="classCode" value={form.classCode} onChange={updateField} required /></label>

          <label>
            Fonte de questões
            <select name="sourceMode" value={form.sourceMode || 'enem-bank'} onChange={updateField}>
              <option value="enem-bank">Banco ENEM no Supabase — questões reais</option>
              <option value="mock">Banco interno de demonstração</option>
            </select>
            <small>Por padrão, a prova usa as questões reais já importadas para o Supabase/PostgreSQL, sem depender da API externa durante a prova.</small>
          </label>

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
                <article className={`panel admin-activity-card ${isLatestPublished ? 'admin-activity-card--latest' : ''} ${selectedActivityId === activity.id ? 'admin-activity-card--selected' : ''}`} key={activity.id}>
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
                    <button className="button button--ghost" type="button" onClick={() => selectResponses(activity.id)}>Ver respostas</button>
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

      <section className="admin-responses-section" id="admin-responses">
        <div className="section-header section-header--compact">
          <span className="eyebrow">Respostas dos alunos</span>
          <h2>{selectedActivity ? selectedActivity.title : 'Selecione uma atividade'}</h2>
          <p>Veja quem iniciou a atividade e acompanhe o desempenho geral de cada aluno.</p>
        </div>

        {!selectedActivity ? (
          <article className="notice-card notice-card--soft">
            <strong>Nenhum simulado selecionado</strong>
            <p>Crie ou selecione uma atividade para visualizar as respostas dos alunos.</p>
          </article>
        ) : responses.length === 0 ? (
          <article className="notice-card notice-card--soft">
            <strong>Nenhum aluno iniciou esta atividade ainda</strong>
            <p>Quando os alunos clicarem em iniciar, eles aparecerão neste painel.</p>
          </article>
        ) : (
          <div className="admin-response-grid">
            {responses.map((response) => (
              <article className="panel admin-response-card" key={response.attemptId}>
                <div className="admin-response-card__top">
                  <div>
                    <span className={`badge ${response.result ? '' : 'badge--muted'}`}>{formatStatus(response.status)}</span>
                    <h3>{response.student?.name || 'Aluno'}</h3>
                    <p>{response.student?.email || 'E-mail não informado'}</p>
                  </div>
                  <strong className="admin-response-card__score">{response.result ? `${response.scorePercent}%` : '—'}</strong>
                </div>

                <div className="summary-list admin-response-card__info">
                  <span><strong>Telefone:</strong> {response.student?.phone || 'Não informado'}</span>
                  <span><strong>Escola/turma:</strong> {response.student?.classGroup || 'Não informado'}</span>
                  <span><strong>Início:</strong> {formatDateTime(response.startedAt)}</span>
                  <span><strong>Finalização:</strong> {response.submittedAt ? formatDateTime(response.submittedAt) : 'Em andamento'}</span>
                </div>

                <div className="admin-response-metrics">
                  <span><strong>{response.answeredCount ?? 0}</strong> respondidas</span>
                  <span><strong>{response.correctCount ?? '—'}</strong> acertos</span>
                  <span><strong>{response.wrongCount ?? '—'}</strong> erros</span>
                  <span><strong>{response.blankCount ?? '—'}</strong> em branco</span>
                </div>
              </article>
            ))}
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

function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatStatus(status) {
  const labels = {
    em_andamento: 'Em andamento',
    finalizada: 'Finalizada',
    expirada: 'Expirada'
  };
  return labels[status] || status || '—';
}
