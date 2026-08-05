create table if not exists public.body_progress_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recorded_at timestamptz not null,
  weight_kg numeric(6,2) not null check (weight_kg between 25 and 400),
  body_fat_percent numeric(5,2) check (body_fat_percent is null or body_fat_percent between 1 and 80),
  waist_cm numeric(6,2) check (waist_cm is null or waist_cm between 20 and 300),
  abdomen_cm numeric(6,2) check (abdomen_cm is null or abdomen_cm between 20 and 300),
  chest_cm numeric(6,2) check (chest_cm is null or chest_cm between 20 and 300),
  right_arm_cm numeric(6,2) check (right_arm_cm is null or right_arm_cm between 10 and 150),
  left_arm_cm numeric(6,2) check (left_arm_cm is null or left_arm_cm between 10 and 150),
  hips_cm numeric(6,2) check (hips_cm is null or hips_cm between 20 and 300),
  right_thigh_cm numeric(6,2) check (right_thigh_cm is null or right_thigh_cm between 10 and 200),
  left_thigh_cm numeric(6,2) check (left_thigh_cm is null or left_thigh_cm between 10 and 200),
  calf_cm numeric(6,2) check (calf_cm is null or calf_cm between 10 and 150),
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.progress_photo_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_at timestamptz not null,
  front_path text not null,
  side_path text not null,
  back_path text not null,
  observation text not null default '' check (char_length(observation) <= 1000),
  is_blurred boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.body_progress_entries enable row level security;
alter table public.progress_photo_sets enable row level security;

create policy "Users manage own body progress"
  on public.body_progress_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own progress photo sets"
  on public.progress_photo_sets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists body_progress_user_recorded_idx
  on public.body_progress_entries (user_id, recorded_at desc);

create index if not exists progress_photo_sets_user_taken_idx
  on public.progress_photo_sets (user_id, taken_at desc);

insert into public.body_progress_entries (user_id, recorded_at, weight_kg)
select measurement.user_id, (measurement.measured_at::date + time '12:00') at time zone 'UTC', measurement.weight
from public.body_measurements measurement
where not exists (
  select 1 from public.body_progress_entries progress
  where progress.user_id = measurement.user_id
    and progress.recorded_at::date = measurement.measured_at
    and progress.weight_kg = measurement.weight
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'progress-photos',
  'progress-photos',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users upload own private progress photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users read own private progress photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users update own private progress photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete own private progress photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

