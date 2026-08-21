-- Sequencia central: somente movimento fisico concluido e validado.
-- Nao considera abrir o app, post, curtida, comentario, agua, passos ou refeicoes.
create table if not exists public.activity_streak_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.activity_streak_settings enable row level security;
drop policy if exists "Users manage their own activity streak settings" on public.activity_streak_settings;
create policy "Users manage their own activity streak settings"
  on public.activity_streak_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.activity_streak_settings to authenticated;

-- Indices parciais das fontes que realmente podem gerar um dia ativo.
create index if not exists workout_sessions_streak_eligible_idx
  on public.workout_sessions (user_id, ended_at desc)
  where status = 'completed' and ended_at is not null and duration_seconds >= 600 and completed_sets >= 1;
create index if not exists outdoor_activities_streak_eligible_idx
  on public.outdoor_activities (user_id, ended_at desc)
  where interrupted = false and duration_seconds >= 600 and distance_km >= 0.5;

-- Retorna um resumo unico e consistente para todo o aplicativo.
-- Dia da atividade = dia local em que ela foi concluida, usando a timezone da conta.
create or replace function public.activity_streak_summary(target_user_id uuid, reference_at timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  user_timezone text := 'America/Sao_Paulo';
  active_days date[] := '{}'::date[];
  reference_day date;
  cursor_day date;
  previous_day date;
  active_day date;
  current_streak integer := 0;
  longest_streak integer := 0;
  running_streak integer := 0;
begin
  select timezone into user_timezone from public.activity_streak_settings where user_id = target_user_id;
  user_timezone := coalesce(nullif(user_timezone, ''), 'America/Sao_Paulo');
  begin
    reference_day := (reference_at at time zone user_timezone)::date;
  exception when invalid_parameter_value then
    user_timezone := 'America/Sao_Paulo';
    reference_day := (reference_at at time zone user_timezone)::date;
  end;

  select coalesce(array_agg(activity_day order by activity_day), '{}'::date[]) into active_days
  from (
    select distinct activity_day
    from (
      -- Treino: concluido pelo motor de treino, com ao menos 10 min e uma serie concluida.
      select (session_item.ended_at at time zone user_timezone)::date as activity_day
      from public.workout_sessions session_item
      where session_item.user_id = target_user_id
        and session_item.status = 'completed'
        and session_item.ended_at is not null
        and session_item.duration_seconds >= 600
        and session_item.completed_sets >= 1

      union

      -- Corrida, caminhada, esteira, bicicleta e outros: duracao, distancia,
      -- horario coerente, sem interrupcao e velocidade humana plausivel.
      select (activity_item.ended_at at time zone user_timezone)::date
      from public.outdoor_activities activity_item
      where activity_item.user_id = target_user_id
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
    ) candidates
  ) active;

  cursor_day := reference_day;
  if not (active_days @> array[cursor_day]) then cursor_day := cursor_day - 1; end if;
  while active_days @> array[cursor_day] loop
    current_streak := current_streak + 1;
    cursor_day := cursor_day - 1;
  end loop;

  previous_day := null;
  foreach active_day in array active_days loop
    if previous_day is not null and active_day = previous_day + 1 then
      running_streak := running_streak + 1;
    else
      running_streak := 1;
    end if;
    longest_streak := greatest(longest_streak, running_streak);
    previous_day := active_day;
  end loop;

  return jsonb_build_object(
    'current_streak', current_streak,
    'longest_streak', longest_streak,
    'active_today', active_days @> array[reference_day],
    'timezone', user_timezone
  );
end;
$$;

revoke all on function public.activity_streak_summary(uuid, timestamptz) from public, anon, authenticated;

-- A leitura direta e sempre da propria conta. O calculo para perfis sociais
-- continua interno, chamado somente pela funcao social que ja valida privacidade.
create or replace function public.my_activity_streak_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  return public.activity_streak_summary(auth.uid());
end;
$$;
revoke all on function public.my_activity_streak_summary() from public, anon;
grant execute on function public.my_activity_streak_summary() to authenticated;

-- Perfil social passa a usar a sequencia central, sem dados de agua/refeicao.
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
  current_streak integer := 0;
  workout_total integer := 0;
  distance_total numeric := 0;
  follower_total integer := 0;
  following_total integer := 0;
  public_stats boolean := false;
  achievement_items jsonb := '[]'::jsonb;
begin
  if viewer_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  select id, full_name, avatar_url into target_profile from public.profiles where id = target_user_id and account_status = 'active';
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
    current_streak := coalesce((public.activity_streak_summary(target_user_id)->>'current_streak')::integer, 0);
    if is_own_profile or coalesce(setting_share_distance, true) then
      select coalesce(sum(distance_km), 0) into distance_total from public.outdoor_activities where user_id = target_user_id;
    end if;
  end if;
  if is_own_profile or coalesce(setting_share_achievements, true) then
    select coalesce(jsonb_agg(item order by (item->>'threshold')::int), '[]'::jsonb) into achievement_items from (
      select jsonb_build_object('id', id, 'title', title, 'threshold', threshold) as item from (values
        ('first-workout', 'Primeiro movimento', 1), ('five-workouts', 'Ritmo encontrado', 5), ('ten-workouts', 'Dez na conta', 10),
        ('twenty-five-workouts', 'Rotina de verdade', 25), ('fifty-workouts', 'Força da constância', 50), ('hundred-workouts', 'Centenário do movimento', 100)
      ) as definitions(id, title, threshold) where threshold <= workout_total
    ) unlocked;
  end if;
  return jsonb_build_object(
    'state', 'available', 'user_id', target_user_id, 'name', coalesce(nullif(trim(target_profile.full_name), ''), 'Membro MOVELYA'),
    'avatar_url', target_profile.avatar_url, 'username', setting_username, 'bio', setting_bio, 'is_own_profile', is_own_profile,
    'following_by_me', follows_target, 'profile_visibility', coalesce(setting_profile_visibility, 'public'), 'activity_visibility', coalesce(setting_activity_visibility, 'public'),
    'followers_count', follower_total, 'following_count', following_total, 'streak', case when public_stats then current_streak else null end,
    'workouts_count', case when public_stats then workout_total else null end,
    'distance_km', case when public_stats and (is_own_profile or coalesce(setting_share_distance, true)) then distance_total else null end,
    'achievements', achievement_items
  );
end;
$$;
