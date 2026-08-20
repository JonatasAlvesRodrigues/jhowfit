-- A primeira versão da Comunidade aceita uma única imagem otimizada por publicação.
create unique index if not exists post_media_one_image_per_post_idx
  on public.post_media (post_id);

alter table public.post_media
  drop constraint if exists post_media_size_check,
  add constraint post_media_size_check check (size_bytes between 1 and 1258291);

-- O limite do bucket é a proteção do servidor: o cliente pode comprimir melhor,
-- mas não consegue armazenar um original grande caso essa etapa seja burlada.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-media',
  'community-media',
  false,
  1258291,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Post authors attach their own media" on public.post_media;
create policy "Post authors attach their own media"
  on public.post_media for insert to authenticated
  with check (
    storage_path like ('posts/' || auth.uid()::text || '/%')
    and (thumbnail_path is null or thumbnail_path like ('posts/' || auth.uid()::text || '/%'))
    and exists (
      select 1 from public.posts post_item
      where post_item.id = post_id and post_item.user_id = auth.uid()
    )
  );

drop policy if exists "Post authors update their media" on public.post_media;
create policy "Post authors update their media"
  on public.post_media for update to authenticated
  using (
    exists (
      select 1 from public.posts post_item
      where post_item.id = post_id and post_item.user_id = auth.uid()
    )
  )
  with check (
    storage_path like ('posts/' || auth.uid()::text || '/%')
    and (thumbnail_path is null or thumbnail_path like ('posts/' || auth.uid()::text || '/%'))
  );

drop policy if exists "Users upload their own community images" on storage.objects;
create policy "Users upload their own community images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = 'posts'
    and (storage.foldername(name))[2] = auth.uid()::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );

drop policy if exists "Users update their own community images" on storage.objects;
create policy "Users update their own community images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = 'posts'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = 'posts'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Users delete their own community images" on storage.objects;
create policy "Users delete their own community images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = 'posts'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
