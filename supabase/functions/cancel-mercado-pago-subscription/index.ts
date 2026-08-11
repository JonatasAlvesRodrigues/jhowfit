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
    const sessionResponse = await fetch(`${supabaseUrl}/rest/v1/mercado_pago_checkout_sessions?user_id=eq.${encodeURIComponent(user.id)}&status=eq.authorized&select=id,provider_preapproval_id&order=updated_at.desc&limit=1`, { headers: headers(serviceKey) })
    const sessions = await sessionResponse.json().catch(() => []) as Array<{ id: string; provider_preapproval_id: string }>
    if (!sessionResponse.ok || !sessions[0]?.provider_preapproval_id) return json({ error: 'Não encontramos uma assinatura ativa do Mercado Pago.' }, 404)
    const providerId = sessions[0].provider_preapproval_id
    const providerResponse = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(providerId)}`, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) })
    const provider = await providerResponse.json().catch(() => ({})) as Record<string, unknown>
    if (!providerResponse.ok) return json({ error: 'O Mercado Pago não confirmou o cancelamento.' }, 502)
    const end = new Date(); const start = new Date(end.getTime()); start.setMonth(start.getMonth() - 1)
    await fetch(`${supabaseUrl}/rest/v1/rpc/apply_mercado_pago_subscription_event`, { method: 'POST', headers: headers(serviceKey), body: JSON.stringify({ input_session_id: sessions[0].id, input_provider_subscription_id: providerId, input_status: String(provider.status || 'cancelled'), input_period_start: start.toISOString(), input_period_end: end.toISOString(), input_metadata: { cancelled_by: 'customer' } }) })
    return json({ cancelled: true })
  } catch (error) { console.error('cancel Mercado Pago subscription failed', error); return json({ error: 'Não foi possível cancelar agora.' }, 500) }
})
