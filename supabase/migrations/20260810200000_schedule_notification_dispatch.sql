-- Before calling configure_movelya_notification_cron(), store the project URL and cron
-- secret in Vault. The cron secret must match the NOTIFICATION_CRON_SECRET Edge Function secret.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

create or replace function public.configure_movelya_notification_cron()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'movelya_project_url') or not exists (select 1 from vault.decrypted_secrets where name = 'movelya_notification_cron_secret') then
    raise exception 'Cadastre movelya_project_url e movelya_notification_cron_secret no Vault antes de agendar.';
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'movelya-notification-dispatch';
  perform cron.schedule(
    'movelya-notification-dispatch',
    '* * * * *',
    $cmd$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'movelya_project_url') || '/functions/v1/notification-dispatch',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-movelya-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'movelya_notification_cron_secret')),
        body := jsonb_build_object('source', 'cron', 'time', now())
      );
    $cmd$
  );
end;
$$;

revoke all on function public.configure_movelya_notification_cron() from public;
