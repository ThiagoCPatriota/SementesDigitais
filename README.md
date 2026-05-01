# Sementes Digitais — Simulados ENEM

Versão migrada para **React + Vite**, mantendo o visual institucional e o fluxo principal do aluno.

## Como rodar

```bash
npm install
npm run dev
```

Depois acesse o endereço mostrado pelo Vite, normalmente:

```txt
http://localhost:5173
```

## Supabase

Crie um arquivo `.env` na raiz do projeto usando o `.env.example` como base:

```txt
VITE_SUPABASE_URL=URL_DO_PROJETO
VITE_SUPABASE_ANON_KEY=CHAVE_PUBLICA_ANON
```

Use apenas a chave pública/anon no frontend. Nunca coloque `service_role`, chave secreta ou senha do banco no projeto React.

## Fluxo atual

- Início institucional
- Acesso do estudante com cadastro/login
- Conta com perfil e logout
- Atividades da turma e atividade pessoal
- Prova objetiva com cronômetro
- Resultado da tentativa
- Administração visível apenas para e-mails configurados como admin

## Admin local de teste

No arquivo `src/config.js`, o e-mail administrativo inicial é:

```txt
admin@sementesdigitais.com
```

Em modo local, sem Supabase configurado, fazer login com esse e-mail libera a área administrativa para testes.
