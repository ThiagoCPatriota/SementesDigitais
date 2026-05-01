import { useState } from 'react';
import { saveExamConfig } from '../services/examService.js';

export function Admin({ config, onConfigSaved, showToast, navigate }) {
  const [form, setForm] = useState(config);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const updated = saveExamConfig(form);
    onConfigSaved(updated);
    showToast('Configuração salva. A tentativa anterior foi reiniciada.');
  }

  return (
    <>
      <section className="section-header">
        <span className="eyebrow">Painel administrativo</span>
        <h1>Configurar simulado</h1>
        <p>Painel do professor para definir tempo, quantidade de questões e código de acesso.</p>
      </section>

      <section className="form-layout">
        <form className="panel form-card" onSubmit={handleSubmit}>
          <label>Nome da atividade<input name="title" value={form.title} onChange={updateField} required /></label>

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

          <button className="button button--primary button--full" type="submit">Salvar configuração</button>
        </form>

        <aside className="panel side-note">
          <h2>Resumo atual</h2>
          <div className="summary-list">
            <span><strong>Atividade:</strong> {config.title}</span>
            <span><strong>Questões:</strong> {config.questionCount}</span>
            <span><strong>Tempo:</strong> {config.durationMinutes} minutos</span>
            <span><strong>Código:</strong> {config.classCode}</span>
            <span><strong>Formato:</strong> prova objetiva</span>
          </div>
          <button className="button button--ghost button--full" type="button" onClick={() => navigate('atividades')}>Ver área de atividades</button>
        </aside>
      </section>
    </>
  );
}
