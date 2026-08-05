create table if not exists public.diet_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  plan jsonb not null,
  source text not null default 'ai',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists diet_plans_user_created_idx on public.diet_plans(user_id, created_at desc);

alter table public.diet_plans enable row level security;

create policy "Users can view their diet plans" on public.diet_plans
  for select using (auth.uid() = user_id);

create policy "Users can create their diet plans" on public.diet_plans
  for insert with check (auth.uid() = user_id);

create policy "Users can update their diet plans" on public.diet_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their diet plans" on public.diet_plans
  for delete using (auth.uid() = user_id);
