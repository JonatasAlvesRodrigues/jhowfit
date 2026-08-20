-- Perfil social separado do perfil de saude. Nenhum campo corporal, nutricional
-- ou clinico de profiles e exposto para a Comunidade.
create table if not exists public.community_profile_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text,
  bio text,
  profile_visibility text not null default 'public',
  activity_visibility text not null default 'public',
  share_distance boolean not null default true,
  share_achievements boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_profile_settings_username_check check (username is null or username ~ '^[a-z0-9_]{3,30}$'),
  constraint community_profile_settings_bio_check check (bio is null or char_length(bio) <= 200),
  constraint community_profile_settings_profile_visibility_check check (profile_visibility in ('public', 'private')),
  constraint community_profile_settings_activity_visibility_check check (activity_visibility in ('public', 'private'))
);

create unique index if not exists community_profile_settings_username_lower_key
  on public.community_profile_settings (lower(username)) where username is not null;

create or replace function public.community_normalize_profile_settings()
returns trigger language plpgsql set search_path = public as $$
begin
  new.username := nullif(lower(trim(new.username)), '');
  new.bio := nullif(trim(regexp_replace(coalesce(new.bio, ''), '\\s+', ' ', 'g')), '');
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.community_prevent_profile_settings_owner_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception using errcode = '42501', message = 'community_profile_settings_owner_cannot_be_changed';
  end if;
  return new;
end;
$$;

drop trigger if exists community_profile_settings_normalize on public.community_profile_settings;
create trigger community_profile_settings_normalize
  before insert or update on public.community_profile_settings
  for each row execute function public.community_normalize_profile_settings();
drop trigger if exists community_profile_settings_prevent_owner_change on public.community_profile_settings;
create trigger community_profile_settings_prevent_owner_change
  before update on public.community_profile_settings
  for each row execute function public.community_prevent_profile_settings_owner_change();

alter table public.community_profile_settings enable row level security;
drop policy if exists "Users manage their own community profile settings" on public.community_profile_settings;
create policy "Users manage their own community profile settings"
  on public.community_profile_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.community_profile_settings to authenticated;

-- Um perfil privado tambem protege as publicacoes que ja estavam marcadas como publicas.
create or replace function public.can_view_community_post(target_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.posts post_item
    where post_item.id = target_post_id
      and (
        post_item.user_id = auth.uid()
        or (
          post_item.status = 'published'
          and (post_item.expires_at is null or post_item.expires_at > now())
          and exists (
            select 1 from public.profiles profile
            where profile.id = post_item.user_id and profile.account_status = 'active'
          )
          and not public.are_community_users_blocked(auth.uid(), post_item.user_id)
          and (
            coalesce((select setting.profile_visibility from public.community_profile_settings setting where setting.user_id = post_item.user_id), 'public') = 'public'
            or exists (
              select 1 from public.follows profile_follow
              where profile_follow.follower_id = auth.uid() and profile_follow.following_id = post_item.user_id
            )
          )
          and (
            post_item.visibility = 'public'
            or (
              post_item.visibility = 'followers'
              and exists (
                select 1 from public.follows follow_item
                where follow_item.follower_id = auth.uid() and follow_item.following_id = post_item.user_id
              )
            )
          )
        )
      )
  );
$$;

-- Agrega apenas dados explicitamente sociais. A funcao executa no servidor para
-- preservar RLS das tabelas de treino/atividade e nunca retorna dados sensiveis.
create or replace function public.community_social_profile(target_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  target_profile record;
  setting_username text;
  setting_bio text;
  setting_profile_visibility text := 'public';
  setting_activity_visibility text := 'public';
  setting_share_distance boolean := true;
  setting_share_achievements boolean := true;
  is_own_profile boolean;
  follows_target boolean := false;
  allowed boolean := false;
  active_cursor date;
  current_streak integer := 0;
  workout_total integer := 0;
  distance_total numeric := 0;
  follower_total integer := 0;
  following_total integer := 0;
  public_stats boolean := false;
  achievement_items jsonb := '[]'::jsonb;
begin
  if viewer_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select id, full_name, avatar_url into target_profile
  from public.profiles where id = target_user_id and account_status = 'active';
  if not found then return jsonb_build_object('state', 'not_found'); end if;
  if public.are_community_users_blocked(viewer_id, target_user_id) then return jsonb_build_object('state', 'blocked'); end if;

  select username, bio, profile_visibility, activity_visibility, share_distance, share_achievements
  into setting_username, setting_bio, setting_profile_visibility, setting_activity_visibility, setting_share_distance, setting_share_achievements
  from public.community_profile_settings where user_id = target_user_id;
  is_own_profile := viewer_id = target_user_id;
  select exists(select 1 from public.follows where follower_id = viewer_id and following_id = target_user_id) into follows_target;
  allowed := is_own_profile or coalesce(setting_profile_visibility, 'public') = 'public' or follows_target;
  if not allowed then return jsonb_build_object('state', 'private'); end if;

  select count(*) into follower_total from public.follows where following_id = target_user_id;
  select count(*) into following_total from public.follows where follower_id = target_user_id;
  public_stats := is_own_profile or coalesce(setting_activity_visibility, 'public') = 'public';

  if public_stats or is_own_profile or coalesce(setting_share_achievements, true) then
    select count(*) into workout_total from public.workout_sessions where user_id = target_user_id and status = 'completed';
  end if;

  if public_stats then
    if is_own_profile or coalesce(setting_share_distance, true) then
      select coalesce(sum(distance_km), 0) into distance_total from public.outdoor_activities where user_id = target_user_id;
    end if;

    active_cursor := current_date;
    if not exists (
      select 1 from public.daily_stats where user_id = target_user_id and date = active_cursor
      union all select 1 from public.workout_sessions where user_id = target_user_id and status = 'completed' and coalesce(ended_at, started_at)::date = active_cursor
      union all select 1 from public.outdoor_activities where user_id = target_user_id and started_at::date = active_cursor
    ) then active_cursor := active_cursor - 1; end if;
    while current_streak < 366 and exists (
      select 1 from public.daily_stats where user_id = target_user_id and date = active_cursor
      union all select 1 from public.workout_sessions where user_id = target_user_id and status = 'completed' and coalesce(ended_at, started_at)::date = active_cursor
      union all select 1 from public.outdoor_activities where user_id = target_user_id and started_at::date = active_cursor
    ) loop current_streak := current_streak + 1; active_cursor := active_cursor - 1; end loop;
  end if;

  if is_own_profile or coalesce(setting_share_achievements, true) then
    select coalesce(jsonb_agg(item order by (item->>'threshold')::int), '[]'::jsonb) into achievement_items
    from (
      select jsonb_build_object('id', id, 'title', title, 'threshold', threshold) as item
      from (values
        ('first-workout', 'Primeiro movimento', 1),
        ('five-workouts', 'Ritmo encontrado', 5),
        ('ten-workouts', 'Dez na conta', 10),
        ('twenty-five-workouts', 'Rotina de verdade', 25),
        ('fifty-workouts', 'Força da constância', 50),
        ('hundred-workouts', 'Centenário do movimento', 100)
      ) as definitions(id, title, threshold)
      where threshold <= workout_total
    ) unlocked;
  end if;

  return jsonb_build_object(
    'state', 'available', 'user_id', target_user_id,
    'name', coalesce(nullif(trim(target_profile.full_name), ''), 'Membro MOVELYA'),
    'avatar_url', target_profile.avatar_url, 'username', setting_username, 'bio', setting_bio,
    'is_own_profile', is_own_profile, 'following_by_me', follows_target,
    'profile_visibility', coalesce(setting_profile_visibility, 'public'),
    'activity_visibility', coalesce(setting_activity_visibility, 'public'),
    'followers_count', follower_total, 'following_count', following_total,
    'streak', case when public_stats then current_streak else null end,
    'workouts_count', case when public_stats then workout_total else null end,
    'distance_km', case when public_stats and (is_own_profile or coalesce(setting_share_distance, true)) then distance_total else null end,
    'achievements', achievement_items
  );
end;
$$;

grant execute on function public.community_social_profile(uuid) to authenticated;
revoke all on function public.community_social_profile(uuid) from public, anon;
