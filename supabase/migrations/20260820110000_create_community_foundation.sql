-- Fundação da Comunidade: conteúdo exclusivamente de fitness, saúde e esporte.
-- Dados detalhados de treino, alimentação e saúde continuam nas tabelas privadas existentes.

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- outdoor_activities é a estrutura existente para corridas e caminhadas.
  activity_id uuid references public.outdoor_activities(id) on delete set null,
  type text not null,
  caption text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  is_permanent boolean not null default true,
  visibility text not null default 'public',
  status text not null default 'published',
  constraint posts_type_check check (type in ('workout', 'running', 'walking', 'food', 'achievement', 'general_fitness')),
  constraint posts_caption_length_check check (char_length(caption) <= 2200),
  constraint posts_visibility_check check (visibility in ('public', 'followers', 'private')),
  constraint posts_status_check check (status in ('published', 'hidden', 'removed')),
  constraint posts_expiration_check check (
    (is_permanent and expires_at is null)
    or (not is_permanent and expires_at is not null and expires_at > created_at)
  )
);

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  storage_path text not null,
  thumbnail_path text,
  media_type text not null default 'image',
  width integer,
  height integer,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  constraint post_media_type_check check (media_type = 'image'),
  constraint post_media_storage_path_check check (char_length(trim(storage_path)) > 0),
  constraint post_media_dimensions_check check (
    (width is null or width > 0) and (height is null or height > 0)
  ),
  constraint post_media_size_check check (size_bytes is null or size_bytes > 0)
);

create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint post_likes_post_user_key unique (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'published',
  constraint post_comments_content_check check (char_length(trim(content)) between 1 and 1200),
  constraint post_comments_status_check check (status in ('published', 'hidden', 'removed'))
);

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self_follow_check check (follower_id <> following_id)
);

create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocked_users_no_self_block_check check (blocker_id <> blocked_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.post_comments(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reports_target_type_check check (target_type in ('post', 'comment', 'user')),
  constraint reports_reason_check check (char_length(trim(reason)) between 1 and 120),
  constraint reports_details_check check (details is null or char_length(details) <= 2000),
  constraint reports_status_check check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  constraint reports_single_target_check check (
    (target_type = 'post' and post_id is not null and comment_id is null and target_user_id is null)
    or (target_type = 'comment' and post_id is null and comment_id is not null and target_user_id is null)
    or (target_type = 'user' and post_id is null and comment_id is null and target_user_id is not null)
  )
);

-- Índices voltados às consultas previstas; a unicidade de post_likes já atende likes por post.
create index if not exists posts_public_feed_created_idx
  on public.posts (created_at desc, id desc)
  where status = 'published' and visibility = 'public';
create index if not exists posts_user_created_idx
  on public.posts (user_id, created_at desc, id desc);
create index if not exists posts_expiring_idx
  on public.posts (expires_at)
  where is_permanent = false;
create index if not exists post_comments_post_created_idx
  on public.post_comments (post_id, created_at asc, id asc);
create index if not exists follows_following_created_idx
  on public.follows (following_id, created_at desc, follower_id);
create index if not exists reports_status_created_idx
  on public.reports (status, created_at asc)
  where status in ('open', 'reviewing');

-- Centraliza a regra de bloqueio para que uma relação em qualquer direção oculte conteúdo social.
create or replace function public.are_community_users_blocked(first_user_id uuid, second_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select first_user_id is null
    or second_user_id is null
    or exists (
      select 1
      from public.blocked_users block
      where (block.blocker_id = first_user_id and block.blocked_id = second_user_id)
         or (block.blocker_id = second_user_id and block.blocked_id = first_user_id)
    );
$$;

-- A função é SECURITY DEFINER para não depender das políticas das tabelas consultadas.
-- Ela expõe apenas um booleano e mantém a regra de visibilidade consistente em posts, mídia,
-- curtidas e comentários.
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
            post_item.visibility = 'public'
            or (
              post_item.visibility = 'followers'
              and exists (
                select 1 from public.follows follow_item
                where follow_item.follower_id = auth.uid()
                  and follow_item.following_id = post_item.user_id
              )
            )
          )
        )
      )
  );
$$;

create or replace function public.community_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.community_prevent_post_owner_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception using errcode = '42501', message = 'post_owner_cannot_be_changed';
  end if;
  return new;
end;
$$;

create or replace function public.community_prevent_media_reparenting()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.post_id is distinct from old.post_id then
    raise exception using errcode = '42501', message = 'post_media_post_cannot_be_changed';
  end if;
  return new;
end;
$$;

create or replace function public.community_prevent_comment_reparenting()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.post_id is distinct from old.post_id or new.user_id is distinct from old.user_id then
    raise exception using errcode = '42501', message = 'comment_owner_or_post_cannot_be_changed';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.community_set_updated_at();
drop trigger if exists posts_prevent_owner_change on public.posts;
create trigger posts_prevent_owner_change
  before update on public.posts
  for each row execute function public.community_prevent_post_owner_change();

drop trigger if exists post_comments_set_updated_at on public.post_comments;
create trigger post_comments_set_updated_at
  before update on public.post_comments
  for each row execute function public.community_set_updated_at();
drop trigger if exists post_comments_prevent_reparenting on public.post_comments;
create trigger post_comments_prevent_reparenting
  before update on public.post_comments
  for each row execute function public.community_prevent_comment_reparenting();

drop trigger if exists post_media_prevent_reparenting on public.post_media;
create trigger post_media_prevent_reparenting
  before update on public.post_media
  for each row execute function public.community_prevent_media_reparenting();

alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.follows enable row level security;
alter table public.blocked_users enable row level security;
alter table public.reports enable row level security;

create policy "Community members view permitted posts"
  on public.posts for select to authenticated
  using (public.can_view_community_post(id));
create policy "Post authors create their posts"
  on public.posts for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      activity_id is null
      or exists (
        select 1 from public.outdoor_activities activity
        where activity.id = activity_id and activity.user_id = auth.uid()
      )
    )
  );
create policy "Post authors update their posts"
  on public.posts for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      activity_id is null
      or exists (
        select 1 from public.outdoor_activities activity
        where activity.id = activity_id and activity.user_id = auth.uid()
      )
    )
  );
create policy "Post authors delete their posts"
  on public.posts for delete to authenticated
  using (user_id = auth.uid());
create policy "Moderators manage community posts"
  on public.posts for all to authenticated
  using (public.has_admin_role('moderator'))
  with check (public.has_admin_role('moderator'));

create policy "Community members view permitted post media"
  on public.post_media for select to authenticated
  using (public.can_view_community_post(post_id));
create policy "Post authors attach their own media"
  on public.post_media for insert to authenticated
  with check (
    storage_path like (auth.uid()::text || '/%')
    and (thumbnail_path is null or thumbnail_path like (auth.uid()::text || '/%'))
    and exists (
      select 1 from public.posts post_item
      where post_item.id = post_id and post_item.user_id = auth.uid()
    )
  );
create policy "Post authors update their media"
  on public.post_media for update to authenticated
  using (
    exists (
      select 1 from public.posts post_item
      where post_item.id = post_id and post_item.user_id = auth.uid()
    )
  )
  with check (
    storage_path like (auth.uid()::text || '/%')
    and (thumbnail_path is null or thumbnail_path like (auth.uid()::text || '/%'))
  );
create policy "Post authors delete their media"
  on public.post_media for delete to authenticated
  using (
    exists (
      select 1 from public.posts post_item
      where post_item.id = post_id and post_item.user_id = auth.uid()
    )
  );
create policy "Moderators manage community media"
  on public.post_media for all to authenticated
  using (public.has_admin_role('moderator'))
  with check (public.has_admin_role('moderator'));

create policy "Community members view likes on permitted posts"
  on public.post_likes for select to authenticated
  using (public.can_view_community_post(post_id));
create policy "Users create their own likes"
  on public.post_likes for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_community_post(post_id));
create policy "Users remove their own likes"
  on public.post_likes for delete to authenticated
  using (user_id = auth.uid());

create policy "Community members view comments on permitted posts"
  on public.post_comments for select to authenticated
  using (user_id = auth.uid() or public.can_view_community_post(post_id));
create policy "Users comment on permitted posts"
  on public.post_comments for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_community_post(post_id));
create policy "Comment authors update their comments"
  on public.post_comments for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "Comment authors delete their comments"
  on public.post_comments for delete to authenticated
  using (user_id = auth.uid());
create policy "Moderators manage community comments"
  on public.post_comments for all to authenticated
  using (public.has_admin_role('moderator'))
  with check (public.has_admin_role('moderator'));

create policy "Users view their follow relationships"
  on public.follows for select to authenticated
  using (follower_id = auth.uid() or following_id = auth.uid());
create policy "Users follow other unblocked users"
  on public.follows for insert to authenticated
  with check (
    follower_id = auth.uid()
    and follower_id <> following_id
    and not public.are_community_users_blocked(follower_id, following_id)
  );
create policy "Users unfollow from their own account"
  on public.follows for delete to authenticated
  using (follower_id = auth.uid());

create policy "Users view their own blocks"
  on public.blocked_users for select to authenticated
  using (blocker_id = auth.uid());
create policy "Users block from their own account"
  on public.blocked_users for insert to authenticated
  with check (blocker_id = auth.uid() and blocker_id <> blocked_id);
create policy "Users remove their own blocks"
  on public.blocked_users for delete to authenticated
  using (blocker_id = auth.uid());

create policy "Users view their own reports"
  on public.reports for select to authenticated
  using (reporter_user_id = auth.uid());
create policy "Users create reports as themselves"
  on public.reports for insert to authenticated
  with check (reporter_user_id = auth.uid() and status = 'open' and reviewed_by is null and reviewed_at is null);
create policy "Moderators review community reports"
  on public.reports for select to authenticated
  using (public.has_admin_role('moderator'));
create policy "Moderators update community reports"
  on public.reports for update to authenticated
  using (public.has_admin_role('moderator'))
  with check (public.has_admin_role('moderator'));

-- Perfil social mínimo: não abre os campos de saúde do profiles para a comunidade.
create or replace view public.community_profiles
with (security_barrier = true)
as
select profile.id, profile.full_name, profile.avatar_url
from public.profiles profile
where profile.account_status = 'active'
  and (
    profile.id = auth.uid()
    or not public.are_community_users_blocked(auth.uid(), profile.id)
  );

grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, update, delete on public.post_media to authenticated;
grant select, insert, delete on public.post_likes to authenticated;
grant select, insert, update, delete on public.post_comments to authenticated;
grant select, insert, delete on public.follows to authenticated;
grant select, insert, delete on public.blocked_users to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select on public.community_profiles to authenticated;
revoke all on function public.are_community_users_blocked(uuid, uuid) from public, anon;
revoke all on function public.can_view_community_post(uuid) from public, anon;
grant execute on function public.are_community_users_blocked(uuid, uuid) to authenticated;
grant execute on function public.can_view_community_post(uuid) to authenticated;

-- Bucket privado: somente imagens; o SELECT depende da visibilidade da publicação.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-media',
  'community-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload their own community images" on storage.objects;
create policy "Users upload their own community images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'heic', 'heif')
  );
drop policy if exists "Community members read permitted community images" on storage.objects;
create policy "Community members read permitted community images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'community-media'
    and exists (
      select 1 from public.post_media media
      where (media.storage_path = name or media.thumbnail_path = name)
        and public.can_view_community_post(media.post_id)
    )
  );
drop policy if exists "Users update their own community images" on storage.objects;
create policy "Users update their own community images"
  on storage.objects for update to authenticated
  using (bucket_id = 'community-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'community-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users delete their own community images" on storage.objects;
create policy "Users delete their own community images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'community-media' and (storage.foldername(name))[1] = auth.uid()::text);
