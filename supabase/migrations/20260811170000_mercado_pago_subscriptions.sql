-- Sessões de checkout do Mercado Pago. Nenhum valor é aceito do navegador:
-- o preço é copiado do plano ativo no momento em que a sessão é criada.
create table if not exists public.mercado_pago_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null references public.subscription_plans(code),
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'created' check (status in ('created', 'pending', 'authorized', 'paused', 'cancelled', 'failed')),
  provider_preapproval_id text unique,
  checkout_url text,
  payer_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mercado_pago_checkout_sessions_user_idx
  on public.mercado_pago_checkout_sessions(user_id, created_at desc);

alter table public.mercado_pago_checkout_sessions enable row level security;

-- Esta rotina só pode ser chamada com a service role pela Edge Function do webhook.
-- Ela mantém a assinatura e o histórico idempotentes mesmo se o Mercado Pago reenviar uma notificação.
create or replace function public.apply_mercado_pago_subscription_event(
  input_session_id uuid,
  input_provider_subscription_id text,
  input_status text,
  input_period_start timestamptz,
  input_period_end timestamptz,
  input_payer_email text default null,
  input_payment_id text default null,
  input_payment_status text default null,
  input_amount_cents integer default null,
  input_paid_at timestamptz default null,
  input_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  checkout public.mercado_pago_checkout_sessions%rowtype;
  subscription_id uuid;
  normalized_status text := lower(trim(input_status));
  payment_status text;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if input_provider_subscription_id is null or length(trim(input_provider_subscription_id)) = 0 then
    raise exception using errcode = '22023', message = 'provider_subscription_id_required';
  end if;

  select * into checkout from public.mercado_pago_checkout_sessions where id = input_session_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'checkout_session_not_found'; end if;

  update public.mercado_pago_checkout_sessions
  set provider_preapproval_id = trim(input_provider_subscription_id), status = case
        when normalized_status in ('authorized', 'paused', 'cancelled', 'failed') then normalized_status else 'pending' end,
      payer_email = coalesce(nullif(trim(input_payer_email), ''), payer_email),
      metadata = metadata || coalesce(input_metadata, '{}'::jsonb), updated_at = now()
  where id = checkout.id;

  if normalized_status = 'authorized' then
    -- Não deixa uma assinatura anterior continuar valendo ao ativar a nova.
    update public.user_subscriptions set status = 'expired', ended_at = now(), updated_at = now()
    where user_id = checkout.user_id and status in ('trialing', 'active', 'past_due')
      and not (provider = 'mercado_pago' and provider_subscription_id = trim(input_provider_subscription_id));

    select id into subscription_id from public.user_subscriptions
    where provider = 'mercado_pago' and provider_subscription_id = trim(input_provider_subscription_id)
    limit 1 for update;

    if subscription_id is null then
      insert into public.user_subscriptions(user_id, plan_code, status, provider, provider_customer_id, provider_subscription_id, current_period_start, current_period_end)
      values (checkout.user_id, checkout.plan_code, 'active', 'mercado_pago', nullif(trim(input_payer_email), ''), trim(input_provider_subscription_id), input_period_start, input_period_end)
      returning id into subscription_id;
    else
      update public.user_subscriptions set plan_code = checkout.plan_code, status = 'active', provider_customer_id = coalesce(nullif(trim(input_payer_email), ''), provider_customer_id),
        current_period_start = input_period_start, current_period_end = input_period_end, cancel_at_period_end = false, cancelled_at = null, ended_at = null, updated_at = now()
      where id = subscription_id;
    end if;
  else
    select id into subscription_id from public.user_subscriptions
    where provider = 'mercado_pago' and provider_subscription_id = trim(input_provider_subscription_id)
    limit 1 for update;
    if subscription_id is not null then
      update public.user_subscriptions set
        status = case when normalized_status = 'cancelled' then 'cancelled' when normalized_status = 'paused' then 'past_due' else status end,
        cancel_at_period_end = normalized_status = 'cancelled',
        cancelled_at = case when normalized_status = 'cancelled' then coalesce(cancelled_at, now()) else cancelled_at end,
        ended_at = case when normalized_status = 'cancelled' then now() else ended_at end,
        updated_at = now()
      where id = subscription_id;
    end if;
  end if;

  if input_payment_id is not null and length(trim(input_payment_id)) > 0 then
    payment_status := case lower(coalesce(input_payment_status, ''))
      when 'approved' then 'paid' when 'authorized' then 'paid' when 'cancelled' then 'cancelled'
      when 'rejected' then 'failed' when 'failed' then 'failed' when 'refunded' then 'refunded' else 'pending' end;
    insert into public.payment_history(user_id, subscription_id, provider, provider_payment_id, status, amount_cents, currency, paid_at, metadata)
    values (checkout.user_id, subscription_id, 'mercado_pago', trim(input_payment_id), payment_status,
      coalesce(input_amount_cents, checkout.amount_cents), 'BRL', case when payment_status = 'paid' then coalesce(input_paid_at, now()) else null end,
      coalesce(input_metadata, '{}'::jsonb))
    on conflict (provider, provider_payment_id) do update set status = excluded.status, subscription_id = coalesce(excluded.subscription_id, payment_history.subscription_id),
      paid_at = coalesce(excluded.paid_at, payment_history.paid_at), metadata = payment_history.metadata || excluded.metadata;
  end if;

  return subscription_id;
end;
$$;

revoke all on function public.apply_mercado_pago_subscription_event(uuid, text, text, timestamptz, timestamptz, text, text, text, integer, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.apply_mercado_pago_subscription_event(uuid, text, text, timestamptz, timestamptz, text, text, text, integer, timestamptz, jsonb) to service_role;
