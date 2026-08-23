-- Desafios: progresso validado a partir das atividades reais, nunca por uma acao de concluir.

alter table public.club_challenges drop constraint if exists club_challenges_metric_check;
alter table public.club_challenges add constraint club_challenges_metric_check check (metric in ('streak', 'workouts', 'distance', 'activities'));

alter table public.club_challenge_participants
  add column if not exists progress_value numeric(12,2) not null default 0,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.club_challenge_achievements (
  challenge_id uuid not null references public.club_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index if not exists club_challenge_achievements_user_idx on public.club_challenge_achievements (user_id, earned_at desc);

create or replace function public.club_sync_challenge_status()
returns trigger language plpgsql set search_path = public as $$
begin
  new.title := trim(regexp_replace(new.title, '[[:space:]]+', ' ', 'g'));
  new.description := trim(new.description);
  new.status := case when new.starts_at > now() then 'upcoming' when new.ends_at <= now() then 'completed' else 'active' end;
  return new;
end;
$$;
drop trigger if exists club_challenges_sync_status on public.club_challenges;
create trigger club_challenges_sync_status before insert or update on public.club_challenges for each row execute function public.club_sync_challenge_status();

alter table public.club_challenge_achievements enable row level security;
drop policy if exists "Members view club challenge achievements" on public.club_challenge_achievements;
create policy "Members view club challenge achievements" on public.club_challenge_achievements for select to authenticated
using (exists (select 1 from public.club_challenges challenge where challenge.id = challenge_id and public.can_view_community_club(challenge.club_id)));
grant select on public.club_challenge_achievements to authenticated;

create or replace function public.join_community_club_challenge(target_challenge_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare viewer_id uuid := auth.uid(); target_club uuid; target_end timestamptz;
begin
  if viewer_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  select club_id, ends_at into target_club, target_end from public.club_challenges where id = target_challenge_id and starts_at <= now();
  if not found then raise exception using errcode = 'P0002', message = 'challenge_not_found_or_not_open'; end if;
  if target_end <= now() then raise exception using errcode = '22023', message = 'challenge_not_open'; end if;
  if not exists (select 1 from public.club_members where club_id = target_club and user_id = viewer_id) then raise exception using errcode = '42501', message = 'club_membership_required'; end if;
  insert into public.club_challenge_participants (challenge_id, user_id) values (target_challenge_id, viewer_id) on conflict do nothing;
  return jsonb_build_object('joined', true);
end;
$$;

-- Atualiza apenas o cache pessoal do participante e devolve os cards que podem ser vistos.
-- A validacao repete os mesmos criterios da sequencia/ranking: treino concluido de 10 min
-- com serie concluida, ou atividade externa plausivel, sem interrupcao.
create or replace function public.community_club_challenge_progress(target_club_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare viewer_id uuid := auth.uid(); viewer_timezone text := 'America/Sao_Paulo'; challenge_item record; progress numeric; achieved boolean; response jsonb;
begin
  if viewer_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  if not exists (select 1 from public.club_members where club_id = target_club_id and user_id = viewer_id) then raise exception using errcode = '42501', message = 'club_membership_required'; end if;
  select timezone into viewer_timezone from public.activity_streak_settings where user_id = viewer_id;
  viewer_timezone := coalesce(nullif(viewer_timezone, ''), 'America/Sao_Paulo');
  begin perform now() at time zone viewer_timezone; exception when invalid_parameter_value then viewer_timezone := 'America/Sao_Paulo'; end;

  for challenge_item in
    select challenge.id, challenge.metric, challenge.target_value, challenge.starts_at, challenge.ends_at
    from public.club_challenges challenge join public.club_challenge_participants participant on participant.challenge_id = challenge.id and participant.user_id = viewer_id
    where challenge.club_id = target_club_id and challenge.starts_at <= now() and challenge.ends_at > now()
  loop
    if challenge_item.metric = 'workouts' then
      select count(*)::numeric into progress from public.workout_sessions session_item
      where session_item.user_id = viewer_id and session_item.status = 'completed' and session_item.ended_at >= challenge_item.starts_at and session_item.ended_at < challenge_item.ends_at
        and session_item.duration_seconds >= 600 and session_item.completed_sets >= 1;
    elsif challenge_item.metric = 'distance' then
      select coalesce(sum(activity_item.distance_km), 0)::numeric into progress from public.outdoor_activities activity_item
      where activity_item.user_id = viewer_id and activity_item.ended_at >= challenge_item.starts_at and activity_item.ended_at < challenge_item.ends_at
        and activity_item.interrupted = false and activity_item.ended_at > activity_item.started_at
        and activity_item.duration_seconds >= case when activity_item.type in ('bike', 'other') then 900 else 600 end
        and activity_item.distance_km >= case when activity_item.type = 'bike' then 2 else 0.5 end
        and activity_item.average_speed_kmh > 0 and activity_item.average_speed_kmh <= case when activity_item.type = 'walk' then 12 when activity_item.type in ('run', 'treadmill') then 30 when activity_item.type = 'bike' then 65 else 35 end;
    elsif challenge_item.metric = 'activities' then
      select count(*)::numeric into progress from (
        select session_item.id from public.workout_sessions session_item where session_item.user_id = viewer_id and session_item.status = 'completed' and session_item.ended_at >= challenge_item.starts_at and session_item.ended_at < challenge_item.ends_at and session_item.duration_seconds >= 600 and session_item.completed_sets >= 1
        union all
        select activity_item.id from public.outdoor_activities activity_item where activity_item.user_id = viewer_id and activity_item.ended_at >= challenge_item.starts_at and activity_item.ended_at < challenge_item.ends_at and activity_item.interrupted = false and activity_item.ended_at > activity_item.started_at and activity_item.duration_seconds >= case when activity_item.type in ('bike', 'other') then 900 else 600 end and activity_item.distance_km >= case when activity_item.type = 'bike' then 2 else 0.5 end and activity_item.average_speed_kmh > 0 and activity_item.average_speed_kmh <= case when activity_item.type = 'walk' then 12 when activity_item.type in ('run', 'treadmill') then 30 when activity_item.type = 'bike' then 65 else 35 end
      ) valid_activity;
    else
      select coalesce(max(streak_size), 0)::numeric into progress from (
        select count(*) as streak_size from (
          select activity_day, activity_day - row_number() over (order by activity_day)::integer as streak_group from (
            select distinct activity_day from (
              select (session_item.ended_at at time zone viewer_timezone)::date as activity_day from public.workout_sessions session_item where session_item.user_id = viewer_id and session_item.status = 'completed' and session_item.ended_at >= challenge_item.starts_at and session_item.ended_at < challenge_item.ends_at and session_item.duration_seconds >= 600 and session_item.completed_sets >= 1
              union
              select (activity_item.ended_at at time zone viewer_timezone)::date from public.outdoor_activities activity_item where activity_item.user_id = viewer_id and activity_item.ended_at >= challenge_item.starts_at and activity_item.ended_at < challenge_item.ends_at and activity_item.interrupted = false and activity_item.ended_at > activity_item.started_at and activity_item.duration_seconds >= case when activity_item.type in ('bike', 'other') then 900 else 600 end and activity_item.distance_km >= case when activity_item.type = 'bike' then 2 else 0.5 end and activity_item.average_speed_kmh > 0 and activity_item.average_speed_kmh <= case when activity_item.type = 'walk' then 12 when activity_item.type in ('run', 'treadmill') then 30 when activity_item.type = 'bike' then 65 else 35 end
            ) valid_days
          ) distinct_days
        ) grouped_days group by streak_group
      ) streaks;
    end if;
    achieved := progress >= challenge_item.target_value;
    update public.club_challenge_participants set progress_value = progress, completed_at = case when achieved then coalesce(completed_at, now()) else null end, updated_at = now() where challenge_id = challenge_item.id and user_id = viewer_id;
    if achieved then insert into public.club_challenge_achievements (challenge_id, user_id) values (challenge_item.id, viewer_id) on conflict do nothing; end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', challenge.id, 'title', challenge.title, 'description', challenge.description, 'metric', challenge.metric, 'target_value', challenge.target_value,
    'starts_at', challenge.starts_at, 'ends_at', challenge.ends_at,
    'status', case when challenge.starts_at > now() then 'upcoming' when challenge.ends_at <= now() then 'completed' else 'active' end,
    'participants_count', (select count(*) from public.club_challenge_participants participant where participant.challenge_id = challenge.id),
    'completed_count', (select count(*) from public.club_challenge_participants participant where participant.challenge_id = challenge.id and participant.completed_at is not null),
    'joined_by_me', exists (select 1 from public.club_challenge_participants participant where participant.challenge_id = challenge.id and participant.user_id = viewer_id),
    'progress_value', coalesce((select participant.progress_value from public.club_challenge_participants participant where participant.challenge_id = challenge.id and participant.user_id = viewer_id), 0),
    'completed_by_me', exists (select 1 from public.club_challenge_participants participant where participant.challenge_id = challenge.id and participant.user_id = viewer_id and participant.completed_at is not null)
  ) order by challenge.starts_at asc), '[]'::jsonb) into response
  from public.club_challenges challenge where challenge.club_id = target_club_id and challenge.ends_at > now() - interval '7 days';
  return response;
end;
$$;

revoke all on function public.community_club_challenge_progress(uuid) from public, anon;
grant execute on function public.community_club_challenge_progress(uuid) to authenticated;
