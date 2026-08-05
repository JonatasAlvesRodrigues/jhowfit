const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' }, summary: { type: 'string' }, dailyCalories: { type: 'number' }, protein: { type: 'number' }, estimatedWeeklyCost: { type: 'number' },
    meals: { type: 'array', minItems: 2, maxItems: 7, items: { type: 'object', properties: {
      name: { type: 'string' }, foods: { type: 'array', items: { type: 'string' } }, calories: { type: 'number' }, protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' }, preparation: { type: 'string' }, notes: { type: 'string' },
      alternatives: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'object', properties: { name: { type: 'string' }, foods: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['name', 'foods', 'notes'] } },
    }, required: ['name', 'foods', 'calories', 'protein', 'carbs', 'fat', 'preparation', 'notes', 'alternatives'] } },
    safetyNotice: { type: 'string' }, estimatesNotice: { type: 'string' },
  },
  required: ['name', 'summary', 'dailyCalories', 'protein', 'estimatedWeeklyCost', 'meals', 'safetyNotice', 'estimatesNotice'],
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

    const headers = { apikey: anonKey, Authorization: authorization }
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers })
    if (!userResponse.ok) return json({ error: 'Sessão inválida ou expirada.' }, 401)
    const user = await userResponse.json()
    const input = await request.json().catch(() => ({}))
    const profileFields = 'goal,current_weight,height_cm,birth_date,experience_level,training_days_per_week,average_duration_minutes,preferred_time,available_days,training_locations,meals_per_day,dietary_preferences,avoided_foods,allergies,dietary_restrictions,monthly_food_budget,has_health_conditions,health_conditions_details,pregnancy_status'
    const [profileResponse, workoutsResponse] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=${profileFields}`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/workouts?user_id=eq.${encodeURIComponent(user.id)}&is_active=eq.true&select=name,scheduled_days,duration&limit=8`, { headers }),
    ])
    const [profile] = profileResponse.ok ? await profileResponse.json() : []
    const workouts = workoutsResponse.ok ? await workoutsResponse.json() : []

    const risk = assessRisk(profile, input)
    if (risk) return json({ error: risk, requiresProfessionalGuidance: true }, 422)

    const age = calculateAge(profile?.birth_date)
    const desiredMeals = clamp(input.adjustment?.type === 'meal-count' ? input.adjustment?.detail : input.mealsPerDay, 2, 7)
    const adjustmentInstruction = buildAdjustmentInstruction(input.adjustment, input.currentPlan)
    const prompt = [
      'Você cria SUGESTÕES de refeições em português do Brasil, nunca diagnóstico, tratamento ou prescrição médica. Retorne somente JSON válido, sem markdown.',
      'Use objetivo, peso, altura, idade, rotina, treinos, número de refeições, preferências, restrições, alergias, alimentos rejeitados, orçamento e tempo para cozinhar. Não prometa resultados nem use linguagem prescritiva.',
      `Gere exatamente ${desiredMeals} refeições. Em cada alimento escreva uma quantidade aproximada junto ao nome (ex.: "Arroz cozido — 120 g"). Para cada refeição inclua calorias, proteínas, carboidratos e gorduras estimados, preparo simples e exatamente duas substituições com quantidades aproximadas.`,
      'Nunca inclua alergênicos, itens restritos ou alimentos rejeitados. Priorize ingredientes acessíveis no Brasil, respeite o orçamento e o tempo de preparo. Caso falte um dado, faça uma escolha conservadora e explique brevemente no resumo.',
      'Todos os números são aproximações. estimatesNotice deve dizer claramente que calorias, macros, porções e custos variam por marca, medida e preparo. safetyNotice deve reforçar que são opções gerais e que um nutricionista pode individualizar a orientação.',
      `FORMATO OBRIGATÓRIO: ${JSON.stringify(schema)}`,
      `PERFIL E CONTEXTO: ${JSON.stringify({ objective: profile?.goal, weightKg: profile?.current_weight, heightCm: profile?.height_cm, age, routine: { preferredTrainingTime: profile?.preferred_time, availableDays: profile?.available_days, trainingLocations: profile?.training_locations }, training: { experience: profile?.experience_level, daysPerWeek: profile?.training_days_per_week, averageMinutes: profile?.average_duration_minutes, activeWorkouts: workouts }, profilePreferences: profile?.dietary_preferences, profileRestrictions: profile?.dietary_restrictions, profileAvoids: profile?.avoided_foods, profileAllergies: profile?.allergies, profileMonthlyBudget: profile?.monthly_food_budget, generationPreferences: clean(input.preferences), generationRestrictions: clean(input.restrictions), generationAllergies: clean(input.allergies), dislikedFoods: clean(input.dislikedFoods), weeklyBudget: clean(input.budget), cookingTime: clean(input.cookingTime), availableIngredients: clean(input.availableIngredients), mealsPerDay: desiredMeals })}`,
      adjustmentInstruction,
    ].filter(Boolean).join('\n\n')

    const plan = await generate(geminiKey, prompt, desiredMeals)
    if (!plan) return json({ error: 'A IA está indisponível no momento. Tente novamente em alguns minutos.' }, 502)
    return json({ plan })
  } catch (error) {
    console.error(error)
    return json({ error: 'Não foi possível gerar as sugestões alimentares.' }, 500)
  }
})

function assessRisk(profile: Record<string, unknown> | undefined, input: Record<string, any>) {
  if (profile?.has_health_conditions) return 'Como seu perfil informa uma condição de saúde, não geramos sugestões automáticas. Recomendamos conversar com um nutricionista ou profissional de saúde que possa considerar seu histórico com segurança.'
  if (profile?.pregnancy_status === 'yes') return 'Durante a gravidez, necessidades alimentares precisam de avaliação individual. Procure seu obstetra ou nutricionista antes de alterar a alimentação.'
  if (input.hasSevereAllergy) return 'Alergias graves exigem prevenção individualizada de exposição e contaminação cruzada. Procure um alergista ou nutricionista; não geramos um plano automático neste caso.'
  if (input.hasEatingDisorder) return 'Em caso de transtorno alimentar atual ou em tratamento, mudanças na alimentação devem ser acompanhadas pela equipe de saúde. Não geramos um plano automático.'
  if (input.hasOtherRisk) return 'Esta situação requer orientação individualizada. Recomendamos procurar um nutricionista ou profissional de saúde antes de alterar sua alimentação.'
  return ''
}

function buildAdjustmentInstruction(adjustment: Record<string, unknown> | undefined, currentPlan: unknown) {
  if (!adjustment || !currentPlan) return ''
  const type = clean(adjustment.type)
  const detail = clean(adjustment.detail)
  const mealName = clean(adjustment.mealName)
  const instructions: Record<string, string> = {
    swap: `Troque somente a refeição "${mealName}" por uma nova opção que considere: ${detail}. Preserve as demais quando possível.`,
    ingredients: `Refaça as sugestões priorizando estes ingredientes disponíveis em casa: ${detail}.`,
    cheaper: `Crie uma versão mais barata do conjunto, com ingredientes comuns e custo semanal inferior. ${detail}`,
    quick: `Crie uma versão mais rápida, reduzindo etapas e tempo de preparo. ${detail}`,
    exclude: `Crie uma versão sem o alimento ou ingrediente: ${detail}. Não o use também nas substituições.`,
    'meal-count': `Ajuste o plano para ${detail} refeições, redistribuindo as opções de forma coerente.`,
  }
  return `AJUSTE SOLICITADO: ${instructions[type] ?? detail}\nPLANO ATUAL A SER AJUSTADO: ${JSON.stringify(currentPlan)}`
}

async function generate(key: string, prompt: string, mealCount: number) {
  for (const model of ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash']) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.35, maxOutputTokens: 6144 } }) })
    if (!response.ok) continue
    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('')
    try { if (text) return validate(JSON.parse(text), mealCount) } catch { /* tenta o próximo modelo */ }
  }
  return null
}

function validate(value: Record<string, unknown>, mealCount: number) {
  if (!value || !Array.isArray(value.meals) || value.meals.length !== mealCount) throw new Error('Sugestão inválida.')
  return {
    name: clean(value.name).slice(0, 100) || 'Sugestões personalizadas', summary: clean(value.summary).slice(0, 900), dailyCalories: number(value.dailyCalories), protein: number(value.protein), estimatedWeeklyCost: number(value.estimatedWeeklyCost),
    meals: value.meals.map((meal: Record<string, unknown>) => {
      const alternatives = Array.isArray(meal.alternatives) ? meal.alternatives.slice(0, 2).map((alternative: Record<string, unknown>) => ({ name: clean(alternative.name).slice(0, 80), foods: strings(alternative.foods, 12), notes: clean(alternative.notes).slice(0, 300) })) : []
      if (alternatives.length !== 2 || alternatives.some((alternative) => !alternative.name || !alternative.foods.length)) throw new Error('Substituições ausentes.')
      const foods = strings(meal.foods, 12)
      if (!clean(meal.name) || !foods.length || !clean(meal.preparation)) throw new Error('Refeição incompleta.')
      return { name: clean(meal.name).slice(0, 80), foods, calories: number(meal.calories), protein: number(meal.protein), carbs: number(meal.carbs), fat: number(meal.fat), preparation: clean(meal.preparation).slice(0, 500), notes: clean(meal.notes).slice(0, 350), alternatives }
    }),
    safetyNotice: clean(value.safetyNotice).slice(0, 700) || 'Estas são sugestões gerais e não substituem orientação de nutricionista.',
    estimatesNotice: clean(value.estimatesNotice).slice(0, 500) || 'Calorias, macronutrientes, quantidades e custos são estimativas e variam conforme marcas e preparo.',
  }
}
function strings(value: unknown, max: number) { return Array.isArray(value) ? value.map(clean).filter(Boolean).slice(0, max) : [] }
function clean(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function number(value: unknown) { const result = Number(value); return Number.isFinite(result) ? Math.max(0, Math.round(result)) : 0 }
function clamp(value: unknown, min: number, max: number) { return Math.min(max, Math.max(min, number(value) || min)) }
function calculateAge(value: unknown) { const birth = new Date(clean(value)); if (Number.isNaN(birth.getTime())) return null; const now = new Date(); let age = now.getUTCFullYear() - birth.getUTCFullYear(); if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) age -= 1; return age }
function json(payload: unknown, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }) }
