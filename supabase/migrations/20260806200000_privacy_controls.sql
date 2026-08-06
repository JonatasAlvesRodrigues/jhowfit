create table if not exists public.ai_data_permissions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile boolean not null default false,
  nutrition boolean not null default false,
  workouts boolean not null default false,
  weight boolean not null default false,
  measurements boolean not null default false,
  photos boolean not null default false,
  activities boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.privacy_consent_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in ('privacy_policy', 'terms_of_use', 'ai_data_processing', 'health_integration')),
  version text not null check (char_length(version) between 1 and 40),
  granted boolean not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.privacy_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  action text not null check (char_length(action) between 2 and 80),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_data_permissions enable row level security;
alter table public.privacy_consent_history enable row level security;
alter table public.privacy_audit_logs enable row level security;

create policy "Users manage own AI data permissions" on public.ai_data_permissions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users read own consent history" on public.privacy_consent_history for select
  using (auth.uid() = user_id);
create policy "Users record own consent history" on public.privacy_consent_history for insert
  with check (auth.uid() = user_id);
create policy "Users read own privacy audit logs" on public.privacy_audit_logs for select
  using (auth.uid() = user_id);

create index if not exists privacy_consent_history_user_date_idx on public.privacy_consent_history (user_id, granted_at desc);
create index if not exists privacy_audit_logs_user_date_idx on public.privacy_audit_logs (user_id, created_at desc);

create or replace function public.log_privacy_action(action_name text, action_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if action_name is null or char_length(trim(action_name)) < 2 then raise exception 'Invalid audit action'; end if;
  insert into public.privacy_audit_logs (user_id, action, metadata)
  values (auth.uid(), left(trim(action_name), 80), coalesce(action_metadata, '{}'::jsonb));
end;
$$;
grant execute on function public.log_privacy_action(text, jsonb) to authenticated;

create or replace function public.delete_current_account(confirmation text)
returns void language plpgsql security definer set search_path = public, auth
as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if confirmation <> 'EXCLUIR MINHA CONTA' then raise exception 'Confirmation text does not match'; end if;
  insert into public.privacy_audit_logs (user_id, action, metadata)
  values (current_user_id, 'account_deleted', jsonb_build_object('requested_at', now()));
  delete from auth.users where id = current_user_id;
end;
$$;
grant execute on function public.delete_current_account(text) to authenticated;
