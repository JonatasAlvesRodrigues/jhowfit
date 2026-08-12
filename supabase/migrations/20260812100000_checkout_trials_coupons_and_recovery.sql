-- Checkout: cupons, período de teste e leitura segura do estado da compra.
create table if not exists public.subscription_coupons (
  code text primary key check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,32}$'),
  description text not null,
  discount_type text not null check (discount_type in ('percent', 'fixed_cents')),
  discount_value integer not null check (discount_value > 0),
  applies_to text[] not null default array['PRO','PRO_PLUS']::text[] check (applies_to <@ array['PRO','PRO_PLUS']::text[]),
  first_purchase_only boolean not null default true,
  max_redemptions integer,
  redemptions_count integer not null default 0 check (redemptions_count >= 0),
  active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (max_redemptions is null or max_redemptions > 0),
  check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create table if not exists public.subscription_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_code text not null references public.subscription_coupons(code),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkout_session_id uuid not null references public.mercado_pago_checkout_sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (coupon_code, user_id)
);

alter table public.mercado_pago_checkout_sessions
  add column if not exists original_amount_cents integer,
  add column if not exists coupon_code text references public.subscription_coupons(code),
  add column if not exists trial_ends_at timestamptz,
  add column if not exists recovery_attempts integer not null default 0,
  add column if not exists last_payment_status text;

update public.mercado_pago_checkout_sessions
set original_amount_cents = amount_cents
where original_amount_cents is null;

alter table public.mercado_pago_checkout_sessions
  alter column original_amount_cents set not null;

alter table public.subscription_coupons enable row level security;
alter table public.subscription_coupon_redemptions enable row level security;

insert into public.subscription_coupons(code, description, discount_type, discount_value, first_purchase_only)
values ('BEMVINDO10', '10% de desconto no primeiro ciclo', 'percent', 10, true)
on conflict (code) do nothing;

-- Esta função só é usada pela Edge Function com service role.
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
  insert into public.subscription_coupon_redemptions(coupon_code, user_id, checkout_session_id) values (coupon.code, input_user_id, input_session_id);
  update public.subscription_coupons set redemptions_count = redemptions_count + 1 where code = coupon.code;
  update public.mercado_pago_checkout_sessions set coupon_code = coupon.code, amount_cents = discounted, updated_at = now() where id = input_session_id;
  return discounted;
end;
$$;

create or replace function public.get_my_mercado_pago_checkout(input_session_id uuid)
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('id', item.id, 'plan_code', item.plan_code, 'status', item.status,
    'amount_cents', item.amount_cents, 'original_amount_cents', item.original_amount_cents,
    'coupon_code', item.coupon_code, 'trial_ends_at', item.trial_ends_at, 'last_payment_status', item.last_payment_status,
    'created_at', item.created_at)
  from public.mercado_pago_checkout_sessions item where item.id = input_session_id and item.user_id = auth.uid()
$$;

revoke all on function public.reserve_subscription_coupon(text, uuid, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_subscription_coupon(text, uuid, text, uuid, integer) to service_role;
grant execute on function public.get_my_mercado_pago_checkout(uuid) to authenticated;
