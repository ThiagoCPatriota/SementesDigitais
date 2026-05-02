import { useEffect, useState } from 'react';
import {
  getActivities,
  getActivityResponses,
  syncActivitiesFromCloud,
  syncActivityAttemptsFromCloud,
  updateActivityStatus
} from '../services/activityService.js';

export function Admin({ showToast, navigate }) {
  const [activities, setActivities] = useState(() => getActivities());
  const [syncing, setSyncing] = useState(false);
  const [updatingActivityId, setUpdatingActivityId] = useState('');

  const publishedCount = activities.filter((activity) => activity.status === 'published').length;
  const finishedCount = activities.reduce((total, activity) => (
    total + getActivityResponses(activity.id).filter((item) => item.result).length
  ), 0);

  useEffect(() => {
    let isMounted = true;

    async function syncCloudData() {
      setSyncing(true);
      await Promise.all([syncActivitiesFromCloud(), syncActivityAttemptsFromCloud()]);
      if (!isMounted) return;
      setActivities(getActivities());
      setSyncing(false);
    }

    syncCloudData();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleStatusChange(activityId, status) {
    setUpdatingActivityId(activityId);

    try {
      const updated = await updateActivityStatus(activityId, status);
      setActivities(updated);
      showToast(status === 'published' ? 'Atividade publicada no Supabase.' : 'Atividade ocultada no Supabase.');
    } catch (error) {
      showToast(error?.message || 'Não foi possível atualizar o simulado no Supabase.', 'error');
    } finally {
      setUpdatingActivityId('');
    }
  }

  function openResponses(activityId) {
    navigate(`admin-respostas/${encodeURIComponent(activityId)}`);
  }

  return (
    <>
      <section className="admin-overview-grid">
        <article className="panel admin-page-card">
          <span className="eyebrow">Administração</span>
          <h1>Simulados da turma</h1>
          <p>Consulte os simulados criados, veja respostas dos alunos e publique ou oculte atividades da turma. A criação agora fica em uma aba separada para deixar o painel mais limpo.</p>
          <div className="admin-page-card__actions">
            <button className="button button--primary" type="button" onClick={() => navigate('criar-simulado')}>Criar novo simulado</button>
          </div>
        </article>

        <aside className="panel side-note admin-summary-card admin-summary-card--compact">
          <h2>Resumo do painel</h2>
          <div className="summary-list admin-summary-card__list">
            <span><strong>Atividades criadas:</strong> {activities.length}</span>
            <span><strong>Publicadas:</strong> {publishedCount}</span>
            <span><strong>Finalizações:</strong> {finishedCount}</span>
          </div>
          {syncing ? <p className="admin-sync-note">Sincronizando dados do painel...</p> : null}
          <div className="admin-summary-card__actions">
            <button className="button button--ghost button--full" type="button" onClick={() => navigate('atividades')}>Ver área de atividades</button>
          </div>
        </aside>
      </section>

      <section className="admin-activities-section">
        <div className="section-header section-header--compact">
          <span className="eyebrow">Atividades cadastradas</span>
          <h2>Todos os simulados</h2>
          <p>As atividades publicadas aparecem para os alunos. As ocultas continuam disponíveis para consulta administrativa.</p>
        </div>

        {activities.length === 0 ? (
          <article className="notice-card notice-card--soft">
            <strong>Nenhuma atividade criada ainda</strong>
            <p>Crie o primeiro simulado na aba Criar para que ele possa aparecer na área dos alunos.</p>
            <button className="button button--primary" type="button" onClick={() => navigate('criar-simulado')}>Criar simulado</button>
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
                      {isLatestPublished ? 'Mais recente' : activity.status === 'published' ? 'Publicada' : 'Oculta'}
                    </span>
                    <h3>{activity.title}</h3>
                    <p>{activity.questionCount} questões • {activity.durationMinutes} minutos • Criada em {formatDate(activity.createdAt)}</p>
                    <div className="admin-activity-card__mini-stats">
                      <span><strong>{activityResponses.length}</strong> iniciaram</span>
                      <span><strong>{activityResponses.filter((item) => item.result).length}</strong> finalizaram</span>
                      {hasAreaDistribution(activity.areaDistribution) ? <span>áreas configuradas</span> : null}
                    </div>
                  </div>

                  <div className="admin-activity-card__actions">
                    <button className="button button--ghost button--compact" type="button" onClick={() => openResponses(activity.id)}>Ver respostas</button>
                    {activity.status === 'published' ? (
                      <button className="button button--ghost button--compact" type="button" disabled={updatingActivityId === activity.id} onClick={() => handleStatusChange(activity.id, 'draft')}>{updatingActivityId === activity.id ? 'Salvando...' : 'Ocultar'}</button>
                    ) : (
                      <button className="button button--primary button--compact" type="button" disabled={updatingActivityId === activity.id} onClick={() => handleStatusChange(activity.id, 'published')}>{updatingActivityId === activity.id ? 'Salvando...' : 'Publicar'}</button>
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

function hasAreaDistribution(distribution = {}) {
  return Object.values(distribution || {}).some((value) => Number(value) > 0);
}
