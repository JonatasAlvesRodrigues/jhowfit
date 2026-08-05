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
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    const authorization = request.headers.get('Authorization')
    if (!supabaseUrl || !anonKey || !geminiKey) return json({ error: 'Serviço de análise não configurado.' }, 503)
    if (!authorization) return json({ error: 'Sessão não encontrada.' }, 401)
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } })
    if (!userResponse.ok) return json({ error: 'Sessão inválida ou expirada.' }, 401)

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
    const result = await analyze(geminiKey, prompt, image)
    if (!result) return json({ error: 'Não foi possível identificar a refeição nesta foto. Tente uma imagem mais clara e tirada de cima.' }, 422)
    return json({ analysis: result })
  } catch (error) {
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
    try { if (text) return validate(JSON.parse(text)) } catch { /* tenta o próximo modelo */ }
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
