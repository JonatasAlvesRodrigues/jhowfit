-- Recovery data is exposed only to the signed-in subscription owner.
-- The checkout URL is created by Mercado Pago and contains no application secret.
create or replace function public.get_my_payment_recovery()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'checkout_url', session.checkout_url,
    'plan_code', session.plan_code,
    'amount_cents', session.amount_cents,
    'last_payment_status', session.last_payment_status,
    'updated_at', session.updated_at
  )
  from public.mercado_pago_checkout_sessions session
  where session.user_id = auth.uid()
    and session.checkout_url is not null
    and session.last_payment_status in ('rejected', 'failed')
  order by session.updated_at desc
  limit 1;
$$;

revoke all on function public.get_my_payment_recovery() from public;
grant execute on function public.get_my_payment_recovery() to authenticated;

notify pgrst, 'reload schema';
