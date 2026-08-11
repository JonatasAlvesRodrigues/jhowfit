class AIUsageError extends Error { constructor(public code: string, public status: number) { super(code) } }
async function requireAIDataPermissions(base: string, key: string, authorization: string, userId: string, categories: string[]) {
  const response = await fetch(`${base}/rest/v1/ai_data_permissions?user_id=eq.${encodeURIComponent(userId)}&select=${categories.join(',')}`, { headers: { apikey: key, Authorization: authorization } })
  const rows = response.ok ? await response.json().catch(() => []) : []
  if (!response.ok || categories.some((category) => rows?.[0]?.[category] !== true)) throw new AIUsageError('ai_data_permission_required', 403)
}
async function reserveAIUsage(base: string, key: string, authorization: string, action: string, model: string, metadata: Record<string, unknown> = {}) {
  const response = await fetch(`${base}/rest/v1/rpc/reserve_ai_usage`, { method: 'POST', headers: { apikey: key, Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ requested_action: action, requested_model: model, request_metadata: metadata, requested_id: crypto.randomUUID() }) })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) { const raw = String(body?.message || body?.details || ''); const code = ['plan_upgrade_required','monthly_action_limit_reached','monthly_ai_limit_reached'].find((item) => raw.includes(item)) || 'usage_validation_failed'; throw new AIUsageError(code, code === 'usage_validation_failed' ? 502 : 429) }
  if (!body?.usage_id) throw new AIUsageError('usage_validation_failed', 502)
  return String(body.usage_id)
}
async function finalizeAIUsage(base: string, key: string, authorization: string, usageId: string, succeeded: boolean, metadata: Record<string, unknown> = {}) {
  const response = await fetch(`${base}/rest/v1/rpc/finalize_ai_usage`, { method: 'POST', headers: { apikey: key, Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ target_usage_id: usageId, succeeded, result_metadata: metadata }) })
  if (!response.ok) console.error('Could not finalize AI usage', response.status)
}
function usageErrorResponse(error: unknown) {
  if (!(error instanceof AIUsageError)) return null
  const messages: Record<string,string> = { plan_upgrade_required:'Este recurso inteligente não está incluído no seu plano atual. Conheça os planos disponíveis.', monthly_action_limit_reached:'Você utilizou sua cota mensal deste recurso.', monthly_ai_limit_reached:'Você atingiu seu limite mensal de IA. Faça upgrade para o Pro.', ai_data_permission_required:'Autorize Fotos na tela de Privacidade para usar este recurso.', usage_validation_failed:'Não foi possível validar seu limite de uso agora. Tente novamente.' }
  return { status:error.status, payload:{ error:messages[error.code] || messages.usage_validation_failed, code:error.code } }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const schema = {
  type: 'object',
  properties: {
    confidence: { type: 'number' },
    notes: { type: 'string' },
    items: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', properties: {
      name: { type: 'string' }, quantity: { type: 'number' }, unit: { type: 'string' }, calories: { type: 'number' }, protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' }, confidence: { type: 'number' },
    }, required: ['name', 'quantity', 'unit', 'calories', 'protein', 'carbs', 'fat', 'confidence'] } },
  },
  required: ['confidence', 'notes', 'items'],
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  let usage: { id: string; url: string; key: string; authorization: string } | null = null
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    const authorization = request.headers.get('Authorization')
    if (!supabaseUrl || !anonKey || !geminiKey) return json({ error: 'Serviço de análise não configurado.' }, 503)
    if (!authorization) return json({ error: 'Sessão não encontrada.' }, 401)
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } })
    if (!userResponse.ok) return json({ error: 'Sessão inválida ou expirada.' }, 401)
    const user = await userResponse.json()

    const body = await request.json().catch(() => ({}))
    const image = parseImage(body.image)
    if (!image) return json({ error: 'Envie uma imagem JPG, PNG ou WebP válida.' }, 400)
    if (image.data.length > 8_000_000) return json({ error: 'A imagem processada é muito grande.' }, 413)

    const prompt = [
      'Analise visualmente esta foto de uma refeição e estime os alimentos visíveis. Retorne somente JSON válido, sem markdown.',
      'Para cada alimento, informe nome em português do Brasil, quantidade aproximada, unidade preferencialmente em g ou ml, calorias, proteínas, carboidratos, gorduras e confiança de 0 a 100.',
      'Separe componentes claramente distintos (por exemplo arroz, feijão, frango e salada). Não invente alimentos que não estejam visualmente plausíveis.',
      'Considere que óleos, molhos, ingredientes escondidos e modo de preparo não podem ser determinados com precisão. Se suspeitar deles, explique em notes sem afirmar como certeza.',
      'As estimativas nutricionais devem corresponder à quantidade estimada de cada item. A confiança geral deve refletir identificação e quantificação, não apenas reconhecimento visual.',
      `FORMATO OBRIGATÓRIO: ${JSON.stringify(schema)}`,
    ].join('\n\n')
    await requireAIDataPermissions(supabaseUrl, anonKey, authorization, user.id, ['photos'])
    const usageId = await reserveAIUsage(supabaseUrl, anonKey, authorization, 'food_photo_analysis', Deno.env.get('GEMINI_MODEL') || 'gemini-flash-auto', { source: 'analyze-meal-photo' })
    usage = { id: usageId, url: supabaseUrl, key: anonKey, authorization }
    const attempt = await analyze(geminiKey, prompt, image)
    if (!attempt) {
      await finalizeAIUsage(supabaseUrl, anonKey, authorization, usageId, false)
      usage = null
      return json({ error: 'Não foi possível identificar a refeição nesta foto. Tente uma imagem mais clara e tirada de cima.' }, 422)
    }
    await finalizeAIUsage(supabaseUrl, anonKey, authorization, usageId, true, { model_used: attempt.model })
    usage = null
    return json({ analysis: attempt.analysis })
  } catch (error) {
    if (usage) await finalizeAIUsage(usage.url, usage.key, usage.authorization, usage.id, false)
    const limited = usageErrorResponse(error)
    if (limited) return json(limited.payload, limited.status)
    console.error(error)
    return json({ error: 'Não foi possível analisar a foto agora.' }, 500)
  }
})

async function analyze(key: string, prompt: string, image: { mimeType: string; data: string }) {
  for (const model of ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash']) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: image.mimeType, data: image.data } }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.15, maxOutputTokens: 3072 } }),
    })
    if (!response.ok) continue
    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('')
    try { if (text) return { analysis: validate(JSON.parse(text)), model } } catch { /* tenta o próximo modelo */ }
  }
  return null
}

function validate(value: Record<string, unknown>) {
  if (!value || !Array.isArray(value.items) || !value.items.length) throw new Error('Análise inválida.')
  const items = value.items.slice(0, 20).map((item: Record<string, unknown>) => ({ id: crypto.randomUUID(), name: clean(item.name).slice(0, 100), quantity: positive(item.quantity), unit: clean(item.unit).slice(0, 20) || 'g', calories: positive(item.calories), protein: positive(item.protein), carbs: positive(item.carbs), fat: positive(item.fat), confidence: percent(item.confidence) })).filter((item) => item.name && item.quantity > 0)
  if (!items.length) throw new Error('Nenhum alimento identificado.')
  return { items, confidence: percent(value.confidence), notes: clean(value.notes).slice(0, 600) || 'Revise as quantidades e o modo de preparo antes de confirmar.' }
}
function parseImage(value: unknown) { if (typeof value !== 'string') return null; const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/); return match ? { mimeType: match[1], data: match[2] } : null }
function clean(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function positive(value: unknown) { const number = Number(value); return Number.isFinite(number) ? Math.max(0, Math.round(number * 10) / 10) : 0 }
function percent(value: unknown) { return Math.min(100, positive(value)) }
function json(payload: unknown, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }) }
