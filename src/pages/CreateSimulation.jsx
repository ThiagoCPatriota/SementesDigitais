import { useMemo, useState } from 'react';
import { saveExamConfig } from '../services/examService.js';
import { createActivity } from '../services/activityService.js';
import { ENEM_AREA_OPTIONS, ENEM_AVAILABLE_YEARS } from '../services/enemApi.js';

const MAX_QUESTIONS = 90;
const MAX_DURATION_MINUTES = 330;
const DEFAULT_AREA_FORM = ENEM_AREA_OPTIONS.reduce((accumulator, area) => {
  accumulator[area.value] = '';
  return accumulator;
}, {});

export function CreateSimulation({ config, onConfigSaved, showToast, navigate }) {
  const [form, setForm] = useState(() => ({
    examYear: 'mixed',
    ...config,
    sourceMode: 'enem-bank',
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

  function distributeAutomatically() {
    const total = Number(form.questionCount || 0);
    const base = Math.floor(total / ENEM_AREA_OPTIONS.length);
    const remainder = total % ENEM_AREA_OPTIONS.length;

    setForm((current) => ({
      ...current,
      areaDistribution: ENEM_AREA_OPTIONS.reduce((accumulator, area, index) => {
        accumulator[area.value] = base + (index < remainder ? 1 : 0);
        return accumulator;
      }, {})
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
      showToast('A soma das áreas não pode passar do total base de questões do simulado.', 'error');
      return;
    }

    setIsSaving(true);

    try {
      const activity = await createActivity({
        ...form,
        sourceMode: 'enem-bank',
        questionCount: normalizedQuestionCount,
        durationMinutes: normalizedDuration,
        areaDistribution: cleanAreaDistribution(form.areaDistribution),
        status: form.publishNow ? 'published' : 'draft'
      });

      const updatedConfig = saveExamConfig(activity);
      onConfigSaved(updatedConfig);
      showToast(activity.status === 'published' ? 'Simulado criado e publicado no mural.' : 'Simulado criado como rascunho.');
      setForm((current) => ({
        ...current,
        title: '',
        sourceMode: 'enem-bank',
        publishNow: true,
        questionSeed: Date.now()
      }));
      navigate('admin');
    } catch (error) {
      showToast(error?.message || 'Não foi possível salvar o simulado.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <section className="section-header create-simulation-header">
        <span className="eyebrow">Criar</span>
        <h1>Gerenciar simulado</h1>
        <p>Monte o simulado da turma com banco ENEM no Supabase, duração, quantidade base e distribuição por área. Inglês e Espanhol continuam sendo +5 questões extras quando o aluno escolher uma língua estrangeira.</p>
        <button className="button button--ghost" type="button" onClick={() => navigate('admin')}>Ver simulados da turma</button>
      </section>

      <section className="form-layout create-simulation-layout">
        <form className="panel form-card create-simulation-form" onSubmit={handleSubmit}>
          <div className="form-card__intro">
            <h2>Novo simulado</h2>
            <p>Defina os dados principais do simulado que será disponibilizado para os estudantes.</p>
          </div>

          <div className="language-extra-note">
            <strong>Língua estrangeira é adicional:</strong> um simulado de {form.questionCount || 0} questões vira {Number(form.questionCount || 0) + 5} questões se o aluno escolher Inglês ou Espanhol. Se ele marcar “Não quero fazer nessa prova”, continua com {form.questionCount || 0}.
          </div>

          <label>Nome da atividade<input name="title" value={form.title} onChange={updateField} placeholder="Ex.: Simulado Sementes Digitais 01" required /></label>

          <div className="form-grid form-grid--fixed-basics">
            <label>
              Quantidade base de questões
              <input type="number" min="5" max={MAX_QUESTIONS} name="questionCount" value={form.questionCount} onChange={updateField} required />
              <small>Inglês/Espanhol acrescentam +5 quando escolhidos pelo aluno.</small>
            </label>
            <label>
              Duração em minutos
              <input type="number" min="1" max={MAX_DURATION_MINUTES} name="durationMinutes" value={form.durationMinutes} onChange={updateField} required />
              <small>Tempo total para o simulado, incluindo a língua estrangeira quando houver.</small>
            </label>
          </div>

          <div className="form-grid form-grid--fixed-basics">
            <div className="readonly-field-card">
              <span>Fonte de questões</span>
              <strong>Banco ENEM no Supabase</strong>
              <small>O fluxo normal da prova busca a tabela enem_questions. A API externa fica apenas no script de importação.</small>
            </div>

            <label>
              Ano da prova
              <select name="examYear" value={form.examYear || 'mixed'} onChange={updateField}>
                <option value="mixed">Misturar anos 2013–2023</option>
                {ENEM_AVAILABLE_YEARS.map((year) => (
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
                <h3>Defina as áreas do ENEM</h3>
                <p>Escolha quantas questões base virão de Matemática, Linguagens, Humanas e Natureza. As 5 questões de Inglês/Espanhol entram no começo da prova somente quando o aluno escolher uma língua.</p>
              </div>
              <div className="area-distribution-card__actions">
                <button className="button button--ghost button--compact" type="button" onClick={distributeAutomatically}>Distribuir automático</button>
                <button className="button button--ghost button--compact" type="button" onClick={clearAreaDistribution}>Limpar</button>
              </div>
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
              <p className="area-distribution-hint">O sistema tenta respeitar essa distribuição. Se o banco não tiver questões suficientes para alguma área, a prova exibirá um erro claro para importar mais questões ou ajustar a configuração.</p>
            ) : null}
          </section>

          <label className="check-row">
            <input type="checkbox" name="publishNow" checked={Boolean(form.publishNow)} onChange={updateField} />
            <span>Publicar no mural dos alunos assim que salvar.</span>
          </label>

          <button className="button button--primary button--full" type="submit" disabled={isSaving}>{isSaving ? 'Salvando...' : 'Criar simulado'}</button>
        </form>

        <aside className="panel side-note create-simulation-note">
          <span className="eyebrow">Fluxo modular</span>
          <h2>Como ficou organizado</h2>
          <div className="summary-list">
            <span><strong>Mural:</strong> mostra aos alunos os simulados publicados.</span>
            <span><strong>Criar:</strong> cadastra e configura novos simulados.</span>
            <span><strong>Administração:</strong> oculta, publica e abre respostas.</span>
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
