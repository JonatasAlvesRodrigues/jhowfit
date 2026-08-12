-- Prévia do cupom no checkout. Não reserva, não incrementa usos e não altera dados.
create or replace function public.preview_subscription_coupon(input_code text, input_plan_code text)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare coupon public.subscription_coupons%rowtype; original_amount integer; discounted integer;
begin
  if auth.uid() is null then raise exception using errcode = '28000', message = 'authentication_required'; end if;
  select price_monthly_cents into original_amount from public.subscription_plans where code = input_plan_code and active and price_monthly_cents > 0;
  if original_amount is null then return jsonb_build_object('valid', false, 'reason', 'plan_invalid'); end if;
  select * into coupon from public.subscription_coupons where code = upper(trim(input_code));
  if not found or not coupon.active or (coupon.starts_at is not null and coupon.starts_at > now()) or (coupon.expires_at is not null and coupon.expires_at <= now())
    or not (input_plan_code = any(coupon.applies_to)) or (coupon.max_redemptions is not null and coupon.redemptions_count >= coupon.max_redemptions) then
    return jsonb_build_object('valid', false, 'reason', 'coupon_invalid');
  end if;
  if coupon.first_purchase_only and exists (select 1 from public.user_subscriptions where user_id = auth.uid() and plan_code <> 'FREE') then
    return jsonb_build_object('valid', false, 'reason', 'coupon_first_purchase_only');
  end if;
  if exists (select 1 from public.subscription_coupon_redemptions where coupon_code = coupon.code and user_id = auth.uid()) then
    return jsonb_build_object('valid', false, 'reason', 'coupon_already_used');
  end if;
  discounted := case when coupon.discount_type = 'percent' then greatest(1, original_amount - floor(original_amount * coupon.discount_value / 100.0)::integer)
    else greatest(1, original_amount - coupon.discount_value) end;
  return jsonb_build_object('valid', true, 'code', coupon.code, 'description', coupon.description, 'original_amount_cents', original_amount, 'discounted_amount_cents', discounted, 'discount_cents', original_amount - discounted);
end;
$$;

grant execute on function public.preview_subscription_coupon(text, text) to authenticated;
