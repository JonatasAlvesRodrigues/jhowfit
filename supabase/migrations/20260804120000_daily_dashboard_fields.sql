alter table public.daily_stats
  add column if not exists protein_current numeric(6,2) not null default 0,
  add column if not exists protein_goal numeric(6,2) not null default 120;

alter table public.daily_stats
  drop constraint if exists daily_stats_protein_current_check,
  add constraint daily_stats_protein_current_check check (protein_current >= 0),
  drop constraint if exists daily_stats_protein_goal_check,
  add constraint daily_stats_protein_goal_check check (protein_goal > 0);

alter table public.workouts
  add column if not exists scheduled_date date,
  add column if not exists level text not null default 'Iniciante',
  add column if not exists muscle_groups text[] not null default '{}';

alter table public.workouts
  drop constraint if exists workouts_level_check,
  add constraint workouts_level_check check (level in ('Iniciante', 'Intermediário', 'Avançado'));

create index if not exists workouts_user_scheduled_date_idx
  on public.workouts (user_id, scheduled_date);
