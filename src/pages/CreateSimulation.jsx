import { useMemo, useState } from 'react';
import { saveExamConfig } from '../services/examService.js';
import { createActivity } from '../services/activityService.js';
import { ENEM_AREA_OPTIONS } from '../services/enemApi.js';

const MAX_QUESTIONS = 90;
const MAX_DURATION_MINUTES = 330;
const DEFAULT_AREA_FORM = ENEM_AREA_OPTIONS.reduce((accumulator, area) => {
  accumulator[area.value] = '';
  return accumulator;
}, {});

export function CreateSimulation({ config, onConfigSaved, showToast, navigate }) {
  const [form, setForm] = useState(() => ({
    sourceMode: 'enem-bank',
    examYear: 'mixed',
    ...config,
    questionCount: Math.min(Number(config.questionCount || 60), MAX_QUESTIONS),
    durationMinutes: Math.min(Number(config.durationMinutes || 300), MAX_DURATION_MINUTES),
    areaDistribution: areaDistributionToForm(config.areaDistribution),
    publishNow: true
  }));
  const [isSaving, setIsSaving] = useState(false);

  const questionCount = Number(form.questionCount || 0);
  const allocatedTotal = useMemo(() => sumAreaDistribution(form.areaDistribution), [form.areaDistribution]);
  const remainingQuestions = Math.max(0, questionCount - allocatedTotal);
  const hasAreaDistribution = allocatedTotal > 0;
  const exceedsTotal = allocatedTotal > questionCount;

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value
    }));
  }

  function updateAreaField(area, value) {
    const sanitizedValue = value === '' ? '' : Math.max(0, Number(value) || 0);
    setForm((current) => ({
      ...current,
      areaDistribution: {
        ...current.areaDistribution,
        [area]: sanitizedValue
      }
    }));
  }

  function clearAreaDistribution() {
    setForm((current) => ({ ...current, areaDistribution: { ...DEFAULT_AREA_FORM } }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const normalizedQuestionCount = Number(form.questionCount);
    const normalizedDuration = Number(form.durationMinutes);

    if (normalizedQuestionCount < 5 || normalizedQuestionCount > MAX_QUESTIONS) {
      showToast(`Informe uma quantidade entre 5 e ${MAX_QUESTIONS} questões.`, 'error');
      return;
    }

    if (normalizedDuration < 1 || normalizedDuration > MAX_DURATION_MINUTES) {
      showToast(`Informe uma duração entre 1 e ${MAX_DURATION_MINUTES} minutos.`, 'error');
      return;
    }

    if (allocatedTotal > normalizedQuestionCount) {
      showToast('A soma das áreas não pode passar do total de questões do simulado.', 'error');
      return;
    }

    setIsSaving(true);

    try {
      const activity = await createActivity({
        ...form,
        questionCount: normalizedQuestionCount,
        durationMinutes: normalizedDuration,
        areaDistribution: cleanAreaDistribution(form.areaDistribution),
        status: form.publishNow ? 'published' : 'draft'
      });

      const updatedConfig = saveExamConfig(activity);
      onConfigSaved(updatedConfig);
      showToast(activity.status === 'published' ? 'Simulado criado e publicado no Supabase.' : 'Simulado criado como rascunho no Supabase.');
      setForm((current) => ({
        ...current,
        title: '',
        publishNow: true,
        questionSeed: Date.now()
      }));
      navigate('admin');
    } catch (error) {
      showToast(error?.message || 'Não foi possível salvar o simulado no Supabase.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <section className="section-header create-simulation-header">
        <span className="eyebrow">Criar simulado</span>
        <h1>Gerenciar novo simulado</h1>
        <p>Monte a atividade da turma, escolha a quantidade total e distribua as questões por área do ENEM quando quiser uma prova mais direcionada.</p>
        <button className="button button--ghost" type="button" onClick={() => navigate('admin')}>Ver simulados da turma</button>
      </section>

      <section className="form-layout create-simulation-layout">
        <form className="panel form-card create-simulation-form" onSubmit={handleSubmit}>
          <div className="form-card__intro">
            <h2>Nova atividade</h2>
            <p>Defina os dados principais do simulado que será disponibilizado para os estudantes.</p>
          </div>

          <label>Nome da atividade<input name="title" value={form.title} onChange={updateField} placeholder="Ex.: Simulado de Matemática 01" required /></label>

          <div className="form-grid">
            <label>
              Quantidade de questões
              <input type="number" min="5" max={MAX_QUESTIONS} name="questionCount" value={form.questionCount} onChange={updateField} required />
              <small>Limite configurado para até {MAX_QUESTIONS} questões objetivas, como um dia completo do ENEM.</small>
            </label>
            <label>
              Duração em minutos
              <input type="number" min="1" max={MAX_DURATION_MINUTES} name="durationMinutes" value={form.durationMinutes} onChange={updateField} required />
              <small>Use até {MAX_DURATION_MINUTES} minutos quando quiser simular o maior tempo oficial.</small>
            </label>
          </div>

          <label>Código da atividade<input name="classCode" value={form.classCode} onChange={updateField} required /></label>

          <div className="form-grid">
            <label>
              Fonte de questões
              <select name="sourceMode" value={form.sourceMode || 'enem-bank'} onChange={updateField}>
                <option value="enem-bank">Banco ENEM no Supabase — questões reais</option>
                <option value="mock">Banco interno de demonstração</option>
              </select>
              <small>O app busca enunciados, alternativas e imagens do Supabase/PostgreSQL quando essa opção estiver ativa.</small>
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

          <section className="area-distribution-card">
            <div className="area-distribution-card__header">
              <div>
                <span className="eyebrow">Distribuição por área</span>
                <h3>Escolha quantas questões virão de cada área</h3>
                <p>Deixe tudo zerado para o sistema misturar automaticamente. A área de Linguagens considera as 5 questões de Inglês/Espanhol quando a escolha de língua estiver ativa.</p>
              </div>
              <button className="button button--ghost button--compact" type="button" onClick={clearAreaDistribution}>Limpar</button>
            </div>

            <div className="area-distribution-grid">
              {ENEM_AREA_OPTIONS.map((area) => (
                <label key={area.value}>
                  {area.label}
                  <input
                    type="number"
                    min="0"
                    max={MAX_QUESTIONS}
                    value={form.areaDistribution[area.value] ?? ''}
                    onChange={(event) => updateAreaField(area.value, event.target.value)}
                    placeholder="0"
                  />
                </label>
              ))}
            </div>

            <div className={`area-distribution-summary ${exceedsTotal ? 'area-distribution-summary--error' : ''}`}>
              <span><strong>{allocatedTotal}</strong> questões distribuídas</span>
              <span><strong>{remainingQuestions}</strong> restantes para mistura automática</span>
            </div>
            {hasAreaDistribution && !exceedsTotal ? (
              <p className="area-distribution-hint">O sistema tenta respeitar essa distribuição. Se a API não retornar questões suficientes para alguma área, ele completa com questões disponíveis para não quebrar a prova.</p>
            ) : null}
          </section>

          <label className="check-row">
            <input type="checkbox" name="publishNow" checked={Boolean(form.publishNow)} onChange={updateField} />
            <span>Publicar atividade para os alunos assim que salvar.</span>
          </label>

          <button className="button button--primary button--full" type="submit" disabled={isSaving}>{isSaving ? 'Salvando no Supabase...' : 'Criar simulado'}</button>
        </form>

        <aside className="panel side-note create-simulation-note">
          <span className="eyebrow">Organização</span>
          <h2>Como usar essa aba</h2>
          <div className="summary-list">
            <span><strong>1.</strong> Crie o simulado aqui.</span>
            <span><strong>2.</strong> Publique para aparecer aos alunos.</span>
            <span><strong>3.</strong> Volte para Administração para ocultar ou ver respostas.</span>
          </div>
          <button className="button button--ghost button--full" type="button" onClick={() => navigate('admin')}>Ir para Administração</button>
        </aside>
      </section>
    </>
  );
}

function areaDistributionToForm(distribution = {}) {
  return ENEM_AREA_OPTIONS.reduce((accumulator, area) => {
    const value = Number(distribution?.[area.value] || 0);
    accumulator[area.value] = value > 0 ? value : '';
    return accumulator;
  }, { ...DEFAULT_AREA_FORM });
}

function cleanAreaDistribution(distribution = {}) {
  return ENEM_AREA_OPTIONS.reduce((accumulator, area) => {
    const value = Number(distribution?.[area.value] || 0);
    if (value > 0) accumulator[area.value] = Math.trunc(value);
    return accumulator;
  }, {});
}

function sumAreaDistribution(distribution = {}) {
  return Object.values(distribution).reduce((total, value) => total + (Number(value) || 0), 0);
}
