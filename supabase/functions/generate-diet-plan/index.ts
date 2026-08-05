const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    summary: { type: 'string' },
    dailyCalories: { type: 'number' },
    protein: { type: 'number' },
    estimatedWeeklyCost: { type: 'number' },
    meals: {
      type: 'array',
      minItems: 2,
      maxItems: 7,
      items: { type: 'object', properties: { name: { type: 'string' }, foods: { type: 'array', items: { type: 'string' } }, calories: { type: 'number' }, protein: { type: 'number' }, notes: { type: 'string' } }, required: ['name', 'foods', 'calories', 'protein', 'notes'] },
    },
    safetyNotice: { type: 'string' },
  },
  required: ['name', 'summary', 'dailyCalories', 'protein', 'estimatedWeeklyCost', 'meals', 'safetyNotice'],
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    const authorization = request.headers.get('Authorization')
    if (!supabaseUrl || !anonKey || !geminiKey) return json({ error: 'Serviço de IA não configurado.' }, 503)
    if (!authorization) return json({ error: 'Sessão não encontrada.' }, 401)

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } })
    if (!userResponse.ok) return json({ error: 'Sessão inválida ou expirada.' }, 401)
    const user = await userResponse.json()
    const input = await request.json().catch(() => ({}))
    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=goal,current_weight,height_cm,birth_date,food_preferences,food_restrictions,allergies,meals_per_day`, { headers: { apikey: anonKey, Authorization: authorization } })
    const [profile] = profileResponse.ok ? await profileResponse.json() : []
    const prompt = [
      'Crie uma sugestão de dieta diária econômica em português do Brasil. Retorne apenas JSON válido, sem markdown.',
      'Não diagnostique, trate doenças, prometa resultados nem substitua nutricionista. Não inclua alimentos listados como evitados, alergias ou restrições.',
      'Use alimentos comuns e estime custos conservadores em reais brasileiros; se orçamento não for informado, priorize opções acessíveis.',
      `FORMATO: ${JSON.stringify(schema)}`,
      `PERFIL: ${JSON.stringify(profile ?? {})}`,
      `PREFERÊNCIAS: ${clean(input.preferences)}`,
      `NÃO CONSOME: ${clean(input.avoids)}`,
      `ORÇAMENTO SEMANAL: ${clean(input.budget) || 'não informado'}`,
      `REFEIÇÕES POR DIA: ${clamp(input.mealsPerDay, 2, 7)}`,
    ].join('\n\n')
    const plan = await generate(geminiKey, prompt)
    if (!plan) return json({ error: 'O Gemini está indisponível no momento. Tente novamente em alguns minutos.' }, 502)
    return json({ plan })
  } catch (error) {
    console.error(error)
    return json({ error: 'Não foi possível gerar a sugestão de dieta.' }, 500)
  }
})

async function generate(key: string, prompt: string) {
  for (const model of ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash']) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.35, maxOutputTokens: 4096 } }),
    })
    if (!response.ok) continue
    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('')
    try { if (text) return validate(JSON.parse(text)) } catch { /* try the next supported model */ }
  }
  return null
}

function validate(value: Record<string, unknown>) {
  if (!value || !Array.isArray(value.meals) || value.meals.length < 2) throw new Error('Plano inválido.')
  return {
    name: clean(value.name).slice(0, 100) || 'Dieta personalizada', summary: clean(value.summary).slice(0, 900), dailyCalories: number(value.dailyCalories), protein: number(value.protein), estimatedWeeklyCost: number(value.estimatedWeeklyCost),
    meals: value.meals.slice(0, 7).map((meal: Record<string, unknown>) => ({ name: clean(meal.name).slice(0, 80), foods: Array.isArray(meal.foods) ? meal.foods.map(clean).filter(Boolean).slice(0, 12) : [], calories: number(meal.calories), protein: number(meal.protein), notes: clean(meal.notes).slice(0, 350) })),
    safetyNotice: clean(value.safetyNotice).slice(0, 700) || 'Esta sugestão não substitui acompanhamento nutricional profissional.',
  }
}
function clean(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function number(value: unknown) { const result = Number(value); return Number.isFinite(result) ? Math.max(0, Math.round(result)) : 0 }
function clamp(value: unknown, min: number, max: number) { return Math.min(max, Math.max(min, number(value) || min)) }
function json(payload: unknown, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }) }
