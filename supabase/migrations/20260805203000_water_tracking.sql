create table if not exists public.water_intake_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_ml integer not null check (amount_ml between 1 and 10000),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.water_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_goal_ml integer not null default 2500 check (daily_goal_ml between 250 and 15000),
  reminders_enabled boolean not null default false,
  reminder_times time[] not null default array['09:00'::time, '12:00'::time, '15:00'::time, '18:00'::time],
  updated_at timestamptz not null default now()
);

alter table public.water_intake_logs enable row level security;
alter table public.water_settings enable row level security;

create policy "Users manage own water logs" on public.water_intake_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own water settings" on public.water_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists water_intake_logs_user_time_idx on public.water_intake_logs (user_id, occurred_at desc);

insert into public.water_intake_logs (user_id, amount_ml, occurred_at)
select user_id, round(water_current * 1000)::integer, (date::timestamp + time '12:00') at time zone 'America/Sao_Paulo'
from public.daily_stats
where water_current > 0
  and not exists (
    select 1 from public.water_intake_logs log
    where log.user_id = daily_stats.user_id and log.occurred_at::date = daily_stats.date
  );
