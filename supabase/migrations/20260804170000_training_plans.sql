create table if not exists public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  source text not null default 'manual',
  rationale text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_plans_source_check check (source in ('manual', 'ai', 'template'))
);

create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  suggested_days text[] not null default '{}',
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_workout_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feedback text not null default 'not_liked',
  suggestion jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.workouts
  add column if not exists plan_id uuid references public.training_plans(id) on delete cascade,
  add column if not exists scheduled_days text[] not null default '{}',
  add column if not exists notes text,
  add column if not exists is_active boolean not null default true,
  add column if not exists source text not null default 'manual',
  add column if not exists updated_at timestamptz not null default now();

alter table public.workouts
  drop constraint if exists workouts_source_check,
  add constraint workouts_source_check check (source in ('manual', 'ai', 'template')),
  drop constraint if exists workouts_scheduled_days_check,
  add constraint workouts_scheduled_days_check check (
    scheduled_days <@ array['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']::text[]
  );

alter table public.exercises
  add column if not exists sets_count integer not null default 3,
  add column if not exists repetitions_text text not null default '10',
  add column if not exists initial_weight numeric(7,2),
  add column if not exists rest_seconds integer not null default 60,
  add column if not exists notes text,
  add column if not exists is_optional boolean not null default false,
  add column if not exists advanced_technique text,
  add column if not exists substitutions text[] not null default '{}',
  add column if not exists updated_at timestamptz not null default now();

alter table public.exercises
  drop constraint if exists exercises_sets_count_check,
  add constraint exercises_sets_count_check check (sets_count between 1 and 20),
  drop constraint if exists exercises_initial_weight_check,
  add constraint exercises_initial_weight_check check (initial_weight is null or initial_weight >= 0),
  drop constraint if exists exercises_rest_seconds_check,
  add constraint exercises_rest_seconds_check check (rest_seconds between 0 and 900);

create index if not exists training_plans_user_updated_idx on public.training_plans (user_id, updated_at desc);
create index if not exists workouts_plan_id_idx on public.workouts (plan_id);
create index if not exists ai_workout_feedback_user_created_idx on public.ai_workout_feedback (user_id, created_at desc);

alter table public.training_plans enable row level security;
alter table public.workout_templates enable row level security;
alter table public.ai_workout_feedback enable row level security;

drop policy if exists "Users manage their training plans" on public.training_plans;
create policy "Users manage their training plans"
on public.training_plans for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Authenticated users view workout templates" on public.workout_templates;
create policy "Authenticated users view workout templates"
on public.workout_templates for select
to authenticated
using (true);

drop policy if exists "Users manage their AI workout feedback" on public.ai_workout_feedback;
create policy "Users manage their AI workout feedback"
on public.ai_workout_feedback for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.training_plans to authenticated;
grant select on public.workout_templates to authenticated;
grant select, insert on public.ai_workout_feedback to authenticated;

insert into public.workout_templates (slug, name, description, suggested_days, exercises) values
  (
    'treino-a', 'Treino A', 'Base de membros superiores com movimentos de empurrar.',
    array['Segunda', 'Quinta'],
    '[
      {"name":"Supino reto com barra","sets":4,"repetitions":"8-10","rest":90},
      {"name":"Desenvolvimento com halteres","sets":3,"repetitions":"10-12","rest":75},
      {"name":"Elevação lateral","sets":3,"repetitions":"12-15","rest":60},
      {"name":"Tríceps na corda","sets":3,"repetitions":"10-12","rest":60}
    ]'::jsonb
  ),
  (
    'treino-b', 'Treino B', 'Costas, bíceps e estabilidade do core.',
    array['Terça', 'Sexta'],
    '[
      {"name":"Puxada frontal","sets":4,"repetitions":"8-12","rest":90},
      {"name":"Remada curvada com barra","sets":3,"repetitions":"8-10","rest":90},
      {"name":"Rosca direta","sets":3,"repetitions":"10-12","rest":60},
      {"name":"Prancha frontal","sets":3,"repetitions":"30-45s","rest":45}
    ]'::jsonb
  ),
  (
    'treino-c', 'Treino C', 'Treino equilibrado para pernas e glúteos.',
    array['Quarta', 'Sábado'],
    '[
      {"name":"Agachamento livre","sets":4,"repetitions":"8-10","rest":120},
      {"name":"Leg press 45°","sets":3,"repetitions":"10-12","rest":90},
      {"name":"Levantamento terra romeno","sets":3,"repetitions":"8-10","rest":90},
      {"name":"Ponte de glúteos","sets":3,"repetitions":"12-15","rest":60}
    ]'::jsonb
  ),
  (
    'treino-pernas', 'Treino de pernas', 'Sessão completa para quadríceps, posteriores e glúteos.',
    array['Quarta'],
    '[
      {"name":"Agachamento livre","sets":4,"repetitions":"6-10","rest":120},
      {"name":"Leg press 45°","sets":4,"repetitions":"10-12","rest":90},
      {"name":"Avanço alternado","sets":3,"repetitions":"10 cada","rest":75},
      {"name":"Levantamento terra romeno","sets":3,"repetitions":"8-12","rest":90},
      {"name":"Ponte de glúteos","sets":3,"repetitions":"12-15","rest":60}
    ]'::jsonb
  ),
  (
    'treino-peito-triceps', 'Treino de peito e tríceps', 'Ênfase em movimentos de empurrar e força de membros superiores.',
    array['Segunda'],
    '[
      {"name":"Supino reto com barra","sets":4,"repetitions":"6-10","rest":120},
      {"name":"Flexão de braços","sets":3,"repetitions":"8-15","rest":75},
      {"name":"Tríceps na corda","sets":3,"repetitions":"10-12","rest":60},
      {"name":"Mergulho no banco","sets":3,"repetitions":"8-12","rest":75}
    ]'::jsonb
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  suggested_days = excluded.suggested_days,
  exercises = excluded.exercises;
