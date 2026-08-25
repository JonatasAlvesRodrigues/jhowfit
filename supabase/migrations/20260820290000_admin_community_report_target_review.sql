-- Detalhe do conteúdo denunciado, exclusivo da moderação manual.
create or replace function public.admin_get_community_report_target(input_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_admin_role('moderator') then raise exception 'admin_role_required'; end if;

  select jsonb_build_object(
    'target_type', report_item.target_type,
    'author_name', coalesce(case report_item.target_type
      when 'post' then post_author.full_name
      when 'comment' then comment_author.full_name
      when 'user' then target_profile.full_name
    end, 'Membro MOVELYA'),
    'caption', case when report_item.target_type in ('post','comment') then post_item.caption else null end,
    'post_type', case when report_item.target_type in ('post','comment') then post_item.type else null end,
    'comment_content', case when report_item.target_type = 'comment' then comment_item.content else null end,
    'created_at', case when report_item.target_type = 'post' then post_item.created_at when report_item.target_type = 'comment' then comment_item.created_at else null end,
    'media_path', media.storage_path
  ) into result
  from public.reports report_item
  left join public.post_comments comment_item on comment_item.id = report_item.comment_id
  left join public.posts post_item on post_item.id = coalesce(report_item.post_id, comment_item.post_id)
  left join lateral (select storage_path from public.post_media where post_id = coalesce(report_item.post_id, comment_item.post_id) order by created_at asc limit 1) media on true
  left join public.profiles post_author on post_author.id = post_item.user_id
  left join public.profiles comment_author on comment_author.id = comment_item.user_id
  left join public.profiles target_profile on target_profile.id = report_item.target_user_id
  where report_item.id = input_report_id;

  if result is null then raise exception 'report_not_found'; end if;
  return result;
end;
$$;

-- Moderadores podem abrir a mídia somente durante a análise, mesmo se a
-- publicação deixou de estar visível para o feed normal.
drop policy if exists "Community members read permitted community images" on storage.objects;
create policy "Community members read permitted community images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'community-media'
    and (
      public.has_admin_role('moderator')
      or exists (
        select 1 from public.post_media media
        where (media.storage_path = name or media.thumbnail_path = name)
          and public.can_view_community_post(media.post_id)
      )
    )
  );

revoke all on function public.admin_get_community_report_target(uuid) from public, anon;
grant execute on function public.admin_get_community_report_target(uuid) to authenticated;
