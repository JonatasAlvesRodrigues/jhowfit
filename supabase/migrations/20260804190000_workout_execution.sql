create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid references public.workouts(id) on delete set null,
  workout_name text not null,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  paused_at timestamptz,
  total_paused_seconds integer not null default 0,
  current_exercise_index integer not null default 0,
  duration_seconds integer,
  volume_total numeric(12,2) not null default 0,
  completed_sets integer not null default 0,
  exercise_count integer not null default 0,
  pr_count integer not null default 0,
  difficulty integer,
  notes text,
  updated_at timestamptz not null default now(),
  constraint workout_sessions_status_check check (status in ('active', 'paused', 'completed', 'abandoned')),
  constraint workout_sessions_difficulty_check check (difficulty is null or difficulty between 1 and 5)
);

create table if not exists public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_exercise_id uuid references public.exercises(id) on delete set null,
  library_exercise_id uuid references public.exercise_library(id) on delete set null,
  name text not null,
  position integer not null,
  planned_sets integer not null,
  planned_repetitions text not null,
  recommended_weight numeric(7,2),
  previous_weight numeric(7,2),
  rest_seconds integer not null default 60,
  notes text,
  image_url text,
  skipped boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_session_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  session_exercise_id uuid not null references public.workout_session_exercises(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  set_number integer not null,
  planned_repetitions text not null,
  weight numeric(7,2),
  repetitions integer,
  completed boolean not null default false,
  completed_at timestamptz,
  is_personal_record boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (session_exercise_id, set_number)
);

create unique index if not exists workout_sessions_one_active_idx
  on public.workout_sessions (user_id) where status in ('active', 'paused');
create index if not exists workout_sessions_history_idx on public.workout_sessions (user_id, workout_id, ended_at desc);
create index if not exists workout_session_exercises_session_idx on public.workout_session_exercises (session_id, position);
create index if not exists workout_session_sets_session_idx on public.workout_session_sets (session_id, session_exercise_id, set_number);

alter table public.workout_sessions enable row level security;
alter table public.workout_session_exercises enable row level security;
alter table public.workout_session_sets enable row level security;

create policy "Users manage own workout sessions" on public.workout_sessions for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own session exercises" on public.workout_session_exercises for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own session sets" on public.workout_session_sets for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.workout_sessions to authenticated;
grant select, insert, update, delete on public.workout_session_exercises to authenticated;
grant select, insert, update, delete on public.workout_session_sets to authenticated;
