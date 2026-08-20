-- Engajamento social: conteúdo normalizado no servidor, limite básico contra spam
-- e contadores agregados para que o feed não carregue interações card a card.

create or replace function public.community_normalize_comment_content()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.content := regexp_replace(trim(regexp_replace(new.content, '<[^>]*>', '', 'g')), '[[:cntrl:]]+', ' ', 'g');
  new.content := regexp_replace(new.content, '\s+', ' ', 'g');
  return new;
end;
$$;

create or replace function public.community_limit_comment_spam()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.post_comments comment_item
    where comment_item.post_id = new.post_id
      and comment_item.user_id = new.user_id
      and comment_item.content = new.content
      and comment_item.created_at > now() - interval '60 seconds'
  ) then
    raise exception using errcode = 'P0001', message = 'duplicate_comment_wait';
  end if;

  if (select count(*) from public.post_comments comment_item where comment_item.user_id = new.user_id and comment_item.created_at > now() - interval '1 minute') >= 5 then
    raise exception using errcode = 'P0001', message = 'comment_rate_limit_reached';
  end if;
  return new;
end;
$$;

drop trigger if exists post_comments_a_normalize_content on public.post_comments;
create trigger post_comments_a_normalize_content
  before insert or update of content on public.post_comments
  for each row execute function public.community_normalize_comment_content();
drop trigger if exists post_comments_b_limit_spam on public.post_comments;
create trigger post_comments_b_limit_spam
  before insert on public.post_comments
  for each row execute function public.community_limit_comment_spam();

create or replace function public.community_feed_engagement(target_post_ids uuid[])
returns table(post_id uuid, likes_count integer, comments_count integer, liked_by_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select post_item.id,
    (select count(*)::integer from public.post_likes like_item where like_item.post_id = post_item.id),
    (select count(*)::integer from public.post_comments comment_item where comment_item.post_id = post_item.id and comment_item.status = 'published'),
    exists (select 1 from public.post_likes like_item where like_item.post_id = post_item.id and like_item.user_id = auth.uid())
  from public.posts post_item
  where post_item.id = any(coalesce(target_post_ids, '{}'::uuid[]))
    and public.can_view_community_post(post_item.id);
$$;

revoke all on function public.community_feed_engagement(uuid[]) from public, anon;
grant execute on function public.community_feed_engagement(uuid[]) to authenticated;
