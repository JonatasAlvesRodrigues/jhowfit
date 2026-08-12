create or replace function public.admin_coupon_summary(input_days integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare since_at timestamptz := case when input_days in (30,90) then now() - make_interval(days => input_days) else null end;
begin
  if not public.has_admin_role('admin') then raise exception 'admin_role_required'; end if;
  return jsonb_build_object(
    'active_coupons', (select count(*) from public.subscription_coupons where active and archived_at is null),
    'redemptions_total', (select count(*) from public.subscription_coupon_redemptions redemption join public.mercado_pago_checkout_sessions checkout on checkout.id = redemption.checkout_session_id where checkout.status = 'authorized' and (since_at is null or redemption.created_at >= since_at)),
    'discount_total_cents', coalesce((select sum(checkout.original_amount_cents - checkout.amount_cents) from public.subscription_coupon_redemptions redemption join public.mercado_pago_checkout_sessions checkout on checkout.id = redemption.checkout_session_id where checkout.status = 'authorized' and (since_at is null or redemption.created_at >= since_at)), 0),
    'net_revenue_cents', coalesce((select sum(checkout.amount_cents) from public.subscription_coupon_redemptions redemption join public.mercado_pago_checkout_sessions checkout on checkout.id = redemption.checkout_session_id where checkout.status = 'authorized' and (since_at is null or redemption.created_at >= since_at)), 0)
  );
end;
$$;

create or replace function public.admin_list_coupons(input_days integer default 0)
returns table(code text, description text, discount_type text, discount_value integer, applies_to text[], first_purchase_only boolean, max_redemptions integer, redemptions_count integer, active boolean, archived_at timestamptz, expires_at timestamptz, discount_total_cents bigint, net_revenue_cents bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
declare since_at timestamptz := case when input_days in (30,90) then now() - make_interval(days => input_days) else null end;
begin
  if not public.has_admin_role('admin') then raise exception 'admin_role_required'; end if;
  return query select coupon.code,coupon.description,coupon.discount_type,coupon.discount_value,coupon.applies_to,coupon.first_purchase_only,coupon.max_redemptions,
    (select count(*)::integer from public.subscription_coupon_redemptions redemption join public.mercado_pago_checkout_sessions checkout on checkout.id=redemption.checkout_session_id where redemption.coupon_code=coupon.code and checkout.status='authorized' and (since_at is null or redemption.created_at>=since_at)), coupon.active,coupon.archived_at,coupon.expires_at,
    coalesce((select sum(checkout.original_amount_cents-checkout.amount_cents) from public.subscription_coupon_redemptions redemption join public.mercado_pago_checkout_sessions checkout on checkout.id=redemption.checkout_session_id where redemption.coupon_code=coupon.code and checkout.status='authorized' and (since_at is null or redemption.created_at>=since_at)),0),
    coalesce((select sum(checkout.amount_cents) from public.subscription_coupon_redemptions redemption join public.mercado_pago_checkout_sessions checkout on checkout.id=redemption.checkout_session_id where redemption.coupon_code=coupon.code and checkout.status='authorized' and (since_at is null or redemption.created_at>=since_at)),0),coupon.created_at
  from public.subscription_coupons coupon order by coupon.archived_at nulls first,coupon.created_at desc;
end;
$$;

grant execute on function public.admin_coupon_summary(integer) to authenticated;
grant execute on function public.admin_list_coupons(integer) to authenticated;
