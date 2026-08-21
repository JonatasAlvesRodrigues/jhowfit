-- Completa o perfil da Comunidade sem reutilizar dados de saude.
alter table public.community_profile_settings
  add column if not exists avatar_source text not null default 'initials',
  add column if not exists avatar_key text;

alter table public.community_profile_settings
  drop constraint if exists community_profile_settings_avatar_source_check;
alter table public.community_profile_settings
  add constraint community_profile_settings_avatar_source_check
  check (avatar_source in ('initials', 'custom', 'system'));

alter table public.community_profile_settings
  drop constraint if exists community_profile_settings_avatar_key_check;
alter table public.community_profile_settings
  add constraint community_profile_settings_avatar_key_check
  check (
    (avatar_source = 'custom' and avatar_key is not null)
    or (avatar_source in ('initials', 'system') and avatar_key is null)
  );

-- Avatares de perfil sao uma escolha social explicita. O nome usa UUID no
-- cliente e nao expoe dados de saude nem caminhos previsiveis.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-profile-avatars', 'community-profile-avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload their own community profile avatar" on storage.objects;
create policy "Users upload their own community profile avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );
drop policy if exists "Users update their own community profile avatar" on storage.objects;
create policy "Users update their own community profile avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'community-profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'community-profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users delete their own community profile avatar" on storage.objects;
create policy "Users delete their own community profile avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'community-profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Busca apenas por @. Retorna somente a identidade social minima, nunca dados
-- corporais, alimentacao, medidas ou historico de saude.
create or replace function public.community_search_profiles(search_term text)
returns table (user_id uuid, full_name text, username text, avatar_url text, is_private boolean)
language sql
stable
security definer
set search_path = public
as $$
  select profile.id, coalesce(nullif(trim(profile.full_name), ''), 'Membro MOVELYA'), setting.username, profile.avatar_url,
    coalesce(setting.profile_visibility, 'public') = 'private'
  from public.community_profile_settings setting
  join public.profiles profile on profile.id = setting.user_id and profile.account_status = 'active'
  where auth.uid() is not null
    and not public.are_community_users_blocked(auth.uid(), profile.id)
    and setting.username is not null
    and setting.username like lower(regexp_replace(trim(search_term), '^@', '')) || '%'
  order by case when setting.username = lower(regexp_replace(trim(search_term), '^@', '')) then 0 else 1 end, setting.username
  limit 12;
$$;

grant execute on function public.community_search_profiles(text) to authenticated;
revoke all on function public.community_search_profiles(text) from public, anon;
