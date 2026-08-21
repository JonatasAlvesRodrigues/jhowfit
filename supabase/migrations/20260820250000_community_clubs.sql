-- Clubes da Comunidade: atividade, desafios e rankings. Nao ha chat ou mensagens.

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  avatar_url text,
  cover_url text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  privacy text not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clubs_name_check check (char_length(trim(name)) between 3 and 60),
  constraint clubs_description_check check (char_length(description) <= 500),
  constraint clubs_privacy_check check (privacy in ('public', 'private'))
);

create unique index if not exists clubs_name_lower_key on public.clubs (lower(trim(name)));
create index if not exists clubs_discovery_created_idx on public.clubs (created_at desc) where privacy = 'public';

create table if not exists public.club_members (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id),
  constraint club_members_role_check check (role in ('owner', 'moderator', 'member'))
);

create unique index if not exists club_members_single_owner_idx on public.club_members (club_id) where role = 'owner';
create index if not exists club_members_user_joined_idx on public.club_members (user_id, joined_at desc);
create index if not exists club_members_club_joined_idx on public.club_members (club_id, joined_at desc);

create table if not exists public.club_challenges (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null,
  description text not null default '',
  metric text not null,
  target_value numeric(12,2) not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'upcoming',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint club_challenges_title_check check (char_length(trim(title)) between 3 and 100),
  constraint club_challenges_description_check check (char_length(description) <= 500),
  constraint club_challenges_metric_check check (metric in ('streak', 'workouts', 'distance')),
  constraint club_challenges_target_check check (target_value > 0),
  constraint club_challenges_dates_check check (ends_at > starts_at),
  constraint club_challenges_status_check check (status in ('upcoming', 'active', 'completed', 'cancelled'))
);
create index if not exists club_challenges_active_idx on public.club_challenges (club_id, status, starts_at, ends_at);

create table if not exists public.club_challenge_participants (
  challenge_id uuid not null references public.club_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index if not exists club_challenge_participants_user_idx on public.club_challenge_participants (user_id, joined_at desc);

create or replace function public.club_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.club_normalize_and_lock_owner()
returns trigger language plpgsql set search_path = public as $$
begin
  new.name := trim(regexp_replace(new.name, '[[:space:]]+', ' ', 'g'));
  new.description := trim(new.description);
  if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id then
    raise exception using errcode = '42501', message = 'club_owner_cannot_be_changed';
  end if;
  return new;
end;
$$;

create or replace function public.club_add_owner_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.club_members (club_id, user_id, role) values (new.id, new.owner_id, 'owner') on conflict (club_id, user_id) do nothing;
  return new;
end;
$$;

create or replace function public.can_view_community_club(target_club_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.clubs club
    where club.id = target_club_id
      and not public.are_community_users_blocked(auth.uid(), club.owner_id)
      and (club.privacy = 'public' or exists (
        select 1 from public.club_members membership where membership.club_id = club.id and membership.user_id = auth.uid()
      ))
  );
$$;

create or replace function public.can_manage_community_club(target_club_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.club_members membership
    where membership.club_id = target_club_id and membership.user_id = auth.uid() and membership.role in ('owner', 'moderator')
  );
$$;

drop trigger if exists clubs_normalize_and_lock_owner on public.clubs;
create trigger clubs_normalize_and_lock_owner before insert or update on public.clubs for each row execute function public.club_normalize_and_lock_owner();
drop trigger if exists clubs_set_updated_at on public.clubs;
create trigger clubs_set_updated_at before update on public.clubs for each row execute function public.club_set_updated_at();
drop trigger if exists clubs_add_owner_membership on public.clubs;
create trigger clubs_add_owner_membership after insert on public.clubs for each row execute function public.club_add_owner_membership();

alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_challenges enable row level security;
alter table public.club_challenge_participants enable row level security;

drop policy if exists "Members view allowed clubs" on public.clubs;
drop policy if exists "Users create their clubs" on public.clubs;
drop policy if exists "Owners update their clubs" on public.clubs;
drop policy if exists "Owners delete their clubs" on public.clubs;
drop policy if exists "Members view allowed club memberships" on public.club_members;
drop policy if exists "Managers create club challenges" on public.club_challenges;
drop policy if exists "Members view allowed club challenges" on public.club_challenges;
drop policy if exists "Managers update club challenges" on public.club_challenges;
drop policy if exists "Managers delete club challenges" on public.club_challenges;
drop policy if exists "Members view challenge participants" on public.club_challenge_participants;

create policy "Members view allowed clubs" on public.clubs for select to authenticated using (public.can_view_community_club(id));
create policy "Users create their clubs" on public.clubs for insert to authenticated with check (owner_id = auth.uid());
create policy "Owners update their clubs" on public.clubs for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Owners delete their clubs" on public.clubs for delete to authenticated using (owner_id = auth.uid());
create policy "Members view allowed club memberships" on public.club_members for select to authenticated using (public.can_view_community_club(club_id));
create policy "Managers create club challenges" on public.club_challenges for insert to authenticated with check (public.can_manage_community_club(club_id) and created_by = auth.uid());
create policy "Members view allowed club challenges" on public.club_challenges for select to authenticated using (public.can_view_community_club(club_id));
create policy "Managers update club challenges" on public.club_challenges for update to authenticated using (public.can_manage_community_club(club_id)) with check (public.can_manage_community_club(club_id));
create policy "Managers delete club challenges" on public.club_challenges for delete to authenticated using (public.can_manage_community_club(club_id));
create policy "Members view challenge participants" on public.club_challenge_participants for select to authenticated using (exists (select 1 from public.club_challenges challenge where challenge.id = challenge_id and public.can_view_community_club(challenge.club_id)));

grant select, insert, update, delete on public.clubs to authenticated;
grant select on public.club_members to authenticated;
grant select, insert, update, delete on public.club_challenges to authenticated;
grant select on public.club_challenge_participants to authenticated;

create or replace function public.join_community_club(target_club_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare viewer_id uuid := auth.uid(); club_owner uuid; club_privacy text;
begin
  if viewer_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  select owner_id, privacy into club_owner, club_privacy from public.clubs where id = target_club_id;
  if not found then raise exception using errcode = 'P0002', message = 'club_not_found'; end if;
  if club_privacy <> 'public' then raise exception using errcode = '42501', message = 'club_is_private'; end if;
  if public.are_community_users_blocked(viewer_id, club_owner) then raise exception using errcode = '42501', message = 'club_not_available'; end if;
  insert into public.club_members (club_id, user_id, role) values (target_club_id, viewer_id, 'member') on conflict (club_id, user_id) do nothing;
  return jsonb_build_object('joined', true);
end;
$$;

create or replace function public.leave_community_club(target_club_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare viewer_id uuid := auth.uid(); member_role text;
begin
  if viewer_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  select role into member_role from public.club_members where club_id = target_club_id and user_id = viewer_id;
  if member_role = 'owner' then raise exception using errcode = '22023', message = 'club_owner_cannot_leave'; end if;
  delete from public.club_members where club_id = target_club_id and user_id = viewer_id;
  return jsonb_build_object('joined', false);
end;
$$;

create or replace function public.join_community_club_challenge(target_challenge_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare viewer_id uuid := auth.uid(); target_club uuid; challenge_status text;
begin
  if viewer_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  select club_id, status into target_club, challenge_status from public.club_challenges where id = target_challenge_id;
  if not found then raise exception using errcode = 'P0002', message = 'challenge_not_found'; end if;
  if challenge_status not in ('upcoming', 'active') then raise exception using errcode = '22023', message = 'challenge_not_open'; end if;
  if not exists (select 1 from public.club_members where club_id = target_club and user_id = viewer_id) then raise exception using errcode = '42501', message = 'club_membership_required'; end if;
  insert into public.club_challenge_participants (challenge_id, user_id) values (target_challenge_id, viewer_id) on conflict do nothing;
  return jsonb_build_object('joined', true);
end;
$$;

create or replace function public.community_club_directory()
returns table(id uuid, name text, description text, avatar_url text, cover_url text, members_count integer, challenges_count integer, joined boolean)
language sql stable security definer set search_path = public as $$
  select club.id, club.name, club.description, club.avatar_url, club.cover_url,
    (select count(*)::integer from public.club_members membership where membership.club_id = club.id),
    (select count(*)::integer from public.club_challenges challenge where challenge.club_id = club.id and challenge.status in ('upcoming', 'active')),
    exists (select 1 from public.club_members membership where membership.club_id = club.id and membership.user_id = auth.uid())
  from public.clubs club
  where auth.uid() is not null and club.privacy = 'public' and not public.are_community_users_blocked(auth.uid(), club.owner_id)
  order by (select count(*) from public.club_members membership where membership.club_id = club.id) desc, club.created_at desc;
$$;

create or replace function public.community_club_detail(target_club_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare viewer_id uuid := auth.uid(); club_item public.clubs%rowtype; joined_role text; member_total integer; challenge_items jsonb;
begin
  if viewer_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  select * into club_item from public.clubs where id = target_club_id;
  if not found or public.are_community_users_blocked(viewer_id, club_item.owner_id) then return jsonb_build_object('state', 'not_found'); end if;
  select role into joined_role from public.club_members where club_id = club_item.id and user_id = viewer_id;
  if club_item.privacy = 'private' and joined_role is null then return jsonb_build_object('state', 'private'); end if;
  select count(*) into member_total from public.club_members where club_id = club_item.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', challenge.id, 'title', challenge.title, 'description', challenge.description, 'metric', challenge.metric,
    'target_value', challenge.target_value, 'starts_at', challenge.starts_at, 'ends_at', challenge.ends_at, 'status', challenge.status,
    'participants_count', (select count(*) from public.club_challenge_participants participant where participant.challenge_id = challenge.id),
    'joined_by_me', exists (select 1 from public.club_challenge_participants participant where participant.challenge_id = challenge.id and participant.user_id = viewer_id)
  ) order by challenge.starts_at asc), '[]'::jsonb) into challenge_items
  from public.club_challenges challenge where challenge.club_id = club_item.id and challenge.status in ('upcoming', 'active');
  return jsonb_build_object('state','available','id',club_item.id,'name',club_item.name,'description',club_item.description,
    'avatar_url',club_item.avatar_url,'cover_url',club_item.cover_url,'privacy',club_item.privacy,'members_count',member_total,
    'joined', joined_role is not null, 'role', joined_role, 'challenges', challenge_items);
end;
$$;

-- Mesmo contrato compacto do ranking global, limitado a membros do clube.
create or replace function public.community_club_rankings(target_club_id uuid, ranking_category text default 'streak', requested_limit integer default 10)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare viewer_id uuid := auth.uid(); viewer_timezone text := 'America/Sao_Paulo'; local_today date; week_start_local date; week_start_at timestamptz; next_week_start_at timestamptz; safe_limit integer := least(greatest(coalesce(requested_limit, 10), 3), 50); response jsonb;
begin
  if viewer_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  if ranking_category not in ('streak', 'workouts', 'distance') then raise exception using errcode = '22023', message = 'invalid_ranking_category'; end if;
  if not public.can_view_community_club(target_club_id) then raise exception using errcode = '42501', message = 'club_not_available'; end if;
  select timezone into viewer_timezone from public.activity_streak_settings where user_id = viewer_id;
  viewer_timezone := coalesce(nullif(viewer_timezone, ''), 'America/Sao_Paulo');
  begin
    local_today := (now() at time zone viewer_timezone)::date;
    week_start_local := date_trunc('week', now() at time zone viewer_timezone)::date;
    week_start_at := week_start_local::timestamp at time zone viewer_timezone;
    next_week_start_at := (week_start_local + 7)::timestamp at time zone viewer_timezone;
  exception when invalid_parameter_value then
    viewer_timezone := 'America/Sao_Paulo'; local_today := (now() at time zone viewer_timezone)::date;
    week_start_local := date_trunc('week', now() at time zone viewer_timezone)::date;
    week_start_at := week_start_local::timestamp at time zone viewer_timezone; next_week_start_at := (week_start_local + 7)::timestamp at time zone viewer_timezone;
  end;
  with scoped_users as (
    select profile.id as user_id, coalesce(nullif(trim(profile.full_name), ''), 'Membro MOVELYA') as name, profile.avatar_url
    from public.club_members membership
    join public.profiles profile on profile.id = membership.user_id and profile.account_status = 'active'
    left join public.community_profile_settings setting on setting.user_id = profile.id
    where membership.club_id = target_club_id
      and not public.are_community_users_blocked(viewer_id, profile.id)
      and (profile.id = viewer_id or (coalesce(setting.profile_visibility, 'public') = 'public' and coalesce(setting.activity_visibility, 'public') = 'public'))
  ), valid_days as (
    select distinct session_item.user_id, (session_item.ended_at at time zone viewer_timezone)::date as activity_day
    from public.workout_sessions session_item join scoped_users scope on scope.user_id = session_item.user_id
    where session_item.status = 'completed' and session_item.ended_at is not null and session_item.duration_seconds >= 600 and session_item.completed_sets >= 1
    union
    select distinct activity_item.user_id, (activity_item.ended_at at time zone viewer_timezone)::date
    from public.outdoor_activities activity_item join scoped_users scope on scope.user_id = activity_item.user_id
    where activity_item.interrupted = false and activity_item.ended_at > activity_item.started_at
      and activity_item.duration_seconds >= case when activity_item.type in ('bike', 'other') then 900 else 600 end
      and activity_item.distance_km >= case when activity_item.type = 'bike' then 2 else 0.5 end
      and activity_item.average_speed_kmh > 0 and activity_item.average_speed_kmh <= case when activity_item.type = 'walk' then 12 when activity_item.type in ('run', 'treadmill') then 30 when activity_item.type = 'bike' then 65 else 35 end
  ), streak_numbered as (
    select user_id, activity_day, activity_day - (row_number() over (partition by user_id order by activity_day))::integer as streak_group from valid_days
  ), streaks as (
    select user_id, count(*)::numeric as metric from streak_numbered group by user_id, streak_group having max(activity_day) between local_today - 1 and local_today
  ), workouts as (
    select session_item.user_id, count(*)::numeric as metric from public.workout_sessions session_item join scoped_users scope on scope.user_id = session_item.user_id
    where session_item.status = 'completed' and session_item.ended_at >= week_start_at and session_item.ended_at < next_week_start_at and session_item.duration_seconds >= 600 and session_item.completed_sets >= 1 group by session_item.user_id
  ), distance as (
    select activity_item.user_id, sum(activity_item.distance_km)::numeric as metric from public.outdoor_activities activity_item join scoped_users scope on scope.user_id = activity_item.user_id
    where activity_item.ended_at >= week_start_at and activity_item.ended_at < next_week_start_at and activity_item.interrupted = false and activity_item.ended_at > activity_item.started_at
      and activity_item.duration_seconds >= case when activity_item.type in ('bike', 'other') then 900 else 600 end
      and activity_item.distance_km >= case when activity_item.type = 'bike' then 2 else 0.5 end
      and activity_item.average_speed_kmh > 0 and activity_item.average_speed_kmh <= case when activity_item.type = 'walk' then 12 when activity_item.type in ('run', 'treadmill') then 30 when activity_item.type = 'bike' then 65 else 35 end
    group by activity_item.user_id
  ), measured as (
    select scope.user_id, scope.name, scope.avatar_url, case ranking_category when 'streak' then coalesce(streak.metric, 0) when 'workouts' then coalesce(workout.metric, 0) else coalesce(distance.metric, 0) end as metric
    from scoped_users scope left join streaks streak on streak.user_id = scope.user_id left join workouts workout on workout.user_id = scope.user_id left join distance on distance.user_id = scope.user_id
  ), positioned as (
    select user_id, name, avatar_url, metric, rank() over (order by metric desc) as position from measured where metric > 0
  ), top_entries as (select * from positioned order by position, name limit safe_limit), viewer_entry as (select position, metric from positioned where user_id = viewer_id)
  select jsonb_build_object('category',ranking_category,'week_start',week_start_local,'timezone',viewer_timezone,
    'entries',coalesce((select jsonb_agg(jsonb_build_object('user_id',user_id,'name',name,'avatar_url',avatar_url,'metric',metric,'position',position,'is_current_user',user_id=viewer_id) order by position,name) from top_entries),'[]'::jsonb),
    'my_position',(select position from viewer_entry),'my_metric',(select metric from viewer_entry)) into response;
  return response;
end;
$$;

revoke all on function public.can_view_community_club(uuid), public.can_manage_community_club(uuid) from public, anon;
revoke all on function public.join_community_club(uuid), public.leave_community_club(uuid), public.join_community_club_challenge(uuid) from public, anon;
revoke all on function public.community_club_directory(), public.community_club_detail(uuid) from public, anon;
revoke all on function public.community_club_rankings(uuid, text, integer) from public, anon;
grant execute on function public.can_view_community_club(uuid), public.can_manage_community_club(uuid) to authenticated;
grant execute on function public.join_community_club(uuid), public.leave_community_club(uuid), public.join_community_club_challenge(uuid) to authenticated;
grant execute on function public.community_club_directory(), public.community_club_detail(uuid) to authenticated;
grant execute on function public.community_club_rankings(uuid, text, integer) to authenticated;
