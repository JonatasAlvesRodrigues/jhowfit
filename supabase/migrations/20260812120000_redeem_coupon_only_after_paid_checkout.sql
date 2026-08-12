-- Um cupom não pode ser consumido só porque a pessoa abriu o checkout.
-- A partir desta alteração, tentativas pendentes/abandonadas continuam livres para uso.

create or replace function public.reserve_subscription_coupon(input_code text, input_user_id uuid, input_plan_code text, input_session_id uuid, input_original_amount_cents integer)
returns integer language plpgsql security definer set search_path = public
as $$
declare coupon public.subscription_coupons%rowtype; discounted integer;
begin
  if auth.role() <> 'service_role' then raise exception using errcode = '42501', message = 'service_role_required'; end if;
  select * into coupon from public.subscription_coupons where code = upper(trim(input_code)) for update;
  if not found or not coupon.active or (coupon.starts_at is not null and coupon.starts_at > now()) or (coupon.expires_at is not null and coupon.expires_at <= now())
    or not (input_plan_code = any(coupon.applies_to)) or (coupon.max_redemptions is not null and coupon.redemptions_count >= coupon.max_redemptions) then
    raise exception using errcode = '22023', message = 'coupon_invalid';
  end if;
  if coupon.first_purchase_only and exists (select 1 from public.user_subscriptions where user_id = input_user_id and plan_code <> 'FREE') then
    raise exception using errcode = '22023', message = 'coupon_first_purchase_only';
  end if;
  if exists (select 1 from public.subscription_coupon_redemptions where coupon_code = coupon.code and user_id = input_user_id) then
    raise exception using errcode = '22023', message = 'coupon_already_used';
  end if;
  discounted := case when coupon.discount_type = 'percent' then greatest(1, input_original_amount_cents - floor(input_original_amount_cents * coupon.discount_value / 100.0)::integer)
    else greatest(1, input_original_amount_cents - coupon.discount_value) end;
  update public.mercado_pago_checkout_sessions set coupon_code = coupon.code, amount_cents = discounted, updated_at = now() where id = input_session_id;
  return discounted;
end;
$$;

create or replace function public.apply_mercado_pago_subscription_event(
  input_session_id uuid, input_provider_subscription_id text, input_status text, input_period_start timestamptz, input_period_end timestamptz,
  input_payer_email text default null, input_payment_id text default null, input_payment_status text default null,
  input_amount_cents integer default null, input_paid_at timestamptz default null, input_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public
as $$
declare checkout public.mercado_pago_checkout_sessions%rowtype; subscription_id uuid; normalized_status text := lower(trim(input_status)); payment_status text; redemption_inserted integer;
begin
  if auth.role() <> 'service_role' then raise exception using errcode = '42501', message = 'service_role_required'; end if;
  if input_provider_subscription_id is null or length(trim(input_provider_subscription_id)) = 0 then raise exception using errcode = '22023', message = 'provider_subscription_id_required'; end if;
  select * into checkout from public.mercado_pago_checkout_sessions where id = input_session_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'checkout_session_not_found'; end if;
  update public.mercado_pago_checkout_sessions set provider_preapproval_id = trim(input_provider_subscription_id), status = case when normalized_status in ('authorized','paused','cancelled','failed') then normalized_status else 'pending' end, payer_email = coalesce(nullif(trim(input_payer_email), ''), payer_email), metadata = metadata || coalesce(input_metadata, '{}'::jsonb), updated_at = now() where id = checkout.id;
  if normalized_status = 'authorized' then
    update public.user_subscriptions set status = 'expired', ended_at = now(), updated_at = now() where user_id = checkout.user_id and status in ('trialing','active','past_due') and not (provider = 'mercado_pago' and provider_subscription_id = trim(input_provider_subscription_id));
    select id into subscription_id from public.user_subscriptions where provider = 'mercado_pago' and provider_subscription_id = trim(input_provider_subscription_id) limit 1 for update;
    if subscription_id is null then insert into public.user_subscriptions(user_id,plan_code,status,provider,provider_customer_id,provider_subscription_id,current_period_start,current_period_end) values (checkout.user_id,checkout.plan_code,'active','mercado_pago',nullif(trim(input_payer_email),''),trim(input_provider_subscription_id),input_period_start,input_period_end) returning id into subscription_id;
    else update public.user_subscriptions set plan_code=checkout.plan_code,status='active',provider_customer_id=coalesce(nullif(trim(input_payer_email),''),provider_customer_id),current_period_start=input_period_start,current_period_end=input_period_end,cancel_at_period_end=false,cancelled_at=null,ended_at=null,updated_at=now() where id=subscription_id; end if;
    if checkout.coupon_code is not null then
      insert into public.subscription_coupon_redemptions(coupon_code,user_id,checkout_session_id) values (checkout.coupon_code,checkout.user_id,checkout.id) on conflict (coupon_code,user_id) do nothing;
      get diagnostics redemption_inserted = row_count;
      if redemption_inserted > 0 then update public.subscription_coupons set redemptions_count = redemptions_count + 1 where code = checkout.coupon_code; end if;
    end if;
  else
    select id into subscription_id from public.user_subscriptions where provider='mercado_pago' and provider_subscription_id=trim(input_provider_subscription_id) limit 1 for update;
    if subscription_id is not null then update public.user_subscriptions set status=case when normalized_status='cancelled' then 'cancelled' when normalized_status='paused' then 'past_due' else status end,cancel_at_period_end=normalized_status='cancelled',cancelled_at=case when normalized_status='cancelled' then coalesce(cancelled_at,now()) else cancelled_at end,ended_at=case when normalized_status='cancelled' then now() else ended_at end,updated_at=now() where id=subscription_id; end if;
  end if;
  if input_payment_id is not null and length(trim(input_payment_id)) > 0 then
    payment_status := case lower(coalesce(input_payment_status,'')) when 'approved' then 'paid' when 'authorized' then 'paid' when 'cancelled' then 'cancelled' when 'rejected' then 'failed' when 'failed' then 'failed' when 'refunded' then 'refunded' else 'pending' end;
    insert into public.payment_history(user_id,subscription_id,provider,provider_payment_id,status,amount_cents,currency,paid_at,metadata) values (checkout.user_id,subscription_id,'mercado_pago',trim(input_payment_id),payment_status,coalesce(input_amount_cents,checkout.amount_cents),'BRL',case when payment_status='paid' then coalesce(input_paid_at,now()) else null end,coalesce(input_metadata,'{}'::jsonb)) on conflict (provider,provider_payment_id) do update set status=excluded.status,subscription_id=coalesce(excluded.subscription_id,payment_history.subscription_id),paid_at=coalesce(excluded.paid_at,payment_history.paid_at),metadata=payment_history.metadata || excluded.metadata;
  end if;
  return subscription_id;
end;
$$;
