const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const serviceHeaders = (key: string) => ({ apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' })

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const accessToken = Deno.env.get('MP_ACCESS_TOKEN')
  const webhookToken = Deno.env.get('MP_WEBHOOK_TOKEN')
  const signatureKey = Deno.env.get('MP_WEBHOOK_SECRET')
  if (!supabaseUrl || !serviceKey || !accessToken || !webhookToken) return json({ error: 'Webhook não configurado.' }, 503)
  if (!safeEqual(requestUrlToken(request), webhookToken)) return json({ error: 'Não autorizado.' }, 401)

  try {
    const body = await request.json().catch(() => ({})) as { type?: string; topic?: string; data?: { id?: string | number } }
    const eventType = body.type || body.topic || ''
    const resourceId = String(body.data?.id || '').trim()
    if (!resourceId || !['subscription_preapproval', 'subscription_authorized_payment'].includes(eventType)) return json({ received: true })
    if (signatureKey && !(await validSignature(request, resourceId, signatureKey))) return json({ error: 'Assinatura inválida.' }, 401)

    const resourcePath = eventType === 'subscription_preapproval' ? `preapproval/${encodeURIComponent(resourceId)}` : `authorized_payments/${encodeURIComponent(resourceId)}`
    const resourceResponse = await fetch(`https://api.mercadopago.com/${resourcePath}`, { headers: { Authorization: `Bearer ${accessToken}` } })
    const resource = await resourceResponse.json().catch(() => ({})) as Record<string, unknown>
    if (!resourceResponse.ok) return json({ error: 'Não foi possível confirmar o evento.' }, 502)

    const preapprovalId = eventType === 'subscription_preapproval' ? resourceId : String(resource.preapproval_id || resource.subscription_id || '')
    if (!preapprovalId) return json({ received: true })
    const subscriptionResponse = eventType === 'subscription_preapproval' ? resource : await mercadoPagoPreapproval(accessToken, preapprovalId)
    const externalReference = String(subscriptionResponse.external_reference || '')
    if (!isUuid(externalReference)) return json({ received: true })
    const sessionsResponse = await fetch(`${supabaseUrl}/rest/v1/mercado_pago_checkout_sessions?id=eq.${encodeURIComponent(externalReference)}&provider_preapproval_id=eq.${encodeURIComponent(preapprovalId)}&select=id`, { headers: serviceHeaders(serviceKey) })
    const sessions = await sessionsResponse.json().catch(() => []) as Array<{ id: string }>
    if (!sessionsResponse.ok || !sessions[0]) return json({ received: true })

    const nextPayment = parseDate(subscriptionResponse.next_payment_date) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const periodEnd = nextPayment.toISOString()
    const periodStart = new Date(nextPayment.getTime()); periodStart.setMonth(periodStart.getMonth() - 1)
    const payment = eventType === 'subscription_authorized_payment' ? resource : null
    const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_mercado_pago_subscription_event`, {
      method: 'POST', headers: serviceHeaders(serviceKey), body: JSON.stringify({
        input_session_id: sessions[0].id, input_provider_subscription_id: preapprovalId,
        input_status: String(subscriptionResponse.status || 'pending'), input_period_start: periodStart.toISOString(), input_period_end: periodEnd,
        input_payer_email: stringValue(subscriptionResponse.payer_email), input_payment_id: payment ? resourceId : null,
        input_payment_status: payment ? stringValue(payment.status) : null,
        input_amount_cents: payment ? cents(payment.transaction_amount || payment.amount) : null,
        input_paid_at: payment ? stringValue(payment.date_approved || payment.date_created) : null,
        input_metadata: { mercado_pago_status: subscriptionResponse.status, event_type: eventType },
      }),
    })
    if (!rpcResponse.ok) { console.error('Mercado Pago RPC failed', await rpcResponse.text()); return json({ error: 'Não foi possível aplicar o evento.' }, 502) }
    if (payment) {
      const paymentStatus = stringValue(payment.status) || 'pending'
      await fetch(`${supabaseUrl}/rest/v1/mercado_pago_checkout_sessions?id=eq.${encodeURIComponent(sessions[0].id)}`, {
        method: 'PATCH', headers: serviceHeaders(serviceKey), body: JSON.stringify({ last_payment_status: paymentStatus, recovery_attempts: ['rejected', 'failed'].includes(paymentStatus) ? 1 : 0 }),
      })
      if (['rejected', 'failed'].includes(paymentStatus)) await fetch(`${supabaseUrl}/rest/v1/user_subscriptions?provider=eq.mercado_pago&provider_subscription_id=eq.${encodeURIComponent(preapprovalId)}`, {
        method: 'PATCH', headers: serviceHeaders(serviceKey), body: JSON.stringify({ status: 'past_due', updated_at: new Date().toISOString() }),
      })
    }
    return json({ received: true })
  } catch (error) { console.error('Mercado Pago webhook failed', error); return json({ error: 'Falha ao processar o webhook.' }, 500) }
})

async function mercadoPagoPreapproval(accessToken: string, id: string) {
  const response = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!response.ok) throw new Error(`preapproval fetch ${response.status}`)
  return await response.json() as Record<string, unknown>
}
function requestUrlToken(request: Request) { return new URL(request.url).searchParams.get('token') || '' }
function stringValue(value: unknown) { return typeof value === 'string' ? value : null }
function cents(value: unknown) { const number = Number(value); return Number.isFinite(number) ? Math.round(number * 100) : null }
function parseDate(value: unknown) { const date = new Date(String(value || '')); return Number.isNaN(date.getTime()) ? null : date }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) }
function safeEqual(left: string, right: string) { if (!left || left.length !== right.length) return false; let diff = 0; for (let index = 0; index < left.length; index++) diff |= left.charCodeAt(index) ^ right.charCodeAt(index); return diff === 0 }

async function validSignature(request: Request, dataId: string, secret: string) {
  const signature = request.headers.get('x-signature') || ''
  const requestId = request.headers.get('x-request-id') || ''
  const timestamp = signature.match(/(?:^|,)\s*ts=([^,]+)/)?.[1] || ''
  const received = signature.match(/(?:^|,)\s*v1=([^,]+)/)?.[1] || ''
  if (!timestamp || !received) return false
  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signatureBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest)))
  const expected = Array.from(signatureBytes).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return safeEqual(received, expected)
}
