-- A retenção é definida no banco a partir do plano vigente, nunca pelo cliente.
-- A atividade vinculada não é afetada: apenas o post social e suas relações são removidos.

create or replace function public.community_apply_post_retention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  subscription record;
begin
  select * into subscription from public.current_subscription_for(new.user_id);
  if subscription.plan_code = 'FREE' then
    new.is_permanent := false;
    new.expires_at := new.created_at + interval '7 days';
  else
    new.is_permanent := true;
    new.expires_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.community_prevent_post_retention_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_permanent is distinct from old.is_permanent
    or new.expires_at is distinct from old.expires_at then
    raise exception using errcode = '42501', message = 'post_retention_cannot_be_changed';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_apply_retention on public.posts;
create trigger posts_apply_retention before insert on public.posts
  for each row execute function public.community_apply_post_retention();
drop trigger if exists posts_prevent_retention_change on public.posts;
create trigger posts_prevent_retention_change before update on public.posts
  for each row execute function public.community_prevent_post_retention_change();

-- A Edge Function recebe lotes pequenos; somente service_role pode chamar estas RPCs.
create or replace function public.list_expired_community_posts(batch_size integer default 50)
returns table(post_id uuid, storage_path text, thumbnail_path text)
language sql security definer set search_path = public
as $$
  select post_item.id, media.storage_path, media.thumbnail_path
  from public.posts post_item
  left join public.post_media media on media.post_id = post_item.id
  where post_item.is_permanent = false and post_item.expires_at <= now()
  order by post_item.expires_at asc, post_item.id asc
  limit least(greatest(coalesce(batch_size, 50), 1), 100);
$$;

create or replace function public.delete_expired_community_posts(target_post_ids uuid[])
returns integer
language plpgsql security definer set search_path = public
as $$
declare deleted_count integer;
begin
  delete from public.posts
  where id = any(coalesce(target_post_ids, '{}'::uuid[]))
    and is_permanent = false and expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.community_apply_post_retention() from public, anon, authenticated;
revoke all on function public.community_prevent_post_retention_change() from public, anon, authenticated;
revoke all on function public.list_expired_community_posts(integer) from public, anon, authenticated;
revoke all on function public.delete_expired_community_posts(uuid[]) from public, anon, authenticated;
grant execute on function public.list_expired_community_posts(integer) to service_role;
grant execute on function public.delete_expired_community_posts(uuid[]) to service_role;

-- Configure os segredos no Vault e execute esta função uma única vez após o deploy da Edge Function.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;
create or replace function public.configure_movelya_community_expiration_cron()
returns void language plpgsql security definer set search_path = public, extensions
as $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'movelya_project_url')
    or not exists (select 1 from vault.decrypted_secrets where name = 'movelya_community_cleanup_cron_secret') then
    raise exception 'Cadastre movelya_project_url e movelya_community_cleanup_cron_secret no Vault antes de agendar.';
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'movelya-community-expiration-cleanup';
  perform cron.schedule(
    'movelya-community-expiration-cleanup', '17 * * * *',
    $cmd$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'movelya_project_url') || '/functions/v1/cleanup-community-expired-posts',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-movelya-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'movelya_community_cleanup_cron_secret')),
        body := jsonb_build_object('source', 'cron', 'time', now())
      );
    $cmd$
  );
end;
$$;
revoke all on function public.configure_movelya_community_expiration_cron() from public, anon, authenticated;
