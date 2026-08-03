create extension if not exists "pgcrypto";

create table if not exists public.daily_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  calories_current integer not null default 0,
  calories_goal integer not null default 2200,
  water_current numeric(4,2) not null default 0,
  water_goal numeric(4,2) not null default 3,
  steps_current integer not null default 0,
  steps_goal integer not null default 10000,
  workout_minutes integer not null default 0,
  workout_calories integer not null default 0,
  unique (user_id, date)
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  focus text not null default '',
  duration integer not null default 0,
  exercise_count integer not null default 0,
  position integer not null default 0,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  position integer not null default 0
);

create table if not exists public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  set_number integer not null,
  repetitions integer,
  weight numeric(6,2),
  completed boolean not null default false
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  time time not null default current_time,
  name text not null,
  description text not null default '',
  calories integer not null default 0,
  protein numeric(6,2) not null default 0,
  carbs numeric(6,2) not null default 0,
  fat numeric(6,2) not null default 0
);

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at date not null default current_date,
  weight numeric(6,2) not null,
  body_fat numeric(5,2),
  muscle_mass numeric(6,2),
  unique (user_id, measured_at)
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  target_value numeric(8,2),
  current_value numeric(8,2),
  unit text,
  due_date date,
  completed boolean not null default false
);

alter table public.daily_stats enable row level security;
alter table public.workouts enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_sets enable row level security;
alter table public.meals enable row level security;
alter table public.body_measurements enable row level security;
alter table public.goals enable row level security;

create policy "Users manage own daily stats" on public.daily_stats for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own workouts" on public.workouts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own exercises" on public.exercises for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own sets" on public.exercise_sets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own meals" on public.meals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own measurements" on public.body_measurements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own goals" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
