create table if not exists public.health_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('apple_health', 'health_connect')),
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error')),
  permissions jsonb not null default '{}'::jsonb,
  device_label text not null default '' check (char_length(device_label) <= 120),
  last_sync_at timestamptz,
  last_error text not null default '' check (char_length(last_error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.health_sync_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('apple_health', 'health_connect')),
  data_type text not null check (data_type in ('steps', 'distance', 'workout', 'active_calories', 'weight')),
  external_id text not null check (char_length(external_id) between 1 and 300),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  value numeric(14,4) not null default 0,
  unit text not null check (char_length(unit) between 1 and 30),
  source_name text not null default '' check (char_length(source_name) <= 160),
  source_updated_at timestamptz,
  imported_at timestamptz not null default now(),
  unique (user_id, provider, data_type, external_id),
  check (ended_at >= started_at)
);

alter table public.health_connections enable row level security;
alter table public.health_sync_records enable row level security;

create policy "Users manage own health connections"
  on public.health_connections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own health sync records"
  on public.health_sync_records for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists health_sync_records_user_started_idx
  on public.health_sync_records (user_id, started_at desc);

create index if not exists health_sync_records_user_type_idx
  on public.health_sync_records (user_id, data_type, started_at desc);

