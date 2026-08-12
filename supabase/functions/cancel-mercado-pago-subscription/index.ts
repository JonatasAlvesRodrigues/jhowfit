const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const headers = (key: string) => ({ apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL'), anonKey = Deno.env.get('SUPABASE_ANON_KEY'), serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), accessToken = Deno.env.get('MP_ACCESS_TOKEN')
    const authorization = request.headers.get('Authorization')
    if (!supabaseUrl || !anonKey || !serviceKey || !accessToken) return json({ error: 'O cancelamento ainda não foi configurado.' }, 503)
    if (!authorization) return json({ error: 'Sessão não encontrada.' }, 401)
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } })
    if (!userResponse.ok) return json({ error: 'Sessão inválida ou expirada.' }, 401)
    const user = await userResponse.json() as { id: string }
    const input = await request.json().catch(() => ({})) as { reason?: unknown }
    const reason = String(input.reason || 'not_informed').slice(0, 80)
    const sessionResponse = await fetch(`${supabaseUrl}/rest/v1/mercado_pago_checkout_sessions?user_id=eq.${encodeURIComponent(user.id)}&status=eq.authorized&select=id,provider_preapproval_id&order=updated_at.desc&limit=1`, { headers: headers(serviceKey) })
    const sessions = await sessionResponse.json().catch(() => []) as Array<{ id: string; provider_preapproval_id: string }>
    if (!sessionResponse.ok || !sessions[0]?.provider_preapproval_id) return json({ error: 'Não encontramos uma assinatura ativa do Mercado Pago.' }, 404)
    const providerId = sessions[0].provider_preapproval_id
    const providerResponse = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(providerId)}`, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) })
    const provider = await providerResponse.json().catch(() => ({})) as Record<string, unknown>
    if (!providerResponse.ok) return json({ error: 'O Mercado Pago não confirmou o cancelamento.' }, 502)
    await fetch(`${supabaseUrl}/rest/v1/mercado_pago_checkout_sessions?id=eq.${encodeURIComponent(sessions[0].id)}`, { method: 'PATCH', headers: headers(serviceKey), body: JSON.stringify({ status: 'cancelled', metadata: { cancellation_reason: reason, cancelled_by: 'customer' } }) })
    await fetch(`${supabaseUrl}/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&provider=eq.mercado_pago&provider_subscription_id=eq.${encodeURIComponent(providerId)}&status=eq.active`, { method: 'PATCH', headers: headers(serviceKey), body: JSON.stringify({ cancel_at_period_end: true, cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }) })
    return json({ cancelled: true })
  } catch (error) { console.error('cancel Mercado Pago subscription failed', error); return json({ error: 'Não foi possível cancelar agora.' }, 500) }
})
