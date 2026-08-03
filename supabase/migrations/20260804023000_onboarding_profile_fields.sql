alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists gender text,
  add column if not exists height_cm numeric(5,2),
  add column if not exists current_weight numeric(6,2),
  add column if not exists goal text,
  add column if not exists experience_level text,
  add column if not exists training_days_per_week integer,
  add column if not exists average_duration_minutes integer,
  add column if not exists preferred_time text,
  add column if not exists available_days text[] not null default '{}',
  add column if not exists training_locations text[] not null default '{}',
  add column if not exists equipment text[] not null default '{}',
  add column if not exists meals_per_day integer,
  add column if not exists dietary_preferences text[] not null default '{}',
  add column if not exists avoided_foods text,
  add column if not exists allergies text,
  add column if not exists dietary_restrictions text[] not null default '{}',
  add column if not exists monthly_food_budget numeric(10,2),
  add column if not exists has_injuries boolean not null default false,
  add column if not exists injuries_details text,
  add column if not exists has_pain boolean not null default false,
  add column if not exists pain_details text,
  add column if not exists has_physical_limitations boolean not null default false,
  add column if not exists physical_limitations_details text,
  add column if not exists has_health_conditions boolean not null default false,
  add column if not exists health_conditions_details text,
  add column if not exists uses_medication boolean not null default false,
  add column if not exists medication_details text,
  add column if not exists pregnancy_status text,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_completed_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_height_cm_check,
  add constraint profiles_height_cm_check check (height_cm is null or height_cm between 80 and 250),
  drop constraint if exists profiles_current_weight_check,
  add constraint profiles_current_weight_check check (current_weight is null or current_weight between 25 and 400),
  drop constraint if exists profiles_training_days_check,
  add constraint profiles_training_days_check check (training_days_per_week is null or training_days_per_week between 1 and 7),
  drop constraint if exists profiles_duration_check,
  add constraint profiles_duration_check check (average_duration_minutes is null or average_duration_minutes between 10 and 300),
  drop constraint if exists profiles_meals_check,
  add constraint profiles_meals_check check (meals_per_day is null or meals_per_day between 1 and 12);

drop policy if exists "Users insert their own profile" on public.profiles;
create policy "Users insert their own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

grant select, insert, update on public.profiles to authenticated;
