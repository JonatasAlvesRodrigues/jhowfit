create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  paused_until timestamptz,
  quiet_start time not null default '22:00',
  quiet_end time not null default '07:00',
  preferences jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(preferences) = 'array')
);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('workout', 'water', 'meal', 'walk', 'weigh_in', 'goal_near', 'weekly_summary')),
  title text not null check (char_length(title) between 1 and 100),
  message text not null check (char_length(message) between 1 and 280),
  action_path text not null default '/notificacoes' check (action_path like '/%'),
  action_label text not null default 'Abrir' check (char_length(action_label) between 1 and 40),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  user_agent text not null default '',
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table if not exists public.notification_delivery_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('workout', 'water', 'meal', 'walk', 'weigh_in', 'goal_near', 'weekly_summary')),
  delivered_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;
alter table public.app_notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_delivery_log enable row level security;

create policy "Users manage own notification settings" on public.notification_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users read own notifications" on public.app_notifications for select using (auth.uid() = user_id);
create policy "Users update own notifications" on public.app_notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own push subscriptions" on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users read own delivery log" on public.notification_delivery_log for select using (auth.uid() = user_id);

create index if not exists app_notifications_user_created_idx on public.app_notifications (user_id, created_at desc);
create index if not exists app_notifications_user_unread_idx on public.app_notifications (user_id, read_at) where read_at is null;
create index if not exists notification_delivery_log_throttle_idx on public.notification_delivery_log (user_id, type, delivered_at desc);

comment on table public.notification_delivery_log is 'Server-side throttle source: workers must enforce quiet hours, at least 60 minutes between repeated reminders, and a conservative daily cap before delivery.';

