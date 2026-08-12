create or replace function public.admin_cancellation_reason_report(input_days integer default 90)
returns table(plan_code text, reason text, cancellations bigint, percentage numeric)
language plpgsql stable security definer set search_path = public
as $$
declare since_at timestamptz := case when input_days in (30,90,180,365) then now() - make_interval(days=>input_days) else null end;
begin
  if not public.has_admin_role('admin') then raise exception 'admin_role_required'; end if;
  return query
  with events as (
    select checkout.plan_code, coalesce(nullif(checkout.metadata->>'cancellation_reason',''),'not_informed') as reason
    from public.mercado_pago_checkout_sessions checkout
    where checkout.status='cancelled' and (since_at is null or checkout.updated_at>=since_at)
  ), totals as (select events.plan_code,count(*) as total from events group by events.plan_code)
  select events.plan_code,events.reason,count(*)::bigint,
    round(count(*)::numeric*100/nullif(totals.total,0),1)
  from events join totals on totals.plan_code=events.plan_code
  group by events.plan_code,events.reason,totals.total
  order by events.plan_code,count(*) desc,events.reason;
end;
$$;
grant execute on function public.admin_cancellation_reason_report(integer) to authenticated;
