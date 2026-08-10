# Push notifications

The app stores each browser subscription in `push_subscriptions`. The `notification-dispatch` Edge Function runs every minute, checks the user's quiet period, pause, selected days, scheduled time, minimum interval, and daily cap, then writes the delivery log and in-app notification only after a push is accepted.

## One-time Supabase setup

1. Generate a VAPID key pair (for example, `npx web-push generate-vapid-keys`).
2. Add the public key to the site deployment as `VITE_VAPID_PUBLIC_KEY` and redeploy the front end.
3. Deploy the function: `supabase functions deploy notification-dispatch --no-verify-jwt`.
4. Set these Edge Function secrets. Never place private values in `.env.local` or Git:

   `supabase secrets set VAPID_SUBJECT="mailto:suporte@movelya.app" VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." NOTIFICATION_CRON_SECRET="a-random-secret-with-at-least-24-characters"`

5. Run migrations, then in the SQL Editor run:

   `select public.configure_movelya_notification_cron('https://PROJECT_REF.supabase.co', 'the-same-NOTIFICATION_CRON_SECRET');`

The job can be inspected in `cron.job` and its executions in `cron.job_run_details`.
