-- Rankings sociais: dados de atividade validos, janela semanal local e privacidade
-- aplicada no servidor. A funcao e o unico ponto de leitura para a interface;
-- quando a base crescer, o mesmo contrato pode ser alimentado por uma view
-- materializada/tabela agregada atualizada por job, sem alterar o aplicativo.

create or replace function public.community_rankings(
  ranking_scope text default 'global',
  ranking_category text default 'streak',
  requested_limit integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  viewer_timezone text := 'America/Sao_Paulo';
  local_today date;
  week_start_local date;
  week_start_at timestamptz;
  next_week_start_at timestamptz;
  safe_limit integer := least(greatest(coalesce(requested_limit, 10), 3), 50);
  result jsonb;
begin
  if viewer_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if ranking_scope not in ('global', 'friends') then
    raise exception using errcode = '22023', message = 'invalid_ranking_scope';
  end if;
  if ranking_category not in ('streak', 'workouts', 'distance') then
    raise exception using errcode = '22023', message = 'invalid_ranking_category';
  end if;

  select timezone into viewer_timezone
  from public.activity_streak_settings
  where user_id = viewer_id;
  viewer_timezone := coalesce(nullif(viewer_timezone, ''), 'America/Sao_Paulo');
  begin
    local_today := (now() at time zone viewer_timezone)::date;
    week_start_local := date_trunc('week', now() at time zone viewer_timezone)::date;
    week_start_at := week_start_local::timestamp at time zone viewer_timezone;
    next_week_start_at := (week_start_local + 7)::timestamp at time zone viewer_timezone;
  exception when invalid_parameter_value then
    viewer_timezone := 'America/Sao_Paulo';
    local_today := (now() at time zone viewer_timezone)::date;
    week_start_local := date_trunc('week', now() at time zone viewer_timezone)::date;
    week_start_at := week_start_local::timestamp at time zone viewer_timezone;
    next_week_start_at := (week_start_local + 7)::timestamp at time zone viewer_timezone;
  end;

  with scoped_users as (
    select profile.id as user_id,
      coalesce(nullif(trim(profile.full_name), ''), 'Membro MOVELYA') as name,
      profile.avatar_url
    from public.profiles profile
    left join public.community_profile_settings setting on setting.user_id = profile.id
    where profile.account_status = 'active'
      and (
        profile.id = viewer_id
        or (
          coalesce(setting.profile_visibility, 'public') = 'public'
          and coalesce(setting.activity_visibility, 'public') = 'public'
        )
      )
      and not public.are_community_users_blocked(viewer_id, profile.id)
      and (
        ranking_scope = 'global'
        or profile.id = viewer_id
        or (
          exists (select 1 from public.follows outgoing where outgoing.follower_id = viewer_id and outgoing.following_id = profile.id)
          and exists (select 1 from public.follows incoming where incoming.follower_id = profile.id and incoming.following_id = viewer_id)
        )
      )
  ),
  valid_activity_days as (
    select distinct session_item.user_id, (session_item.ended_at at time zone viewer_timezone)::date as activity_day
    from public.workout_sessions session_item
    join scoped_users scope on scope.user_id = session_item.user_id
    where session_item.status = 'completed'
      and session_item.ended_at is not null
      and session_item.duration_seconds >= 600
      and session_item.completed_sets >= 1
    union
    select distinct activity_item.user_id, (activity_item.ended_at at time zone viewer_timezone)::date as activity_day
    from public.outdoor_activities activity_item
    join scoped_users scope on scope.user_id = activity_item.user_id
    where activity_item.interrupted = false
      and activity_item.ended_at > activity_item.started_at
      and activity_item.duration_seconds >= case when activity_item.type in ('bike', 'other') then 900 else 600 end
      and activity_item.distance_km >= case when activity_item.type = 'bike' then 2 else 0.5 end
      and activity_item.average_speed_kmh > 0
      and activity_item.average_speed_kmh <= case
        when activity_item.type = 'walk' then 12
        when activity_item.type in ('run', 'treadmill') then 30
        when activity_item.type = 'bike' then 65
        else 35
      end
  ),
  streak_numbered as (
    select user_id, activity_day,
      activity_day - (row_number() over (partition by user_id order by activity_day))::integer as streak_group
    from valid_activity_days
  ),
  active_streaks as (
    select user_id, count(*)::integer as current_streak
    from streak_numbered
    group by user_id, streak_group
    having max(activity_day) between local_today - 1 and local_today
  ),
  weekly_workouts as (
    select session_item.user_id, count(*)::numeric as metric
    from public.workout_sessions session_item
    join scoped_users scope on scope.user_id = session_item.user_id
    where session_item.status = 'completed'
      and session_item.ended_at >= week_start_at
      and session_item.ended_at < next_week_start_at
      and session_item.duration_seconds >= 600
      and session_item.completed_sets >= 1
    group by session_item.user_id
  ),
  weekly_distance as (
    select activity_item.user_id, coalesce(sum(activity_item.distance_km), 0)::numeric as metric
    from public.outdoor_activities activity_item
    join scoped_users scope on scope.user_id = activity_item.user_id
    where activity_item.ended_at >= week_start_at
      and activity_item.ended_at < next_week_start_at
      and activity_item.interrupted = false
      and activity_item.ended_at > activity_item.started_at
      and activity_item.duration_seconds >= case when activity_item.type in ('bike', 'other') then 900 else 600 end
      and activity_item.distance_km >= case when activity_item.type = 'bike' then 2 else 0.5 end
      and activity_item.average_speed_kmh > 0
      and activity_item.average_speed_kmh <= case
        when activity_item.type = 'walk' then 12
        when activity_item.type in ('run', 'treadmill') then 30
        when activity_item.type = 'bike' then 65
        else 35
      end
    group by activity_item.user_id
  ),
  measured as (
    select scope.user_id, scope.name, scope.avatar_url,
      case ranking_category
        when 'streak' then coalesce(streak.current_streak, 0)::numeric
        when 'workouts' then coalesce(workout.metric, 0)::numeric
        else coalesce(distance.metric, 0)::numeric
      end as metric
    from scoped_users scope
    left join active_streaks streak on streak.user_id = scope.user_id
    left join weekly_workouts workout on workout.user_id = scope.user_id
    left join weekly_distance distance on distance.user_id = scope.user_id
  ),
  positioned as (
    select user_id, name, avatar_url, metric,
      rank() over (order by metric desc) as position
    from measured
    where metric > 0
  ),
  top_entries as (
    select * from positioned order by position, name limit safe_limit
  ),
  viewer_entry as (
    select position, metric from positioned where user_id = viewer_id
  )
  select jsonb_build_object(
    'scope', ranking_scope,
    'category', ranking_category,
    'week_start', week_start_local,
    'timezone', viewer_timezone,
    'entries', coalesce((select jsonb_agg(jsonb_build_object(
      'user_id', user_id, 'name', name, 'avatar_url', avatar_url,
      'metric', metric, 'position', position, 'is_current_user', user_id = viewer_id
    ) order by position, name) from top_entries), '[]'::jsonb),
    'my_position', (select position from viewer_entry),
    'my_metric', (select metric from viewer_entry)
  ) into result;

  return result;
end;
$$;

revoke all on function public.community_rankings(text, text, integer) from public, anon;
grant execute on function public.community_rankings(text, text, integer) to authenticated;

comment on function public.community_rankings(text, text, integer) is
  'Contrato de ranking da Comunidade. Em escala maior, substituir as CTEs por agregados materializados sem alterar o cliente.';
