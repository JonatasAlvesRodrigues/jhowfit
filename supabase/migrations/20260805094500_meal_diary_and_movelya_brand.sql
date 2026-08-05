create table if not exists public.meal_food_catalog (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  category text not null default 'Geral',
  serving_quantity numeric(8,2) not null default 1,
  serving_unit text not null default 'porção',
  calories numeric(8,2) not null default 0,
  protein numeric(6,2) not null default 0,
  carbs numeric(6,2) not null default 0,
  fat numeric(6,2) not null default 0,
  fiber numeric(6,2) not null default 0,
  sodium numeric(8,2) not null default 0,
  source_type text not null default 'public',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_food_catalog_source_check check (source_type in ('public', 'custom', 'barcode'))
);

create table if not exists public.meal_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid not null references public.meal_food_catalog(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

create table if not exists public.meal_combinations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.daily_stats
  add column if not exists carbs_current numeric(6,2) not null default 0,
  add column if not exists carbs_goal numeric(6,2) not null default 240,
  add column if not exists fat_current numeric(6,2) not null default 0,
  add column if not exists fat_goal numeric(6,2) not null default 70,
  add column if not exists fiber_current numeric(6,2) not null default 0,
  add column if not exists fiber_goal numeric(6,2) not null default 30;

alter table public.meals
  add column if not exists meal_section text not null default 'Almoço',
  add column if not exists quantity numeric(8,2) not null default 1,
  add column if not exists unit text not null default 'porção',
  add column if not exists fiber numeric(6,2) not null default 0,
  add column if not exists sodium numeric(8,2) not null default 0,
  add column if not exists source_type text not null default 'search',
  add column if not exists food_catalog_id uuid references public.meal_food_catalog(id) on delete set null,
  add column if not exists combo_id uuid references public.meal_combinations(id) on delete set null,
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.meal_food_catalog enable row level security;
alter table public.meal_favorites enable row level security;
alter table public.meal_combinations enable row level security;
alter table public.meals enable row level security;

drop policy if exists "Public foods are readable" on public.meal_food_catalog;
create policy "Public foods are readable"
  on public.meal_food_catalog
  for select
  using (is_public or auth.uid() = user_id);

drop policy if exists "Users manage own foods" on public.meal_food_catalog;
create policy "Users manage own foods"
  on public.meal_food_catalog
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own favorites" on public.meal_favorites;
create policy "Users manage own favorites"
  on public.meal_favorites
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own meal combinations" on public.meal_combinations;
create policy "Users manage own meal combinations"
  on public.meal_combinations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own meals" on public.meals;
create policy "Users manage own meals"
  on public.meals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into public.meal_food_catalog (name, category, serving_quantity, serving_unit, calories, protein, carbs, fat, fiber, sodium, source_type, is_public)
values
  ('Aveia em flocos', 'Cereais', 40, 'g', 155, 5.4, 27.0, 3.0, 4.0, 2.0, 'public', true),
  ('Banana', 'Frutas', 1, 'unidade média', 105, 1.3, 27.0, 0.4, 3.1, 1.0, 'public', true),
  ('Arroz integral cozido', 'Base', 100, 'g', 123, 2.6, 25.8, 1.0, 1.8, 5.0, 'public', true),
  ('Peito de frango grelhado', 'Proteínas', 100, 'g', 165, 31.0, 0.0, 3.6, 0.0, 74.0, 'public', true),
  ('Ovo inteiro', 'Proteínas', 1, 'unidade', 72, 6.3, 0.4, 4.8, 0.0, 71.0, 'public', true),
  ('Iogurte natural', 'Laticínios', 170, 'g', 98, 5.3, 7.0, 5.0, 0.0, 59.0, 'public', true),
  ('Pão integral', 'Padaria', 2, 'fatias', 132, 7.0, 24.0, 2.2, 3.0, 230.0, 'public', true),
  ('Batata doce cozida', 'Base', 100, 'g', 86, 1.6, 20.1, 0.1, 3.0, 55.0, 'public', true),
  ('Brócolis', 'Vegetais', 100, 'g', 35, 2.4, 7.2, 0.4, 3.3, 41.0, 'public', true),
  ('Whey protein', 'Suplementos', 30, 'g', 120, 24.0, 3.0, 1.5, 0.0, 55.0, 'public', true)
on conflict do nothing;
