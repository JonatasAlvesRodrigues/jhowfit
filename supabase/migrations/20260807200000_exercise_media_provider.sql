alter table public.exercise_library
  add column if not exists external_id text,
  add column if not exists name_en text,
  add column if not exists body_part text,
  add column if not exists gif_url text,
  add column if not exists video_url text,
  add column if not exists thumbnail_url text,
  add column if not exists source text,
  add column if not exists source_url text;

alter table public.workout_session_exercises
  add column if not exists gif_url text,
  add column if not exists video_url text,
  add column if not exists thumbnail_url text;

create unique index if not exists exercise_library_source_external_idx
  on public.exercise_library (source, external_id)
  where external_id is not null;

create table if not exists public.exercise_aliases (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercise_library(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  created_at timestamptz not null default now(),
  unique (exercise_id, normalized_alias)
);

create index if not exists exercise_aliases_normalized_idx on public.exercise_aliases (normalized_alias);
alter table public.exercise_aliases enable row level security;
drop policy if exists "Authenticated users view exercise aliases" on public.exercise_aliases;
create policy "Authenticated users view exercise aliases"
on public.exercise_aliases for select to authenticated using (true);
grant select on public.exercise_aliases to authenticated;
