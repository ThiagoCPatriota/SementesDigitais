import { useState } from 'react';
import { saveExamConfig } from '../services/examService.js';
import { createActivity, getActivities, updateActivityStatus } from '../services/activityService.js';

export function Admin({ config, onConfigSaved, showToast, navigate }) {
  const [form, setForm] = useState({ ...config, publishNow: true });
  const [activities, setActivities] = useState(() => getActivities());

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const activity = createActivity({ ...form, status: form.publishNow ? 'published' : 'draft' });
    const updatedConfig = saveExamConfig(activity);
    setActivities(getActivities());
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

  return (
    <>
      <section className="section-header">
        <span className="eyebrow">Painel administrativo</span>
        <h1>Gerenciar atividades</h1>
        <p>Crie simulados para a turma. Apenas atividades publicadas aparecem na aba de atividades dos alunos.</p>
      </section>

      <section className="form-layout">
        <form className="panel form-card" onSubmit={handleSubmit}>
          <div className="form-card__intro">
            <h2>Nova atividade</h2>
            <p>Defina os dados principais do simulado que será liberado para os estudantes.</p>
          </div>

          <label>Nome da atividade<input name="title" value={form.title} onChange={updateField} placeholder="Ex.: Simulado de Matemática 01" required /></label>

          <div className="form-grid">
            <label>Quantidade de questões<input type="number" min="5" max="60" name="questionCount" value={form.questionCount} onChange={updateField} required /></label>
            <label>Duração em minutos<input type="number" min="1" max="300" name="durationMinutes" value={form.durationMinutes} onChange={updateField} required /></label>
          </div>

          <label>Código da atividade<input name="classCode" value={form.classCode} onChange={updateField} required /></label>

          <label>
            Fonte de questões
            <select name="sourceMode" value={form.sourceMode || 'mock'} onChange={updateField}>
              <option value="mock">Banco interno de questões</option>
              <option value="enem-dev" disabled>API enem.dev — integração futura</option>
            </select>
            <small>Na versão com backend, o gabarito deve ficar protegido no servidor.</small>
          </label>

          <label className="check-row">
            <input type="checkbox" name="publishNow" checked={Boolean(form.publishNow)} onChange={updateField} />
            <span>Publicar atividade para os alunos assim que salvar.</span>
          </label>

          <button className="button button--primary button--full" type="submit">Criar atividade</button>
        </form>

        <aside className="panel side-note">
          <h2>Resumo atual</h2>
          <div className="summary-list">
            <span><strong>Atividades criadas:</strong> {activities.length}</span>
            <span><strong>Publicadas:</strong> {activities.filter((activity) => activity.status === 'published').length}</span>
            <span><strong>Rascunhos:</strong> {activities.filter((activity) => activity.status !== 'published').length}</span>
            <span><strong>Formato:</strong> prova objetiva</span>
          </div>
          <button className="button button--ghost button--full" type="button" onClick={() => navigate('atividades')}>Ver área de atividades</button>
        </aside>
      </section>

      <section className="admin-activities-section">
        <div className="section-header section-header--compact">
          <span className="eyebrow">Atividades cadastradas</span>
          <h2>Simulados da turma</h2>
          <p>Controle quais atividades ficam visíveis para os alunos.</p>
        </div>

        {activities.length === 0 ? (
          <article className="notice-card notice-card--soft">
            <strong>Nenhuma atividade criada ainda</strong>
            <p>Crie a primeira atividade acima para que ela possa aparecer na área dos alunos.</p>
          </article>
        ) : (
          <div className="admin-activity-list">
            {activities.map((activity) => (
              <article className="panel admin-activity-card" key={activity.id}>
                <div>
                  <span className={`badge ${activity.status === 'published' ? '' : 'badge--muted'}`}>
                    {activity.status === 'published' ? 'Publicada' : 'Rascunho'}
                  </span>
                  <h3>{activity.title}</h3>
                  <p>{activity.questionCount} questões • {activity.durationMinutes} minutos</p>
                </div>

                <div className="admin-activity-card__actions">
                  {activity.status === 'published' ? (
                    <button className="button button--ghost" type="button" onClick={() => handleStatusChange(activity.id, 'draft')}>Ocultar dos alunos</button>
                  ) : (
                    <button className="button button--primary" type="button" onClick={() => handleStatusChange(activity.id, 'published')}>Publicar</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
