import { useMemo, useState } from 'react';
import { APP_CONFIG, ENEM_AREAS } from '../config.js';
import { Icon } from '../components/Icon.jsx';
import { startAttempt } from '../services/examService.js';
import { createPersonalActivity, updatePersonalActivity } from '../services/activityService.js';

export function CreatePersonalActivity({ student, config, navigate, showToast, refreshAttempt, refreshResult }) {
  const [form, setForm] = useState(() => {
    const questionCount = APP_CONFIG.personalActivity.questionCount;
    return {
      title: APP_CONFIG.personalActivity.title,
      questionCount,
      durationMinutes: APP_CONFIG.personalActivity.durationMinutes,
      areaDistribution: distributeEvenly(questionCount)
    };
  });

  const totalByArea = useMemo(
    () => Object.values(form.areaDistribution).reduce((sum, value) => sum + Number(value || 0), 0),
    [form.areaDistribution]
  );
  const missingQuestions = Number(form.questionCount || 0) - totalByArea;
  const isBalanced = missingQuestions === 0;

  function updateField(event) {
    const { name, value } = event.target;

    if (name === 'questionCount') {
      const nextCount = clampNumber(value, 1, APP_CONFIG.personalActivity.maxQuestionCount || 90);
      setForm((current) => ({
        ...current,
        questionCount: nextCount,
        areaDistribution: distributeEvenly(nextCount)
      }));
      return;
    }

    if (name === 'durationMinutes') {
      setForm((current) => ({
        ...current,
        durationMinutes: clampNumber(value, 1, APP_CONFIG.personalActivity.maxDurationMinutes || 330)
      }));
      return;
    }

    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateArea(areaKey, value) {
    const nextValue = clampNumber(value, 0, Number(form.questionCount || 0));
    setForm((current) => ({
      ...current,
      areaDistribution: {
        ...current.areaDistribution,
        [areaKey]: nextValue
      }
    }));
  }

  function resetDistribution() {
    setForm((current) => ({
      ...current,
      areaDistribution: distributeEvenly(Number(current.questionCount || APP_CONFIG.personalActivity.questionCount))
    }));
  }

  function fillWithArea(areaKey) {
    setForm((current) => {
      const distribution = Object.fromEntries(ENEM_AREAS.map((area) => [area.storageKey, 0]));
      distribution[areaKey] = Number(current.questionCount || 0);
      return { ...current, areaDistribution: distribution };
    });
  }

  function handleSubmit(event) {
    event.preventDefault();

    const questionCount = Number(form.questionCount);
    const durationMinutes = Number(form.durationMinutes);

    if (!form.title.trim()) {
      showToast('Informe um nome para a atividade pessoal.', 'error');
      return;
    }

    if (questionCount < 1 || questionCount > (APP_CONFIG.personalActivity.maxQuestionCount || 90)) {
      showToast('Informe uma quantidade entre 1 e 90 questões.', 'error');
      return;
    }

    if (durationMinutes < 1 || durationMinutes > (APP_CONFIG.personalActivity.maxDurationMinutes || 330)) {
      showToast('Informe um tempo entre 1 e 330 minutos.', 'error');
      return;
    }

    if (!isBalanced) {
      showToast('A soma das áreas precisa ser igual ao total de questões.', 'error');
      return;
    }

    const activity = createPersonalActivity({
      ...form,
      title: form.title.trim(),
      questionCount,
      durationMinutes,
      ownerEmail: student.email,
      classCode: config.classCode,
      sourceMode: config.sourceMode || 'mock',
      areaDistribution: cleanDistribution(form.areaDistribution)
    });

    const attempt = startAttempt(student, { ...activity, activityType: 'pessoal', activityId: activity.id });

    updatePersonalActivity(student.email, activity.id, {
      status: 'in_progress',
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      attemptSnapshot: attempt,
      answersSnapshot: {}
    });

    refreshAttempt();
    refreshResult?.();
    showToast('Atividade pessoal criada. Boa prática!');
    navigate('prova');
  }

  return (
    <>
      <section className="section-header create-personal-header">
        <span className="eyebrow">Criar atividade pessoal</span>
        <h1>Monte sua prática ENEM</h1>
        <p>Escolha o total de questões, o tempo e como essa prática será distribuída entre as áreas do ENEM.</p>
      </section>

      <section className="form-layout create-personal-layout">
        <form className="panel form-card create-personal-form" onSubmit={handleSubmit}>
          <div className="form-card__intro">
            <h2>Nova atividade pessoal</h2>
            <p>Essa atividade fica salva no seu histórico e pode ser retomada enquanto estiver em andamento.</p>
          </div>

          <label>
            Nome da atividade
            <input name="title" value={form.title} onChange={updateField} placeholder="Ex.: Revisão de Natureza" required />
          </label>

          <div className="form-grid">
            <label>
              Quantidade de questões
              <input
                type="number"
                min="1"
                max={APP_CONFIG.personalActivity.maxQuestionCount || 90}
                name="questionCount"
                value={form.questionCount}
                onChange={updateField}
                required
              />
              <small>Máximo de 90 questões.</small>
            </label>

            <label>
              Tempo em minutos
              <input
                type="number"
                min="1"
                max={APP_CONFIG.personalActivity.maxDurationMinutes || 330}
                name="durationMinutes"
                value={form.durationMinutes}
                onChange={updateField}
                required
              />
              <small>Máximo de 330 minutos.</small>
            </label>
          </div>

          <div className="area-distribution-card">
            <div className="area-distribution-card__header">
              <div>
                <span className="eyebrow">Distribuição por área</span>
                <h3>Escolha as áreas da sua prática</h3>
              </div>
              <button className="button button--ghost button--compact" type="button" onClick={resetDistribution}>
                Distribuir automático
              </button>
            </div>

            <div className="area-distribution-grid">
              {ENEM_AREAS.map((area) => (
                <label className="area-distribution-item" key={area.key}>
                  <span>{area.label}</span>
                  <input
                    type="number"
                    min="0"
                    max={form.questionCount}
                    value={form.areaDistribution[area.storageKey] ?? 0}
                    onChange={(event) => updateArea(area.storageKey, event.target.value)}
                  />
                  <button className="area-distribution-item__shortcut" type="button" onClick={() => fillWithArea(area.storageKey)}>
                    Usar só esta área
                  </button>
                </label>
              ))}
            </div>

            <div className={`area-distribution-total ${isBalanced ? 'area-distribution-total--ok' : 'area-distribution-total--alert'}`}>
              <strong>{totalByArea}</strong> de <strong>{form.questionCount}</strong> questões distribuídas
              {!isBalanced ? (
                <span>{missingQuestions > 0 ? `Faltam ${missingQuestions}` : `Excedeu ${Math.abs(missingQuestions)}`} questões.</span>
              ) : (
                <span>Distribuição pronta para iniciar.</span>
              )}
            </div>
          </div>

          <button className="button button--primary button--full" type="submit">
            Criar e iniciar prática
          </button>
        </form>

        <aside className="panel side-note create-personal-preview">
          <div className="create-personal-preview__icon">
            <Icon name="target" />
          </div>
          <h2>Resumo da prática</h2>
          <div className="summary-list">
            <span><strong>Questões:</strong> {form.questionCount}</span>
            <span><strong>Tempo:</strong> {form.durationMinutes} minutos</span>
            <span><strong>Distribuídas:</strong> {totalByArea}</span>
          </div>

          <div className="create-personal-preview__areas">
            {ENEM_AREAS.map((area) => (
              <span key={area.key}>
                <strong>{form.areaDistribution[area.storageKey] ?? 0}</strong>
                {area.label}
              </span>
            ))}
          </div>
        </aside>
      </section>
    </>
  );
}

function distributeEvenly(totalQuestions) {
  const total = Number(totalQuestions || 0);
  const base = Math.floor(total / ENEM_AREAS.length);
  let remainder = total % ENEM_AREAS.length;

  return Object.fromEntries(
    ENEM_AREAS.map((area) => {
      const value = base + (remainder > 0 ? 1 : 0);
      remainder -= 1;
      return [area.storageKey, value];
    })
  );
}

function cleanDistribution(distribution = {}) {
  return Object.fromEntries(
    ENEM_AREAS.map((area) => [area.storageKey, Number(distribution[area.storageKey] || 0)])
  );
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (Number.isNaN(number)) return min;
  return Math.min(max, Math.max(min, number));
}
