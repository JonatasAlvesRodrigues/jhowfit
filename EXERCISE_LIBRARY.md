# Biblioteca visual de exercícios

## Estado atual

O MOVELYA consulta primeiro `exercise_library` no Supabase. Os treinos e as sessões de execução mantêm `library_exercise_id`, portanto a demonstração e os metadados acompanham o exercício sem salvar apenas uma string solta.

Os campos de mídia seguem esta prioridade: `gif_url`, `video_url`, `thumbnail_url` e, por último, `image_url`. Cards usam carregamento lazy; a tela de execução carrega a mídia do exercício atual.

## Provider

Foi criada a interface `ExerciseProvider` em `src/services/exerciseProvider.ts`. Ela aceita um endpoint normalizado por `VITE_EXERCISE_PROVIDER_URL`, mas fica desligada quando a variável não existe. A chave de qualquer fornecedor deve permanecer em um backend/Edge Function, nunca no bundle do navegador.

Uma opção inicial para avaliação é ExerciseAPI, que declara dados sob CC BY 4.0 e exige atribuição. Para GIFs e vídeos comerciais, ExerciseDB/AscendAPI exige conferir o plano e os termos contratados: a documentação informa que a chave RapidAPI deve ficar no backend e os termos restringem redistribuição dos arquivos de mídia. Por isso nenhum GIF externo foi incorporado automaticamente nesta alteração.

## Sincronização e cache

As telas normais não consultam API externa. O método opcional `searchExerciseProvider` existe para um fluxo administrativo de sincronização: buscar, normalizar, revisar licença e gravar no Supabase. A tabela local é então a fonte de leitura, inclusive quando o provider estiver indisponível.

## Variáveis e teste

Adicione `VITE_EXERCISE_PROVIDER_URL` apenas se houver um endpoint seu que faça proxy seguro do provider. Depois de aplicar a migration `20260807200000_exercise_media_provider.sql`, cadastre um exercício com `gif_url` ou `video_url`, abra Treinos > Biblioteca e inicie uma ficha que o contenha. Teste também um URL inválido: o card deve voltar ao fallback e o treino continuar utilizável.

Para sincronização pelo painel administrativo, configure nas secrets da Edge Function `sync-exercises`: `EXERCISE_PROVIDER_URL`, `EXERCISE_PROVIDER_API_KEY` (se exigida) e as secrets padrão do Supabase. Moderadores e administradores verão o botão “Sincronizar exercícios” em Administração. A função valida a role, consulta o provider no backend e faz upsert sem expor a chave.

Antes de uso comercial, registre a atribuição exigida pelo provider escolhido e confirme por escrito a permissão para armazenar/servir a mídia no produto.
