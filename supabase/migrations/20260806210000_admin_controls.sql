-- Funções administrativas separadas dos dados pessoais do usuário.
alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check check (account_status in ('active', 'suspended'));

create table if not exists public.app_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.feature_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  feature text not null,
  event_type text not null default 'use',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_content_flags (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('exercise', 'food', 'achievement', 'notification', 'comment')),
  target_id text not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_broadcast_notifications (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 1000),
  audience text not null default 'all' check (audience in ('all', 'active', 'moderators')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent', 'cancelled')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.achievement_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  points integer not null default 10 check (points >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public
as $$ select coalesce((select role from public.app_roles where user_id = auth.uid()), 'user') $$;

create or replace function public.has_admin_role(required_role text default 'moderator')
returns boolean language sql stable security definer set search_path = public
as $$
  select case required_role
    when 'admin' then public.current_user_role() = 'admin'
    when 'moderator' then public.current_user_role() in ('moderator', 'admin')
    else true
  end;
$$;

create or replace function public.admin_dashboard_summary()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_admin_role('moderator') then raise exception 'admin_role_required'; end if;
  select jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'active_users', (select count(*) from public.profiles where updated_at >= now() - interval '30 days' and account_status = 'active'),
    'suspended_users', (select count(*) from public.profiles where account_status = 'suspended'),
    'exercises', (select count(*) from public.exercise_library),
    'foods', (select count(*) from public.meal_food_catalog where is_public),
    'flags_open', (select count(*) from public.admin_content_flags where status in ('open', 'reviewing')),
    'feature_events_30d', (select count(*) from public.feature_usage_events where created_at >= now() - interval '30 days'),
    'audit_events_30d', (select count(*) from public.admin_audit_logs where created_at >= now() - interval '30 days')
  ) into result;
  return result;
end;
$$;

create or replace function public.admin_list_users()
returns table (user_id uuid, full_name text, created_at timestamptz, updated_at timestamptz, account_status text, role text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.full_name, p.created_at, p.updated_at, p.account_status,
    coalesce(r.role, 'user')
  from public.profiles p left join public.app_roles r on r.user_id = p.id
  where public.has_admin_role('moderator')
  order by p.updated_at desc nulls last
  limit 200;
$$;

create or replace function public.admin_set_user_suspension(target_user_id uuid, suspended boolean)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_admin_role('admin') then raise exception 'admin_role_required'; end if;
  if target_user_id = auth.uid() then raise exception 'cannot_suspend_self'; end if;
  update public.profiles set account_status = case when suspended then 'suspended' else 'active' end, updated_at = now() where id = target_user_id;
  insert into public.admin_audit_logs(actor_user_id, action, target_user_id, metadata)
  values (auth.uid(), case when suspended then 'user_suspended' else 'user_reactivated' end, target_user_id, jsonb_build_object('suspended', suspended));
  return found;
end;
$$;

create or replace function public.admin_create_broadcast(input_title text, input_body text, input_audience text default 'all')
returns uuid language plpgsql security definer set search_path = public
as $$
declare new_id uuid;
begin
  if not public.has_admin_role('admin') then raise exception 'admin_role_required'; end if;
  insert into public.admin_broadcast_notifications(created_by, title, body, audience)
  values (auth.uid(), trim(input_title), trim(input_body), input_audience) returning id into new_id;
  insert into public.admin_audit_logs(actor_user_id, action, metadata)
  values (auth.uid(), 'broadcast_created', jsonb_build_object('notification_id', new_id, 'audience', input_audience));
  return new_id;
end;
$$;

create or replace function public.admin_log_feature(feature_name text, event_name text default 'use')
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null then insert into public.feature_usage_events(user_id, feature, event_type) values (auth.uid(), left(trim(feature_name), 80), left(trim(event_name), 40)); end if;
end;
$$;

alter table public.app_roles enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.feature_usage_events enable row level security;
alter table public.admin_content_flags enable row level security;
alter table public.admin_broadcast_notifications enable row level security;
alter table public.achievement_definitions enable row level security;

create policy "Users read own role" on public.app_roles for select to authenticated using (user_id = auth.uid());
create policy "Users create content flags" on public.admin_content_flags for insert to authenticated with check (reporter_user_id = auth.uid());
create policy "Moderators review flags" on public.admin_content_flags for select to authenticated using (public.has_admin_role('moderator'));
create policy "Moderators update flags" on public.admin_content_flags for update to authenticated using (public.has_admin_role('moderator')) with check (public.has_admin_role('moderator'));
create policy "Users read active achievements" on public.achievement_definitions for select to authenticated using (active or public.has_admin_role('moderator'));

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.has_admin_role(text) to authenticated;
grant execute on function public.admin_dashboard_summary() to authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_user_suspension(uuid, boolean) to authenticated;
grant execute on function public.admin_create_broadcast(text, text, text) to authenticated;
grant execute on function public.admin_log_feature(text, text) to authenticated;

insert into public.achievement_definitions (slug, name, description, points) values
  ('primeiro-treino', 'Primeiro treino', 'Conclua seu primeiro treino.', 10),
  ('cinco-treinos', 'Cinco treinos concluídos', 'Complete cinco treinos.', 25),
  ('dez-mil-passos', 'Dez mil passos', 'Alcance 10.000 passos em um dia.', 20),
  ('sete-dias-agua', 'Sete dias registrando água', 'Registre água por sete dias.', 30),
  ('primeiro-recorde', 'Primeiro recorde de carga', 'Registre seu primeiro recorde pessoal.', 30),
  ('um-mes-atividade', 'Um mês de atividade', 'Mantenha atividade durante um mês.', 50),
  ('meta-semanal', 'Meta semanal concluída', 'Conclua uma meta semanal.', 35)
on conflict (slug) do nothing;
