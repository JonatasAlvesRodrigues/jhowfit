create table if not exists public.step_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_goal integer not null default 10000 check (daily_goal between 100 and 100000),
  updated_at timestamptz not null default now()
);

create table if not exists public.step_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  steps integer not null check (steps between 1 and 200000),
  distance_km numeric(7,3) not null default 0 check (distance_km between 0 and 300),
  duration_minutes integer not null default 0 check (duration_minutes between 0 and 1440),
  calories numeric(8,2) not null default 0 check (calories between 0 and 20000),
  occurred_on date not null default current_date check (occurred_on <= current_date),
  source text not null default 'manual' check (source in ('manual', 'apple_health', 'health_connect')),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

alter table public.step_settings enable row level security;
alter table public.step_records enable row level security;

create policy "Users manage own step settings" on public.step_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own step records" on public.step_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists step_records_user_date_idx on public.step_records (user_id, occurred_on desc);

insert into public.step_records (user_id, steps, occurred_on, source)
select user_id, steps_current, date, 'manual'
from public.daily_stats
where steps_current > 0
  and not exists (
    select 1 from public.step_records record
    where record.user_id = daily_stats.user_id and record.occurred_on = daily_stats.date
  );

insert into public.step_settings (user_id, daily_goal)
select distinct on (user_id) user_id, steps_goal
from public.daily_stats
order by user_id, date desc
on conflict (user_id) do nothing;
