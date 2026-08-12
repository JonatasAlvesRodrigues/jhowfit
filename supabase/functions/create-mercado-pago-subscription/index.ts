const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const headers = (key: string) => ({ apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const accessToken = Deno.env.get('MP_ACCESS_TOKEN')
    const webhookToken = Deno.env.get('MP_WEBHOOK_TOKEN')
    const appUrl = Deno.env.get('APP_URL')
    const authorization = request.headers.get('Authorization')
    if (!supabaseUrl || !anonKey || !serviceKey || !accessToken || !webhookToken || !appUrl) return json({ error: 'O checkout ainda não foi configurado.' }, 503)
    if (!authorization) return json({ error: 'Sessão não encontrada.' }, 401)

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } })
    if (!userResponse.ok) return json({ error: 'Sessão inválida ou expirada.' }, 401)
    const user = await userResponse.json() as { id: string; email?: string }
    if (!user.email) return json({ error: 'Sua conta precisa ter um e-mail para assinar.' }, 422)

    const input = await request.json().catch(() => ({})) as { planCode?: unknown; couponCode?: unknown }
    const planCode = String(input.planCode || '').trim().toUpperCase()
    if (!['PRO', 'PRO_PLUS'].includes(planCode)) return json({ error: 'Escolha um plano pago válido.' }, 422)

    const planResponse = await fetch(`${supabaseUrl}/rest/v1/subscription_plans?code=eq.${encodeURIComponent(planCode)}&active=eq.true&select=code,name,price_monthly_cents`, { headers: headers(serviceKey) })
    const plans = await planResponse.json().catch(() => []) as Array<{ code: string; name: string; price_monthly_cents: number }>
    const plan = plans[0]
    if (!planResponse.ok || !plan || plan.price_monthly_cents <= 0) return json({ error: 'Este plano não está disponível agora.' }, 422)

    const existingResponse = await fetch(`${supabaseUrl}/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&status=in.(trialing,active,past_due)&select=plan_code`, { headers: headers(serviceKey) })
    const existing = await existingResponse.json().catch(() => []) as Array<{ plan_code: string }>
    if (existing.length) return json({ error: 'Você já possui uma assinatura ativa. Cancele-a antes de contratar outro plano.' }, 409)

    const sessionResponse = await fetch(`${supabaseUrl}/rest/v1/mercado_pago_checkout_sessions`, {
      method: 'POST', headers: { ...headers(serviceKey), Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: user.id, plan_code: plan.code, amount_cents: plan.price_monthly_cents, original_amount_cents: plan.price_monthly_cents, status: 'created', payer_email: user.email }),
    })
    const sessions = await sessionResponse.json().catch(() => []) as Array<{ id: string }>
    const session = sessions[0]
    if (!sessionResponse.ok || !session) return json({ error: 'Não foi possível preparar o checkout.' }, 502)

    const couponCode = String(input.couponCode || '').trim().toUpperCase()
    let amountCents = plan.price_monthly_cents
    if (couponCode) {
      const couponResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/reserve_subscription_coupon`, {
        method: 'POST', headers: headers(serviceKey), body: JSON.stringify({ input_code: couponCode, input_user_id: user.id, input_plan_code: plan.code, input_session_id: session.id, input_original_amount_cents: plan.price_monthly_cents }),
      })
      const couponAmount = await couponResponse.json().catch(() => null)
      if (!couponResponse.ok || typeof couponAmount !== 'number') {
        await fetch(`${supabaseUrl}/rest/v1/mercado_pago_checkout_sessions?id=eq.${encodeURIComponent(session.id)}`, { method: 'PATCH', headers: headers(serviceKey), body: JSON.stringify({ status: 'failed' }) })
        return json({ error: 'Cupom inválido, expirado ou já utilizado nesta conta.' }, 422)
      }
      amountCents = couponAmount
    }

    const baseUrl = appUrl.replace(/\/$/, '')
    const webhookUrl = `${supabaseUrl}/functions/v1/mercado-pago-webhook?token=${encodeURIComponent(webhookToken)}`
    const mercadoPagoResponse = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: `MOVELYA ${plan.name}`,
        external_reference: session.id,
        payer_email: user.email,
        back_url: `${baseUrl}/#/checkout-confirmado?session_id=${encodeURIComponent(session.id)}`,
        notification_url: webhookUrl,
        auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: amountCents / 100, currency_id: 'BRL' },
        status: 'pending',
      }),
    })
    const mercadoPago = await mercadoPagoResponse.json().catch(() => ({})) as { id?: string; init_point?: string; sandbox_init_point?: string; status?: string }
    if (!mercadoPagoResponse.ok || !mercadoPago.id || !mercadoPago.init_point) {
      await fetch(`${supabaseUrl}/rest/v1/mercado_pago_checkout_sessions?id=eq.${encodeURIComponent(session.id)}`, { method: 'PATCH', headers: headers(serviceKey), body: JSON.stringify({ status: 'failed', metadata: { mercado_pago_error: mercadoPago } }) })
      return json({ error: 'O Mercado Pago não conseguiu iniciar a assinatura.' }, 502)
    }

    const checkoutUrl = accessToken.startsWith('TEST-') ? (mercadoPago.sandbox_init_point || mercadoPago.init_point) : mercadoPago.init_point
    await fetch(`${supabaseUrl}/rest/v1/mercado_pago_checkout_sessions?id=eq.${encodeURIComponent(session.id)}`, {
      method: 'PATCH', headers: headers(serviceKey), body: JSON.stringify({ provider_preapproval_id: mercadoPago.id, checkout_url: checkoutUrl, status: mercadoPago.status || 'pending' }),
    })
    return json({ checkoutUrl, sessionId: session.id })
  } catch (error) {
    console.error('create Mercado Pago subscription failed', error)
    return json({ error: 'Não foi possível iniciar o checkout agora.' }, 500)
  }
})
