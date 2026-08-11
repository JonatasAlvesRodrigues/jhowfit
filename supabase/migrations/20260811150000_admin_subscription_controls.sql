-- Controles administrativos de assinatura. Nenhuma operação de faturamento
-- fica exposta ao cliente; todas verificam explicitamente o papel admin.
create or replace function public.admin_subscription_summary()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_admin_role('admin') then raise exception 'admin_role_required'; end if;
  select jsonb_build_object(
    'active_total', (select count(*) from public.user_subscriptions where status in ('trialing','active') and current_period_end > now()),
    'monthly_revenue_cents', coalesce((select sum(plan.price_monthly_cents)
      from public.user_subscriptions subscription
      join public.subscription_plans plan on plan.code = subscription.plan_code
      where subscription.status in ('trialing','active') and subscription.current_period_end > now()), 0),
    'cancelled_30d', (select count(*) from public.user_subscriptions where cancelled_at >= now() - interval '30 days'),
    'pending_payments', (select count(*) from public.payment_history where status = 'pending'),
    'plans', coalesce((select jsonb_agg(jsonb_build_object(
      'code', plan.code, 'name', plan.name, 'price_monthly_cents', plan.price_monthly_cents,
      'active_subscriptions', (select count(*) from public.user_subscriptions subscription
        where subscription.plan_code = plan.code and subscription.status in ('trialing','active') and subscription.current_period_end > now())
    ) order by plan.price_monthly_cents) from public.subscription_plans plan where plan.active), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.admin_list_subscriptions()
returns table (
  user_id uuid, full_name text, plan_code text, subscription_status text,
  current_period_end timestamptz, cancel_at_period_end boolean, provider text
) language sql stable security definer set search_path = public
as $$
  select profile.id, profile.full_name,
    coalesce(subscription.plan_code, 'FREE'), coalesce(subscription.status, 'active'),
    coalesce(subscription.current_period_end, date_trunc('month', now()) + interval '1 month'),
    coalesce(subscription.cancel_at_period_end, false), subscription.provider
  from public.profiles profile
  left join lateral (
    select item.plan_code, item.status, item.current_period_end, item.cancel_at_period_end, item.provider
    from public.user_subscriptions item
    where item.user_id = profile.id and item.status in ('trialing','active') and item.current_period_end > now()
    order by item.created_at desc limit 1
  ) subscription on true
  where public.has_admin_role('admin')
  order by profile.updated_at desc nulls last
  limit 200;
$$;

create or replace function public.admin_update_subscription_plan(
  input_plan_code text, input_price_cents integer, input_features jsonb default null
) returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_admin_role('admin') then raise exception 'admin_role_required'; end if;
  if input_plan_code not in ('FREE','PRO','PRO_PLUS') or input_price_cents < 0 then raise exception 'invalid_plan_input'; end if;
  if input_plan_code = 'FREE' and input_price_cents <> 0 then raise exception 'free_plan_must_be_zero'; end if;
  update public.subscription_plans
  set price_monthly_cents = input_price_cents,
      features = coalesce(input_features, features),
      updated_at = now()
  where code = input_plan_code;
  if not found then raise exception 'plan_not_found'; end if;
  insert into public.admin_audit_logs(actor_user_id, action, metadata)
  values (auth.uid(), 'subscription_plan_updated', jsonb_build_object('plan_code', input_plan_code, 'price_monthly_cents', input_price_cents));
end;
$$;

create or replace function public.admin_update_plan_action_limit(
  input_plan_code text, input_action_type text, input_monthly_limit integer
) returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_admin_role('admin') then raise exception 'admin_role_required'; end if;
  if input_monthly_limit < 0 or input_monthly_limit > 100000 then raise exception 'invalid_monthly_limit'; end if;
  update public.plan_action_limits set monthly_limit = input_monthly_limit
  where plan_code = input_plan_code and action_type = input_action_type;
  if not found then raise exception 'plan_limit_not_found'; end if;
  insert into public.admin_audit_logs(actor_user_id, action, metadata)
  values (auth.uid(), 'subscription_limit_updated', jsonb_build_object('plan_code', input_plan_code, 'action_type', input_action_type, 'monthly_limit', input_monthly_limit));
end;
$$;

create or replace function public.admin_list_plan_limits()
returns table(plan_code text, action_type text, monthly_limit integer)
language sql stable security definer set search_path = public
as $$
  select item.plan_code, item.action_type, item.monthly_limit
  from public.plan_action_limits item
  where public.has_admin_role('admin')
  order by item.plan_code, item.action_type;
$$;

create or replace function public.admin_assign_subscription(
  target_user_id uuid, input_plan_code text, input_period_days integer default 30
) returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_admin_role('admin') then raise exception 'admin_role_required'; end if;
  if target_user_id is null or not exists (select 1 from public.profiles where id = target_user_id) then raise exception 'user_not_found'; end if;
  if input_plan_code not in ('FREE','PRO','PRO_PLUS') then raise exception 'invalid_plan_input'; end if;
  if input_period_days < 1 or input_period_days > 366 then raise exception 'invalid_period'; end if;
  update public.user_subscriptions set status = 'expired', ended_at = now(), updated_at = now()
  where user_id = target_user_id and status in ('trialing','active','past_due');
  if input_plan_code <> 'FREE' then
    insert into public.user_subscriptions(user_id, plan_code, status, current_period_start, current_period_end)
    values (target_user_id, input_plan_code, 'active', now(), now() + make_interval(days => input_period_days));
  end if;
  insert into public.admin_audit_logs(actor_user_id, action, target_user_id, metadata)
  values (auth.uid(), 'subscription_assigned', target_user_id, jsonb_build_object('plan_code', input_plan_code, 'period_days', input_period_days));
end;
$$;

grant execute on function public.admin_subscription_summary() to authenticated;
grant execute on function public.admin_list_subscriptions() to authenticated;
grant execute on function public.admin_update_subscription_plan(text, integer, jsonb) to authenticated;
grant execute on function public.admin_update_plan_action_limit(text, text, integer) to authenticated;
grant execute on function public.admin_list_plan_limits() to authenticated;
grant execute on function public.admin_assign_subscription(uuid, text, integer) to authenticated;
