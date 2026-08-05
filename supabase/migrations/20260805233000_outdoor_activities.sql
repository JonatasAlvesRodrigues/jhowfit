create table if not exists public.outdoor_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('walk', 'run', 'treadmill', 'bike', 'other')),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds between 1 and 172800),
  distance_km numeric(8,3) not null default 0 check (distance_km between 0 and 1000),
  average_pace_seconds integer check (average_pace_seconds is null or average_pace_seconds > 0),
  average_speed_kmh numeric(7,2) not null default 0 check (average_speed_kmh >= 0),
  calories numeric(9,2) not null default 0 check (calories between 0 and 50000),
  observation text not null default '' check (char_length(observation) <= 1000),
  difficulty integer not null check (difficulty between 1 and 5),
  route jsonb not null default '[]'::jsonb,
  gps_status text not null default 'not_required' check (gps_status in ('not_required', 'searching', 'active', 'disabled', 'denied', 'unavailable')),
  interrupted boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.outdoor_activities enable row level security;

create policy "Users manage own outdoor activities"
  on public.outdoor_activities
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists outdoor_activities_user_started_idx
  on public.outdoor_activities (user_id, started_at desc);
