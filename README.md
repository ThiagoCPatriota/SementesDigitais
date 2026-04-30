# Sementes Digitais — Simulados ENEM | MVP 01

Este é um MVP inicial do layout e da experiência do usuário para o projeto **Sementes Digitais**.

A versão atual é um frontend estático, modularizado em arquivos, com:

- Página inicial institucional
- Cadastro rápido de aluno
- Painel admin simples para configurar simulado
- Prova cronometrada
- 60 questões simuladas
- Mapa de questões
- Salvamento automático de respostas no navegador
- Redação integrada
- Resultado demonstrativo
- Adapter preparado para futura integração com a API `enem.dev`

## Como rodar

Abra a pasta no VS Code e rode um servidor local. Exemplo com Python:

```bash
python -m http.server 5173
```

Depois acesse:

```txt
http://localhost:5173
```

Também pode usar a extensão **Live Server** do VS Code.

## Estrutura de pastas

```txt
sementes-digitais-mvp/
├── index.html
├── README.md
├── src/
│   ├── main.js
│   ├── pages.js
│   ├── config.js
│   ├── styles.css
│   ├── components/
│   │   ├── layout.js
│   │   ├── progress.js
│   │   ├── questionCard.js
│   │   ├── timer.js
│   │   └── toast.js
│   ├── data/
│   │   ├── essayThemes.js
│   │   └── mockQuestions.js
│   ├── services/
│   │   ├── enemApi.js
│   │   ├── examService.js
│   │   └── storage.js
│   └── utils/
│       ├── timer.js
│       └── validators.js
└── assets/
```

## Sobre a API ENEM

O arquivo `src/services/enemApi.js` contém um adapter inicial para a API pública `enem.dev`.

Importante: em produção, o frontend não deve buscar questões diretamente se a resposta da API trouxer gabarito. O fluxo recomendado é:

```txt
Frontend → Backend próprio → API enem.dev → Banco/servidor → Frontend sem gabarito
```

## Sequência prática de teste

1. Abra `http://localhost:5173`.
2. Clique em **Admin**.
3. Troque o nome da atividade, quantidade de questões ou duração.
4. Para teste rápido, coloque duração de `1` minuto.
5. Salve a configuração.
6. Clique em **Testar como aluno**.
7. Preencha nome, e-mail, telefone e CPF com 11 dígitos.
8. Use o código padrão `SEMENTES2026`, ou o código que você definiu no admin.
9. Clique em **Salvar e iniciar prova**.
10. Responda algumas questões.
11. Atualize a página e confirme que as respostas continuam salvas.
12. Digite algo na redação.
13. Finalize manualmente ou espere o tempo acabar.
14. Confira a tela de resultado.

## Próximos passos sugeridos

- Criar backend com autenticação e banco de dados.
- Guardar gabarito apenas no servidor.
- Integrar a API real de questões.
- Criar painel de resultados por turma.
- Exportar resultados em Excel/PDF.
- Criar módulo de correção de redação por competências.
