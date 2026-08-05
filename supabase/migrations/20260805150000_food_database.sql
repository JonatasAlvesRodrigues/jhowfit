alter table public.meal_food_catalog
  add column if not exists brand text not null default '',
  add column if not exists sugar numeric(7,2) not null default 0,
  add column if not exists information_source text not null default 'Não informada';

create table if not exists public.food_correction_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid not null references public.meal_food_catalog(id) on delete cascade,
  reason text not null,
  suggested_correction text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.food_correction_reports enable row level security;

drop policy if exists "Users create food corrections" on public.food_correction_reports;
create policy "Users create food corrections" on public.food_correction_reports for insert with check (auth.uid() = user_id);
drop policy if exists "Users read own food corrections" on public.food_correction_reports;
create policy "Users read own food corrections" on public.food_correction_reports for select using (auth.uid() = user_id);

drop policy if exists "Users manage own foods" on public.meal_food_catalog;
create policy "Users insert own foods" on public.meal_food_catalog for insert with check (auth.uid() = user_id and is_public = false);
create policy "Users update own non-public foods" on public.meal_food_catalog for update using (auth.uid() = user_id and is_public = false) with check (auth.uid() = user_id and is_public = false);
create policy "Users delete own non-public foods" on public.meal_food_catalog for delete using (auth.uid() = user_id and is_public = false);

create index if not exists meal_food_catalog_search_idx on public.meal_food_catalog (category, name);
create index if not exists food_correction_reports_food_idx on public.food_correction_reports (food_id, status);
