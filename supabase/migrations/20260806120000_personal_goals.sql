create table if not exists public.personal_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('steps', 'workouts', 'water', 'protein', 'calories', 'weight', 'walks', 'active_minutes', 'active_days')),
  name text not null check (char_length(name) between 2 and 120),
  target_value numeric(12,2) not null check (target_value > 0 and target_value <= 10000000),
  unit text not null check (char_length(unit) between 1 and 30),
  start_date date not null,
  end_date date not null,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  progress_value numeric(12,2) not null default 0 check (progress_value >= 0 and progress_value <= 10000000),
  status text not null default 'active' check (status in ('active', 'completed', 'overdue', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.goal_progress_logs (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.personal_goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0 and amount <= 10000000),
  occurred_on date not null default current_date check (occurred_on <= current_date),
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);

alter table public.personal_goals enable row level security;
alter table public.goal_progress_logs enable row level security;

create policy "Users manage own personal goals"
  on public.personal_goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own goal progress"
  on public.goal_progress_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists personal_goals_user_status_idx
  on public.personal_goals (user_id, status, end_date desc);

create index if not exists goal_progress_logs_goal_date_idx
  on public.goal_progress_logs (goal_id, occurred_on desc, created_at desc);

create or replace function public.add_personal_goal_progress(
  target_goal_id uuid,
  progress_amount numeric,
  progress_date date,
  progress_note text default ''
)
returns public.personal_goals
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_goal public.personal_goals;
begin
  if progress_amount <= 0 then
    raise exception 'Progress amount must be positive';
  end if;

  update public.personal_goals
  set progress_value = least(progress_value + progress_amount, 10000000),
      status = case
        when progress_value + progress_amount >= target_value then 'completed'
        when end_date < current_date then 'overdue'
        else 'active'
      end,
      updated_at = now()
  where id = target_goal_id
    and user_id = auth.uid()
    and status <> 'archived'
  returning * into updated_goal;

  if updated_goal.id is null then
    raise exception 'Goal not found';
  end if;

  insert into public.goal_progress_logs (goal_id, user_id, amount, occurred_on, note)
  values (target_goal_id, auth.uid(), progress_amount, progress_date, left(coalesce(progress_note, ''), 300));

  return updated_goal;
end;
$$;

grant execute on function public.add_personal_goal_progress(uuid, numeric, date, text) to authenticated;

