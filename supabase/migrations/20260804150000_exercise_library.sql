create table if not exists public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  primary_muscle text not null,
  secondary_muscles text[] not null default '{}',
  equipment text not null,
  level text not null,
  instructions text[] not null default '{}',
  common_mistakes text[] not null default '{}',
  safety_tips text[] not null default '{}',
  substitutions text[] not null default '{}',
  locations text[] not null default '{}',
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_library_level_check check (level in ('Iniciante', 'Intermediário', 'Avançado')),
  constraint exercise_library_locations_check check (locations <@ array['Academia', 'Casa']::text[])
);

create table if not exists public.exercise_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercise_library(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

alter table public.exercises
  add column if not exists library_exercise_id uuid references public.exercise_library(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

create index if not exists exercise_library_primary_muscle_idx on public.exercise_library (primary_muscle);
create index if not exists exercise_library_equipment_idx on public.exercise_library (equipment);
create index if not exists exercises_user_created_at_idx on public.exercises (user_id, created_at desc);

alter table public.exercise_library enable row level security;
alter table public.exercise_favorites enable row level security;

drop policy if exists "Authenticated users view exercise library" on public.exercise_library;
create policy "Authenticated users view exercise library"
on public.exercise_library for select
to authenticated
using (true);

drop policy if exists "Users manage their exercise favorites" on public.exercise_favorites;
create policy "Users manage their exercise favorites"
on public.exercise_favorites for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select on public.exercise_library to authenticated;
grant select, insert, delete on public.exercise_favorites to authenticated;

insert into public.exercise_library (
  slug, name, primary_muscle, secondary_muscles, equipment, level,
  instructions, common_mistakes, safety_tips, substitutions, locations
) values
  (
    'supino-reto-barra', 'Supino reto com barra', 'Peito', array['Tríceps', 'Ombros'],
    'Barra', 'Intermediário',
    array['Deite com os pés firmes no chão e olhos abaixo da barra.', 'Retraia as escápulas e retire a barra do suporte.', 'Desça a barra até a linha média do peito.', 'Empurre mantendo punhos e cotovelos alinhados.'],
    array['Abrir demais os cotovelos.', 'Tirar os pés do chão.', 'Quicar a barra no peito.'],
    array['Use presilhas na barra.', 'Peça auxílio ao trabalhar próximo da carga máxima.'],
    array['Supino com halteres', 'Flexão de braços'], array['Academia']
  ),
  (
    'flexao-bracos', 'Flexão de braços', 'Peito', array['Tríceps', 'Ombros', 'Core'],
    'Peso corporal', 'Iniciante',
    array['Apoie as mãos um pouco além da largura dos ombros.', 'Mantenha corpo e quadril alinhados.', 'Desça o peito com controle.', 'Empurre o chão até estender os braços.'],
    array['Deixar o quadril cair.', 'Encurtar demais o movimento.', 'Projetar a cabeça para frente.'],
    array['Apoie os joelhos se perder o alinhamento.', 'Interrompa se houver dor no ombro ou punho.'],
    array['Supino reto com barra', 'Flexão inclinada'], array['Academia', 'Casa']
  ),
  (
    'puxada-frontal', 'Puxada frontal', 'Costas', array['Bíceps', 'Antebraços'],
    'Máquina', 'Iniciante',
    array['Ajuste o apoio das pernas e segure a barra.', 'Mantenha o peito aberto.', 'Puxe a barra em direção à parte superior do peito.', 'Retorne devagar sem perder a postura.'],
    array['Puxar atrás da nuca.', 'Usar balanço do tronco.', 'Encolher os ombros.'],
    array['Evite cargas que obriguem a balançar.', 'Mantenha a coluna neutra.'],
    array['Barra fixa', 'Remada unilateral'], array['Academia']
  ),
  (
    'remada-curvada-barra', 'Remada curvada com barra', 'Costas', array['Bíceps', 'Posterior de coxa', 'Core'],
    'Barra', 'Avançado',
    array['Segure a barra e incline o tronco com quadril para trás.', 'Mantenha a coluna neutra e abdômen firme.', 'Puxe a barra em direção ao abdômen.', 'Desça com controle.'],
    array['Arredondar a lombar.', 'Subir o tronco durante a puxada.', 'Usar impulso excessivo.'],
    array['Domine o padrão de dobradiça do quadril antes.', 'Reduza a carga se perder a coluna neutra.'],
    array['Remada baixa', 'Remada unilateral'], array['Academia']
  ),
  (
    'barra-fixa', 'Barra fixa', 'Costas', array['Bíceps', 'Antebraços', 'Core'],
    'Barra fixa', 'Avançado',
    array['Segure a barra um pouco além dos ombros.', 'Inicie deprimindo as escápulas.', 'Eleve o peito em direção à barra.', 'Desça controlando até estender os braços.'],
    array['Balançar as pernas.', 'Encolher os ombros.', 'Fazer apenas metade da amplitude.'],
    array['Use elástico de assistência se necessário.', 'Evite soltar o corpo bruscamente.'],
    array['Puxada frontal', 'Barra fixa assistida'], array['Academia', 'Casa']
  ),
  (
    'agachamento-livre', 'Agachamento livre', 'Quadríceps', array['Glúteos', 'Posterior de coxa', 'Core'],
    'Barra', 'Intermediário',
    array['Posicione a barra sobre a parte alta das costas.', 'Afaste os pés em posição confortável.', 'Desça levando quadril e joelhos juntos.', 'Suba empurrando o chão e mantendo o tronco firme.'],
    array['Joelhos colapsarem para dentro.', 'Tirar os calcanhares do chão.', 'Perder a neutralidade da coluna.'],
    array['Use barras de segurança no rack.', 'Pratique sem carga antes de progredir.'],
    array['Agachamento goblet', 'Leg press'], array['Academia']
  ),
  (
    'agachamento-goblet', 'Agachamento goblet', 'Quadríceps', array['Glúteos', 'Core'],
    'Halter', 'Iniciante',
    array['Segure um halter junto ao peito.', 'Mantenha os pés firmes e o peito aberto.', 'Agache entre as pernas.', 'Suba estendendo quadris e joelhos.'],
    array['Afastar a carga do corpo.', 'Cair para a ponta dos pés.', 'Fechar os joelhos.'],
    array['Escolha uma carga que permita controle total.', 'Respeite sua mobilidade de quadril e tornozelo.'],
    array['Agachamento livre', 'Agachamento com peso corporal'], array['Academia', 'Casa']
  ),
  (
    'leg-press-45', 'Leg press 45°', 'Quadríceps', array['Glúteos', 'Posterior de coxa'],
    'Máquina', 'Iniciante',
    array['Apoie totalmente costas e quadril.', 'Posicione os pés na plataforma.', 'Desça até manter o quadril estável.', 'Empurre sem travar os joelhos.'],
    array['Descolar o quadril do banco.', 'Fechar os joelhos.', 'Travar os joelhos no topo.'],
    array['Não coloque as mãos entre plataforma e máquina.', 'Use a trava de segurança.'],
    array['Agachamento livre', 'Agachamento goblet'], array['Academia']
  ),
  (
    'avanco-alternado', 'Avanço alternado', 'Quadríceps', array['Glúteos', 'Posterior de coxa'],
    'Peso corporal', 'Intermediário',
    array['Fique em pé com o abdômen firme.', 'Dê um passo à frente e flexione os joelhos.', 'Aproxime o joelho traseiro do chão.', 'Empurre o pé da frente e retorne.'],
    array['Dar um passo curto demais.', 'Inclinar excessivamente o tronco.', 'Perder o alinhamento do joelho.'],
    array['Use apoio se houver dificuldade de equilíbrio.', 'Comece sem carga.'],
    array['Agachamento búlgaro', 'Agachamento goblet'], array['Academia', 'Casa']
  ),
  (
    'ponte-gluteos', 'Ponte de glúteos', 'Glúteos', array['Posterior de coxa', 'Core'],
    'Peso corporal', 'Iniciante',
    array['Deite com joelhos flexionados e pés no chão.', 'Contraia o abdômen.', 'Eleve o quadril apertando os glúteos.', 'Desça lentamente sem relaxar completamente.'],
    array['Hiperestender a lombar.', 'Empurrar apenas com a ponta dos pés.', 'Abrir demais os joelhos.'],
    array['Mantenha as costelas baixas.', 'Pare antes de sentir pressão lombar.'],
    array['Hip thrust', 'Levantamento terra romeno'], array['Academia', 'Casa']
  ),
  (
    'terra-romeno', 'Levantamento terra romeno', 'Posterior de coxa', array['Glúteos', 'Lombar', 'Core'],
    'Barra', 'Intermediário',
    array['Segure a barra junto às coxas.', 'Leve o quadril para trás com joelhos levemente flexionados.', 'Desça mantendo a barra próxima às pernas.', 'Retorne contraindo glúteos.'],
    array['Arredondar a coluna.', 'Transformar o movimento em agachamento.', 'Afastar a barra do corpo.'],
    array['Priorize amplitude controlada.', 'Não desça além da mobilidade disponível.'],
    array['Terra romeno com halteres', 'Ponte de glúteos'], array['Academia']
  ),
  (
    'desenvolvimento-halteres', 'Desenvolvimento com halteres', 'Ombros', array['Tríceps', 'Trapézio'],
    'Halteres', 'Intermediário',
    array['Sente com as costas apoiadas.', 'Posicione halteres na altura dos ombros.', 'Empurre para cima sem bater os pesos.', 'Desça com controle.'],
    array['Arquear demais a lombar.', 'Descer além de uma amplitude confortável.', 'Bater os halteres no topo.'],
    array['Mantenha o abdômen firme.', 'Use pegada neutra se sentir desconforto.'],
    array['Desenvolvimento na máquina', 'Elevação lateral'], array['Academia', 'Casa']
  ),
  (
    'elevacao-lateral', 'Elevação lateral', 'Ombros', array['Trapézio'],
    'Halteres', 'Iniciante',
    array['Fique em pé com halteres ao lado do corpo.', 'Mantenha cotovelos levemente flexionados.', 'Eleve os braços até a linha dos ombros.', 'Desça lentamente.'],
    array['Usar impulso.', 'Elevar acima dos ombros sem necessidade.', 'Encolher os ombros.'],
    array['Prefira cargas leves e controle.', 'Conduza o movimento pelos cotovelos.'],
    array['Elevação lateral no cabo', 'Desenvolvimento com halteres'], array['Academia', 'Casa']
  ),
  (
    'rosca-direta', 'Rosca direta', 'Bíceps', array['Antebraços'],
    'Barra', 'Iniciante',
    array['Segure a barra com palmas para frente.', 'Mantenha cotovelos próximos ao tronco.', 'Flexione os cotovelos sem mover os ombros.', 'Desça controlando.'],
    array['Balançar o tronco.', 'Levar cotovelos para frente.', 'Soltar a carga na descida.'],
    array['Mantenha punhos neutros.', 'Reduza a carga se precisar balançar.'],
    array['Rosca alternada', 'Rosca no cabo'], array['Academia']
  ),
  (
    'triceps-corda', 'Tríceps na corda', 'Tríceps', array['Antebraços'],
    'Cabo', 'Iniciante',
    array['Segure a corda com cotovelos junto ao corpo.', 'Estenda os cotovelos levando a corda para baixo.', 'Separe as pontas no final.', 'Retorne sem mover os braços.'],
    array['Abrir os cotovelos.', 'Inclinar o corpo sobre a carga.', 'Encurtar a extensão.'],
    array['Mantenha os ombros relaxados.', 'Controle o retorno do cabo.'],
    array['Tríceps francês', 'Mergulho no banco'], array['Academia']
  ),
  (
    'mergulho-banco', 'Mergulho no banco', 'Tríceps', array['Peito', 'Ombros'],
    'Banco', 'Intermediário',
    array['Apoie as mãos na borda do banco.', 'Mantenha o quadril próximo ao banco.', 'Flexione os cotovelos até amplitude confortável.', 'Empurre até retornar.'],
    array['Afastar o quadril do banco.', 'Descer além do conforto dos ombros.', 'Abrir os cotovelos.'],
    array['Evite se houver histórico de dor anterior no ombro.', 'Flexione os joelhos para reduzir a carga.'],
    array['Tríceps na corda', 'Flexão fechada'], array['Academia', 'Casa']
  ),
  (
    'prancha-frontal', 'Prancha frontal', 'Core', array['Ombros', 'Glúteos'],
    'Peso corporal', 'Iniciante',
    array['Apoie antebraços e pontas dos pés.', 'Alinhe cabeça, tronco e quadril.', 'Contraia abdômen e glúteos.', 'Respire mantendo a posição.'],
    array['Deixar o quadril cair.', 'Prender a respiração.', 'Projetar a cabeça.'],
    array['Interrompa ao perder o alinhamento.', 'Apoie os joelhos para facilitar.'],
    array['Dead bug', 'Prancha alta'], array['Academia', 'Casa']
  ),
  (
    'abdominal-bicicleta', 'Abdominal bicicleta', 'Core', array['Oblíquos', 'Flexores do quadril'],
    'Peso corporal', 'Intermediário',
    array['Deite com mãos atrás da cabeça.', 'Eleve ombros e pernas.', 'Aproxime cotovelo e joelho opostos.', 'Alterne os lados com controle.'],
    array['Puxar o pescoço.', 'Executar rápido demais.', 'Perder o contato lombar com o chão.'],
    array['Mantenha o queixo afastado do peito.', 'Reduza a amplitude se a lombar arquear.'],
    array['Dead bug', 'Prancha lateral'], array['Academia', 'Casa']
  ),
  (
    'corrida-esteira', 'Corrida na esteira', 'Cardio', array['Quadríceps', 'Panturrilhas', 'Glúteos'],
    'Esteira', 'Intermediário',
    array['Comece caminhando para aquecer.', 'Aumente a velocidade gradualmente.', 'Mantenha passada natural e tronco estável.', 'Reduza o ritmo antes de parar.'],
    array['Segurar nas laterais durante a corrida.', 'Começar rápido sem aquecimento.', 'Dar passadas excessivamente longas.'],
    array['Use o clipe de segurança.', 'Escolha tênis adequado e respeite sinais de dor.'],
    array['Caminhada inclinada', 'Corrida ao ar livre'], array['Academia']
  ),
  (
    'polichinelo', 'Polichinelo', 'Cardio', array['Panturrilhas', 'Ombros', 'Quadríceps'],
    'Nenhum', 'Iniciante',
    array['Comece em pé com braços ao lado.', 'Salte abrindo pernas e elevando braços.', 'Aterrisse suavemente.', 'Retorne à posição inicial mantendo o ritmo.'],
    array['Aterrissar com impacto excessivo.', 'Perder o alinhamento dos joelhos.', 'Prender a respiração.'],
    array['Faça sem salto para reduzir impacto.', 'Use superfície firme e livre de objetos.'],
    array['Marcha rápida', 'Corrida estacionária'], array['Academia', 'Casa']
  )
on conflict (slug) do update set
  name = excluded.name,
  primary_muscle = excluded.primary_muscle,
  secondary_muscles = excluded.secondary_muscles,
  equipment = excluded.equipment,
  level = excluded.level,
  instructions = excluded.instructions,
  common_mistakes = excluded.common_mistakes,
  safety_tips = excluded.safety_tips,
  substitutions = excluded.substitutions,
  locations = excluded.locations,
  updated_at = now();
