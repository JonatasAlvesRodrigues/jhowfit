alter table public.subscription_coupons add column if not exists archived_at timestamptz;

create or replace function public.admin_coupon_summary()
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'active_coupons', (select count(*) from public.subscription_coupons where active and archived_at is null),
    'redemptions_total', (select count(*) from public.subscription_coupon_redemptions),
    'discount_total_cents', coalesce((select sum(checkout.original_amount_cents - checkout.amount_cents) from public.subscription_coupon_redemptions redemption join public.mercado_pago_checkout_sessions checkout on checkout.id = redemption.checkout_session_id), 0),
    'net_revenue_cents', coalesce((select sum(checkout.amount_cents) from public.subscription_coupon_redemptions redemption join public.mercado_pago_checkout_sessions checkout on checkout.id = redemption.checkout_session_id), 0)
  ) where public.has_admin_role('admin');
$$;

create or replace function public.admin_list_coupons()
returns table(code text, description text, discount_type text, discount_value integer, applies_to text[], first_purchase_only boolean, max_redemptions integer, redemptions_count integer, active boolean, archived_at timestamptz, expires_at timestamptz, discount_total_cents bigint, net_revenue_cents bigint, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select coupon.code, coupon.description, coupon.discount_type, coupon.discount_value, coupon.applies_to, coupon.first_purchase_only, coupon.max_redemptions, coupon.redemptions_count, coupon.active, coupon.archived_at, coupon.expires_at,
    coalesce((select sum(checkout.original_amount_cents - checkout.amount_cents) from public.subscription_coupon_redemptions redemption join public.mercado_pago_checkout_sessions checkout on checkout.id = redemption.checkout_session_id where redemption.coupon_code = coupon.code), 0),
    coalesce((select sum(checkout.amount_cents) from public.subscription_coupon_redemptions redemption join public.mercado_pago_checkout_sessions checkout on checkout.id = redemption.checkout_session_id where redemption.coupon_code = coupon.code), 0), coupon.created_at
  from public.subscription_coupons coupon where public.has_admin_role('admin') order by coupon.archived_at nulls first, coupon.created_at desc;
$$;

create or replace function public.admin_create_coupon(input_code text, input_description text, input_discount_type text, input_discount_value integer, input_applies_to text[] default array['PRO','PRO_PLUS']::text[], input_max_redemptions integer default null, input_expires_at timestamptz default null)
returns void language plpgsql security definer set search_path = public
as $$
declare normalized_code text := upper(trim(input_code));
begin
  if not public.has_admin_role('admin') then raise exception 'admin_role_required'; end if;
  if normalized_code !~ '^[A-Z0-9_-]{3,32}$' or length(trim(input_description)) < 3 then raise exception 'invalid_coupon_input'; end if;
  if input_discount_type not in ('percent','fixed_cents') or input_discount_value < 1 or (input_discount_type = 'percent' and input_discount_value > 100) then raise exception 'invalid_coupon_discount'; end if;
  if input_applies_to is null or not (input_applies_to <@ array['PRO','PRO_PLUS']::text[]) then raise exception 'invalid_coupon_plans'; end if;
  if input_max_redemptions is not null and input_max_redemptions < 1 then raise exception 'invalid_coupon_limit'; end if;
  insert into public.subscription_coupons(code,description,discount_type,discount_value,applies_to,max_redemptions,expires_at,active,archived_at)
  values(normalized_code,trim(input_description),input_discount_type,input_discount_value,input_applies_to,input_max_redemptions,input_expires_at,true,null)
  on conflict (code) do update set description=excluded.description,discount_type=excluded.discount_type,discount_value=excluded.discount_value,applies_to=excluded.applies_to,max_redemptions=excluded.max_redemptions,expires_at=excluded.expires_at,active=true,archived_at=null;
  insert into public.admin_audit_logs(actor_user_id,action,metadata) values(auth.uid(),'coupon_created_or_updated',jsonb_build_object('code',normalized_code));
end;
$$;

create or replace function public.admin_set_coupon_status(input_code text, input_action text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_admin_role('admin') then raise exception 'admin_role_required'; end if;
  if input_action not in ('activate','pause','archive') then raise exception 'invalid_coupon_action'; end if;
  update public.subscription_coupons set active = input_action = 'activate', archived_at = case when input_action = 'archive' then now() when input_action = 'activate' then null else archived_at end where code = upper(trim(input_code));
  if not found then raise exception 'coupon_not_found'; end if;
  insert into public.admin_audit_logs(actor_user_id,action,metadata) values(auth.uid(),'coupon_status_changed',jsonb_build_object('code',upper(trim(input_code)),'action',input_action));
end;
$$;

grant execute on function public.admin_coupon_summary() to authenticated;
grant execute on function public.admin_list_coupons() to authenticated;
grant execute on function public.admin_create_coupon(text,text,text,integer,text[],integer,timestamptz) to authenticated;
grant execute on function public.admin_set_coupon_status(text,text) to authenticated;
