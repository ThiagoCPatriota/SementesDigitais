import { useEffect, useMemo, useState } from 'react';
import { getActivities, getActivityResponses, syncActivitiesFromCloud, syncActivityAttemptsFromCloud, updateActivityStatus } from '../services/activityService.js';

export function Admin({ showToast, navigate }) {
  const [activities, setActivities] = useState(() => getActivities());
  const [syncingCloud, setSyncingCloud] = useState(false);

  const dashboard = useMemo(() => buildAdminDashboard(activities), [activities]);

  useEffect(() => {
    let isMounted = true;

    async function syncCloudData() {
      setSyncingCloud(true);
      await Promise.all([syncActivitiesFromCloud(), syncActivityAttemptsFromCloud()]);
      if (!isMounted) return;
      setActivities(getActivities());
      setSyncingCloud(false);
    }

    syncCloudData();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleStatusChange(activityId, status) {
    const updated = updateActivityStatus(activityId, status);
    setActivities(updated);
    showToast(status === 'published' ? 'Simulado publicado no mural dos alunos.' : 'Simulado ocultado do mural dos alunos.');
  }

  function openResponses(activityId) {
    navigate(`respostas/${activityId}`);
  }

  return (
    <>
      <section className="section-header admin-management-header">
        <span className="eyebrow">Administração</span>
        <h1>Simulados da turma</h1>
        <p>Gerencie os simulados já criados, publique ou oculte no mural dos alunos e abra o painel de respostas de cada atividade.</p>
        {syncingCloud ? <p className="admin-sync-note">Sincronizando simulados e respostas do Supabase...</p> : null}
      </section>

      <section className="admin-dashboard-grid admin-dashboard-grid--management" aria-label="Resumo dos simulados da turma">
        <article className="panel admin-dashboard-card">
          <span>Simulados</span>
          <strong>{activities.length}</strong>
          <small>Total criado pela equipe.</small>
        </article>
        <article className="panel admin-dashboard-card">
          <span>No mural</span>
          <strong>{dashboard.published}</strong>
          <small>Visíveis para os alunos.</small>
        </article>
        <article className="panel admin-dashboard-card">
          <span>Ocultos</span>
          <strong>{dashboard.drafts}</strong>
          <small>Guardados como rascunho.</small>
        </article>
        <article className="panel admin-dashboard-card">
          <span>Inícios</span>
          <strong>{dashboard.started}</strong>
          <small>Tentativas registradas.</small>
        </article>
      </section>

      <section className="admin-activities-section">
        <div className="section-header section-header--compact admin-management-title-row">
          <div>
            <span className="eyebrow">Controle da turma</span>
            <h2>Atividades cadastradas</h2>
            <p>Use “Ver respostas” para abrir uma tela dedicada com dashboard, alunos e gabarito do simulado.</p>
          </div>
          <button className="button button--primary" type="button" onClick={() => navigate('criar')}>Criar novo simulado</button>
        </div>

        {activities.length === 0 ? (
          <article className="notice-card notice-card--soft">
            <strong>Nenhum simulado criado ainda</strong>
            <p>Abra a aba Criar para cadastrar o primeiro simulado da turma.</p>
          </article>
        ) : (
          <div className="admin-activity-list admin-activity-list--cards admin-activity-list--management">
            {activities.map((activity, index) => {
              const activityResponses = getActivityResponses(activity.id);
              const finishedCount = activityResponses.filter((item) => item.result).length;
              const inProgressCount = activityResponses.filter((item) => !item.result).length;
              const isLatestPublished = activity.status === 'published' && index === activities.findIndex((item) => item.status === 'published');

              return (
                <article className={`panel admin-activity-card ${isLatestPublished ? 'admin-activity-card--latest' : ''}`} key={activity.id}>
                  <div className="admin-activity-card__main">
                    <span className={`badge ${activity.status === 'published' ? '' : 'badge--muted'}`}>
                      {activity.status === 'published' ? 'No mural' : 'Oculto'}
                    </span>
                    <h3>{activity.title}</h3>
                    <p>{activity.questionCount} questões base • +5 se escolher língua • {activity.durationMinutes} minutos</p>
                    <p>Criado em {formatDate(activity.createdAt)}</p>
                    <div className="admin-activity-card__mini-stats">
                      <span><strong>{activityResponses.length}</strong> iniciaram</span>
                      <span><strong>{finishedCount}</strong> finalizaram</span>
                      <span><strong>{inProgressCount}</strong> em andamento</span>
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

function buildAdminDashboard(activities) {
  return activities.reduce((dashboard, activity) => {
    const responses = getActivityResponses(activity.id);
    dashboard.started += responses.length;
    if (activity.status === 'published') dashboard.published += 1;
    if (activity.status !== 'published') dashboard.drafts += 1;
    return dashboard;
  }, { published: 0, drafts: 0, started: 0 });
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}
