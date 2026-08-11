-- Planos, assinaturas e consumo de IA. Os créditos são deliberadamente internos:
-- o cliente recebe apenas cotas de recursos e o estado da assinatura.
create table if not exists public.subscription_plans (
  code text primary key check (code in ('FREE', 'PRO', 'PRO_PLUS')),
  name text not null,
  description text not null,
  price_monthly_cents integer not null check (price_monthly_cents >= 0),
  monthly_ai_credits integer not null check (monthly_ai_credits >= 0),
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_credit_costs (
  action_type text primary key,
  credits integer not null check (credits > 0),
  description text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_action_limits (
  plan_code text not null references public.subscription_plans(code) on update cascade,
  action_type text not null references public.ai_credit_costs(action_type) on update cascade,
  monthly_limit integer not null check (monthly_limit >= 0),
  primary key (plan_code, action_type)
);

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null references public.subscription_plans(code),
  status text not null default 'active' check (status in ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  provider text check (provider is null or provider in ('stripe', 'mercado_pago', 'google_play', 'apple')),
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end > current_period_start)
);

create unique index if not exists user_subscriptions_one_current_idx
  on public.user_subscriptions(user_id)
  where status in ('trialing', 'active', 'past_due');
create unique index if not exists user_subscriptions_provider_ref_idx
  on public.user_subscriptions(provider, provider_subscription_id)
  where provider_subscription_id is not null;
create index if not exists user_subscriptions_user_date_idx on public.user_subscriptions(user_id, created_at desc);

create table if not exists public.payment_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.user_subscriptions(id) on delete set null,
  provider text not null check (provider in ('stripe', 'mercado_pago', 'google_play', 'apple')),
  provider_payment_id text not null,
  status text not null check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BRL' check (char_length(currency) = 3),
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);
create index if not exists payment_history_user_date_idx on public.payment_history(user_id, created_at desc);

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.user_subscriptions(id) on delete set null,
  action_type text not null references public.ai_credit_costs(action_type),
  credits_used integer not null check (credits_used > 0),
  model_used text not null check (char_length(model_used) between 1 and 120),
  status text not null default 'reserved' check (status in ('reserved', 'completed', 'released')),
  request_id uuid not null default gen_random_uuid(),
  period_start timestamptz not null,
  period_end timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, request_id),
  check (period_end > period_start)
);
create index if not exists ai_usage_user_period_idx on public.ai_usage(user_id, period_start, status);
create index if not exists ai_usage_user_action_idx on public.ai_usage(user_id, action_type, created_at desc);

insert into public.subscription_plans(code, name, description, price_monthly_cents, monthly_ai_credits, features) values
  ('FREE', 'Free', 'Para conhecer o MOVELYA e criar uma rotina saudável.', 0, 50,
   '["Controle de água, peso e medidas", "Registros de alimentação e exercícios", "Metas e relatórios essenciais", "Experiência inicial com IA"]'),
  ('PRO', 'Pro', 'Personalização inteligente para evoluir com consistência.', 1990, 500,
   '["Tudo do Free", "Chat IA avançado", "Treinos e alimentação personalizados", "Análise de refeições por foto", "Relatórios e recomendações inteligentes"]'),
  ('PRO_PLUS', 'Pro Plus', 'Mais análises, prioridade e espaço para uma rotina intensa.', 3490, 1500,
   '["Tudo do Pro", "Maior volume de uso inteligente", "Respostas prioritárias", "Relatórios mais completos", "Acesso a futuros recursos exclusivos"]')
on conflict (code) do update set name = excluded.name, description = excluded.description,
  price_monthly_cents = excluded.price_monthly_cents, monthly_ai_credits = excluded.monthly_ai_credits,
  features = excluded.features, updated_at = now();

insert into public.ai_credit_costs(action_type, credits, description) values
  ('chat_message', 1, 'Mensagem simples no assistente'),
  ('workout_adjustment', 3, 'Ajuste pontual de treino'),
  ('workout_generation', 10, 'Geração completa de treino'),
  ('food_photo_analysis', 5, 'Análise de refeição por imagem'),
  ('diet_generation', 15, 'Geração completa de sugestão alimentar'),
  ('smart_report', 10, 'Relatório inteligente'),
  ('full_replanning', 8, 'Replanejamento completo')
on conflict (action_type) do update set credits = excluded.credits, description = excluded.description, updated_at = now();

insert into public.plan_action_limits(plan_code, action_type, monthly_limit) values
  ('FREE','chat_message',50), ('FREE','workout_adjustment',0), ('FREE','workout_generation',3),
  ('FREE','food_photo_analysis',5), ('FREE','diet_generation',1), ('FREE','smart_report',1), ('FREE','full_replanning',0),
  ('PRO','chat_message',500), ('PRO','workout_adjustment',50), ('PRO','workout_generation',10),
  ('PRO','food_photo_analysis',50), ('PRO','diet_generation',5), ('PRO','smart_report',4), ('PRO','full_replanning',10),
  ('PRO_PLUS','chat_message',1500), ('PRO_PLUS','workout_adjustment',150), ('PRO_PLUS','workout_generation',30),
  ('PRO_PLUS','food_photo_analysis',150), ('PRO_PLUS','diet_generation',15), ('PRO_PLUS','smart_report',5), ('PRO_PLUS','full_replanning',30)
on conflict (plan_code, action_type) do update set monthly_limit = excluded.monthly_limit;

alter table public.subscription_plans enable row level security;
alter table public.ai_credit_costs enable row level security;
alter table public.plan_action_limits enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.payment_history enable row level security;
alter table public.ai_usage enable row level security;

drop policy if exists "Users read own subscriptions" on public.user_subscriptions;
create policy "Users read own subscriptions" on public.user_subscriptions for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users read own payments" on public.payment_history;
create policy "Users read own payments" on public.payment_history for select to authenticated using (user_id = auth.uid());
-- O histórico bruto contém a unidade interna de custo e não é exposto ao cliente.
revoke all on public.ai_usage from anon, authenticated;

-- Resolve o plano vigente sem confiar em informação enviada pelo cliente.
create or replace function public.current_subscription_for(target_user uuid)
returns table(subscription_id uuid, plan_code text, period_start timestamptz, period_end timestamptz)
language plpgsql security definer set search_path = public
as $$
declare selected_subscription public.user_subscriptions%rowtype;
begin
  select s.* into selected_subscription from public.user_subscriptions s
  where s.user_id = target_user and s.status in ('trialing','active') and s.current_period_end > now()
  order by case when s.plan_code = 'PRO_PLUS' then 3 when s.plan_code = 'PRO' then 2 else 1 end desc, s.created_at desc limit 1;
  if found then
    return query select selected_subscription.id, selected_subscription.plan_code,
      selected_subscription.current_period_start, selected_subscription.current_period_end;
  else
    return query select null::uuid, 'FREE'::text, date_trunc('month', now()), date_trunc('month', now()) + interval '1 month';
  end if;
end;
$$;
revoke all on function public.current_subscription_for(uuid) from public, anon, authenticated;

create or replace function public.reserve_ai_usage(
  requested_action text,
  requested_model text,
  request_metadata jsonb default '{}'::jsonb,
  requested_id uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  current_user uuid := auth.uid(); subscription record; plan_record record;
  action_cost integer; action_limit integer; credits_consumed bigint; action_count bigint; usage_id uuid;
begin
  if current_user is null then raise exception using errcode = '28000', message = 'authentication_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(current_user::text, 0));
  update public.ai_usage set status = 'released', completed_at = now(),
    metadata = metadata || '{"release_reason":"reservation_timeout"}'::jsonb
  where user_id = current_user and status = 'reserved' and created_at < now() - interval '15 minutes';
  select * into subscription from public.current_subscription_for(current_user);
  select monthly_ai_credits into plan_record from public.subscription_plans where code = subscription.plan_code and active;
  select credits into action_cost from public.ai_credit_costs where action_type = requested_action and active;
  select monthly_limit into action_limit from public.plan_action_limits where plan_code = subscription.plan_code and action_type = requested_action;
  if action_cost is null or action_limit is null then raise exception using errcode = '22023', message = 'ai_action_not_available'; end if;
  if action_limit = 0 then raise exception using errcode = 'P0001', message = 'plan_upgrade_required'; end if;
  select coalesce(sum(credits_used), 0), count(*) filter (where action_type = requested_action)
    into credits_consumed, action_count from public.ai_usage
    where user_id = current_user and period_start = subscription.period_start and status in ('reserved','completed');
  if action_count >= action_limit then raise exception using errcode = 'P0001', message = 'monthly_action_limit_reached'; end if;
  if credits_consumed + action_cost > plan_record.monthly_ai_credits then raise exception using errcode = 'P0001', message = 'monthly_ai_limit_reached'; end if;
  insert into public.ai_usage(user_id, subscription_id, action_type, credits_used, model_used, request_id, period_start, period_end, metadata)
  values (current_user, subscription.subscription_id, requested_action, action_cost, left(trim(requested_model),120), requested_id,
    subscription.period_start, subscription.period_end, coalesce(request_metadata, '{}'::jsonb))
  returning id into usage_id;
  return jsonb_build_object('usage_id', usage_id, 'request_id', requested_id);
exception when unique_violation then
  select id into usage_id from public.ai_usage where user_id = current_user and request_id = requested_id;
  return jsonb_build_object('usage_id', usage_id, 'request_id', requested_id, 'duplicate', true);
end;
$$;

create or replace function public.finalize_ai_usage(target_usage_id uuid, succeeded boolean, result_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception using errcode = '28000', message = 'authentication_required'; end if;
  update public.ai_usage set status = case when succeeded then 'completed' else 'released' end,
    completed_at = now(),
    model_used = case when nullif(trim(result_metadata ->> 'model_used'), '') is not null
      then left(trim(result_metadata ->> 'model_used'), 120) else model_used end,
    metadata = metadata || (coalesce(result_metadata, '{}'::jsonb) - 'model_used')
  where id = target_usage_id and user_id = auth.uid() and status = 'reserved';
end;
$$;

create or replace function public.get_my_plan_overview()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare current_user uuid := auth.uid(); subscription record; result jsonb;
begin
  if current_user is null then raise exception using errcode = '28000', message = 'authentication_required'; end if;
  select * into subscription from public.current_subscription_for(current_user);
  select jsonb_build_object(
    'code', p.code, 'name', p.name, 'description', p.description, 'price_monthly_cents', p.price_monthly_cents,
    'features', p.features, 'renews_at', subscription.period_end,
    'subscription_status', case when subscription.subscription_id is null then 'active' else (select status from public.user_subscriptions where id = subscription.subscription_id) end,
    'cancel_at_period_end', coalesce((select cancel_at_period_end from public.user_subscriptions where id = subscription.subscription_id), false),
    'quotas', coalesce((select jsonb_agg(jsonb_build_object(
      'action_type', limits.action_type, 'monthly_limit', limits.monthly_limit,
      'used', (select count(*) from public.ai_usage usage where usage.user_id = current_user
        and usage.period_start = subscription.period_start and usage.action_type = limits.action_type and usage.status in ('reserved','completed'))
    ) order by limits.action_type) from public.plan_action_limits limits where limits.plan_code = p.code and limits.monthly_limit > 0), '[]'::jsonb)
  ) into result from public.subscription_plans p where p.code = subscription.plan_code;
  return result;
end;
$$;

grant execute on function public.reserve_ai_usage(text, text, jsonb, uuid) to authenticated;
grant execute on function public.finalize_ai_usage(uuid, boolean, jsonb) to authenticated;
grant execute on function public.get_my_plan_overview() to authenticated;

-- Catálogo público seguro: omite a unidade interna de custos.
create or replace function public.list_available_plans()
returns table(code text, name text, description text, price_monthly_cents integer, features jsonb)
language sql stable security definer set search_path = public
as $$ select p.code, p.name, p.description, p.price_monthly_cents, p.features from public.subscription_plans p where p.active order by p.price_monthly_cents $$;
grant execute on function public.list_available_plans() to authenticated;
