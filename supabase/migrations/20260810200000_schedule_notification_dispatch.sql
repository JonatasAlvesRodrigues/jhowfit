-- Execute these two Vault inserts once in the Supabase SQL Editor, replacing the values:
-- select vault.create_secret('https://PROJECT_REF.supabase.co', 'movelya_project_url');
-- select vault.create_secret('A_LONG_RANDOM_VALUE', 'movelya_notification_cron_secret');
-- The cron secret must match the NOTIFICATION_CRON_SECRET Edge Function secret.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

create or replace function public.configure_movelya_notification_cron(project_url text, cron_secret text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if coalesce(project_url, '') !~ '^https://[a-z0-9-]+\\.supabase\\.co$' or length(coalesce(cron_secret, '')) < 24 then
    raise exception 'Use a URL HTTPS do projeto e um segredo com pelo menos 24 caracteres.';
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'movelya-notification-dispatch';
  perform cron.schedule(
    'movelya-notification-dispatch',
    '* * * * *',
    format($cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-movelya-cron-secret', %L),
        body := jsonb_build_object('source', 'cron', 'time', now())
      );
    $cmd$, project_url || '/functions/v1/notification-dispatch', cron_secret)
  );
end;
$$;

revoke all on function public.configure_movelya_notification_cron(text, text) from public;
