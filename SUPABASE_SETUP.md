# Configuração do Supabase Auth — VitaFit

Projeto esperado: `kbkhishegoifrkhwlipg`

## 1. Provedor de e-mail

No Supabase Dashboard, acesse **Authentication → Sign In / Providers → Email**:

- mantenha **Enable Email provider** ativo;
- mantenha **Allow new users to sign up** ativo;
- ative **Confirm email**;
- não ative login anônimo.

## 2. URLs de autenticação

Em **Authentication → URL Configuration**, configure:

**Site URL**

```text
https://jonatasalvesrodrigues.github.io/movelya/
```

**Redirect URLs**

```text
https://jonatasalvesrodrigues.github.io/movelya/**
https://jhow-fit-app.jonatasalves2005rodr.chatgpt.site/**
http://127.0.0.1:4173/**
http://localhost:3000/**
```

Para produção, mantenha apenas origens conhecidas. Não use um wildcard global.

## 3. Templates de e-mail

Em **Authentication → Email Templates**, revise:

- Confirm signup;
- Reset password;
- Password changed.

Os templates devem usar `{{ .ConfirmationURL }}`. O aplicativo informa
`emailRedirectTo`/`redirectTo`, e os endereços precisam estar na lista acima.

## 4. Banco e perfil

Vincule a CLI usando uma conta que tenha acesso ao projeto:

```bash
supabase login
supabase link --project-ref kbkhishegoifrkhwlipg
supabase db push
```

O `db push` cria `public.profiles`, o gatilho de criação automática do perfil,
as tabelas fitness, os campos do questionário inicial e todas as políticas RLS
versionadas em `supabase/migrations`.

Depois de aplicar as migrações, novos usuários serão direcionados ao questionário
no primeiro acesso. A conclusão fica registrada em `profiles.onboarding_completed`.

## 5. Produção

O GitHub Actions usa estes secrets:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Use somente a chave publicável. Nunca coloque `service_role`, `sb_secret` ou
senha do banco em variáveis expostas ao navegador.
