-- Segurança social: bloqueio bilateral de visibilidade e denúncias revisáveis
-- manualmente. Não há moderação automática nesta etapa.

create index if not exists blocked_users_blocked_lookup_idx
  on public.blocked_users (blocked_id, blocker_id);

-- Normaliza relatos já existentes antes de restringir os motivos aceitos.
update public.reports
set reason = case reason
  when 'conteudo_inadequado' then 'inappropriate_content'
  when 'assedio' then 'harassment'
  when 'fora_do_tema' then 'off_topic'
  else coalesce(nullif(trim(reason), ''), 'other')
end;
update public.reports
set reason = 'other'
where reason not in ('spam', 'harassment', 'inappropriate_content', 'off_topic', 'other');

alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check
  check (reason in ('spam', 'harassment', 'inappropriate_content', 'off_topic', 'other'));

create unique index if not exists reports_open_post_once_idx
  on public.reports (reporter_user_id, post_id)
  where target_type = 'post' and status in ('open', 'reviewing');
create unique index if not exists reports_open_comment_once_idx
  on public.reports (reporter_user_id, comment_id)
  where target_type = 'comment' and status in ('open', 'reviewing');
create unique index if not exists reports_open_user_once_idx
  on public.reports (reporter_user_id, target_user_id)
  where target_type = 'user' and status in ('open', 'reviewing');

-- Comentários também precisam respeitar o bloqueio; antes disso apenas o
-- autor da publicação era considerado pela política de leitura.
drop policy if exists "Community members view comments on permitted posts" on public.post_comments;
create policy "Community members view unblocked comments on permitted posts"
  on public.post_comments for select to authenticated
  using (
    user_id = auth.uid()
    or (
      public.can_view_community_post(post_id)
      and not public.are_community_users_blocked(auth.uid(), user_id)
    )
  );

-- A denúncia é limitada a alvos comunitários visíveis e de outra pessoa. O
-- autor e o status continuam definidos no banco, não no cliente.
drop policy if exists "Users create reports as themselves" on public.reports;
create policy "Users create valid community reports as themselves"
  on public.reports for insert to authenticated
  with check (
    reporter_user_id = auth.uid()
    and status = 'open'
    and reviewed_by is null
    and reviewed_at is null
    and reason in ('spam', 'harassment', 'inappropriate_content', 'off_topic', 'other')
    and (
      (target_type = 'post' and exists (
        select 1 from public.posts post_item
        where post_item.id = post_id
          and post_item.user_id <> auth.uid()
          and public.can_view_community_post(post_item.id)
      ))
      or (target_type = 'comment' and exists (
        select 1 from public.post_comments comment_item
        where comment_item.id = comment_id
          and comment_item.user_id <> auth.uid()
          and public.can_view_community_post(comment_item.post_id)
          and not public.are_community_users_blocked(auth.uid(), comment_item.user_id)
      ))
      or (target_type = 'user' and exists (
        select 1 from public.profiles profile
        where profile.id = target_user_id
          and profile.id <> auth.uid()
          and profile.account_status = 'active'
          and not public.are_community_users_blocked(auth.uid(), profile.id)
      ))
    )
  );

-- O contador no feed não revela comentários de pessoas bloqueadas. Curtidas
-- seguem agregadas e anônimas, sem expor a identidade de quem curtiu.
create or replace function public.community_feed_engagement(target_post_ids uuid[])
returns table(post_id uuid, likes_count integer, comments_count integer, liked_by_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select post_item.id,
    (select count(*)::integer from public.post_likes like_item where like_item.post_id = post_item.id),
    (select count(*)::integer from public.post_comments comment_item
      where comment_item.post_id = post_item.id
        and comment_item.status = 'published'
        and not public.are_community_users_blocked(auth.uid(), comment_item.user_id)),
    exists (select 1 from public.post_likes like_item where like_item.post_id = post_item.id and like_item.user_id = auth.uid())
  from public.posts post_item
  where post_item.id = any(coalesce(target_post_ids, '{}'::uuid[]))
    and public.can_view_community_post(post_item.id);
$$;

revoke all on function public.community_feed_engagement(uuid[]) from public, anon;
grant execute on function public.community_feed_engagement(uuid[]) to authenticated;

comment on table public.reports is
  'Fila de denúncias para moderação manual. Status: open, reviewing, resolved ou dismissed.';
