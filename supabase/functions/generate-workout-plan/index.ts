const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const planSchema = {
  type: 'object',
  properties: {
    planName: { type: 'string', description: 'Nome curto do plano em português.' },
    weeklySplit: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day: { type: 'string' },
          workout: { type: 'string' },
        },
        required: ['day', 'workout'],
      },
    },
    workouts: {
      type: 'array',
      minItems: 1,
      maxItems: 7,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          days: { type: 'array', items: { type: 'string' } },
          focus: { type: 'string' },
          durationMinutes: { type: 'integer', minimum: 10, maximum: 180 },
          notes: { type: 'string' },
          exercises: {
            type: 'array',
            minItems: 2,
            maxItems: 12,
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                sets: { type: 'integer', minimum: 1, maximum: 10 },
                repetitions: { type: 'string' },
                restSeconds: { type: 'integer', minimum: 0, maximum: 300 },
                initialWeight: {
                  type: 'number',
                  minimum: 0,
                  description: 'Carga inicial sugerida em kg. Use 0 quando não for aplicável.',
                },
                notes: { type: 'string' },
                optional: { type: 'boolean' },
                advancedTechnique: { type: 'string' },
                substitutions: { type: 'array', items: { type: 'string' }, maxItems: 3 },
              },
              required: ['name', 'sets', 'repetitions', 'restSeconds', 'initialWeight', 'notes', 'optional', 'advancedTechnique', 'substitutions'],
            },
          },
        },
        required: ['name', 'days', 'focus', 'durationMinutes', 'notes', 'exercises'],
      },
    },
    rationale: { type: 'string', description: 'Justificativa resumida e sem promessas de resultado.' },
    safetyNotice: { type: 'string', description: 'Aviso de segurança e recomendação de avaliação profissional.' },
  },
  required: ['planName', 'weeklySplit', 'workouts', 'rationale', 'safetyNotice'],
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

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: authorization },
    })
    if (!userResponse.ok) return json({ error: 'Sessão inválida ou expirada.' }, 401)
    const user = await userResponse.json()

    const input = await request.json().catch(() => ({}))
    const headers = { apikey: anonKey, Authorization: authorization }
    const [profileResponse, libraryResponse] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/exercise_library?select=name,primary_muscle,secondary_muscles,equipment,level,locations`, { headers }),
    ])
    if (!profileResponse.ok || !libraryResponse.ok) return json({ error: 'Não foi possível preparar seu perfil para a IA.' }, 502)

    const [profile] = await profileResponse.json()
    const library = await libraryResponse.json()
    if (!profile) return json({ error: 'Complete seu perfil antes de gerar um treino.' }, 422)

    const profileSummary = buildProfileSummary(profile, input)
    const prompt = buildPrompt(profileSummary, library)
    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: 'Você é um assistente de planejamento fitness responsável. Não diagnostique, não trate lesões, não garanta resultados e não substitua profissionais de saúde ou educação física. Quando houver risco, seja conservador, evite exercícios incompatíveis e sinalize avaliação profissional.',
            }],
          },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      },
    )

    if (!geminiResponse.ok) {
      const details = await geminiResponse.text()
      console.error('Gemini error', geminiResponse.status, details.slice(0, 500))
      return json(geminiError(geminiResponse.status), 502)
    }

    const geminiData = await geminiResponse.json()
    const text = geminiData?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('')
    if (!text) return json({ error: 'A IA retornou uma resposta vazia.' }, 502)

    const plan = validatePlan(JSON.parse(text))
    return json({ profileSummary, plan })
  } catch (error) {
    console.error(error)
    return json({ error: 'Não foi possível gerar o plano. Revise os dados e tente novamente.' }, 500)
  }
})

function buildProfileSummary(profile: Record<string, unknown>, input: Record<string, unknown>) {
  const age = profile.birth_date ? calculateAge(String(profile.birth_date)) : null
  return {
    objective: profile.goal || 'Não informado',
    age,
    heightCm: numberOrNull(profile.height_cm),
    weightKg: numberOrNull(profile.current_weight),
    level: profile.experience_level || 'Não informado',
    availableDays: array(profile.available_days),
    daysPerWeek: numberOrNull(profile.training_days_per_week),
    durationMinutes: numberOrNull(profile.average_duration_minutes),
    locations: array(profile.training_locations),
    equipment: array(profile.equipment),
    priorityMuscles: cleanArray(input.priorityMuscles, 8),
    injuries: profile.has_injuries ? cleanText(profile.injuries_details) || 'Informada sem detalhes' : 'Não informadas',
    physicalLimitations: profile.has_physical_limitations ? cleanText(profile.physical_limitations_details) || 'Informadas sem detalhes' : 'Não informadas',
    pain: profile.has_pain ? cleanText(profile.pain_details) || 'Informada sem detalhes' : 'Não informada',
    dislikedExercises: cleanArray(input.dislikedExercises, 12),
  }
}

function buildPrompt(profile: Record<string, unknown>, library: Array<Record<string, unknown>>) {
  const available = library.slice(0, 150).map((exercise) => ({
    name: exercise.name,
    primaryMuscle: exercise.primary_muscle,
    equipment: exercise.equipment,
    level: exercise.level,
    locations: exercise.locations,
  }))
  return [
    'Crie uma sugestão de plano semanal em português usando prioritariamente exercícios da biblioteca fornecida.',
    'Adapte volume, descanso e seleção ao nível, tempo, equipamentos, local, lesões, dores e limitações.',
    'Se o perfil indicar risco ou informação insuficiente, use opções conservadoras e destaque a necessidade de avaliação profissional.',
    'Não faça diagnóstico, tratamento, promessa ou garantia de resultado.',
    'Não inclua exercícios listados como não apreciados.',
    'Retorne apenas JSON válido, sem markdown, seguindo exatamente o formato obrigatório.',
    `FORMATO OBRIGATÓRIO: ${JSON.stringify(planSchema)}`,
    `PERFIL: ${JSON.stringify(profile)}`,
    `BIBLIOTECA DISPONÍVEL: ${JSON.stringify(available)}`,
  ].join('\n\n')
}

function validatePlan(value: Record<string, unknown>) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.workouts) || !value.workouts.length) {
    throw new Error('Plano inválido.')
  }
  return {
    planName: cleanText(value.planName).slice(0, 100) || 'Plano personalizado',
    weeklySplit: Array.isArray(value.weeklySplit) ? value.weeklySplit.slice(0, 7).map((item: Record<string, unknown>) => ({
      day: normalizeWeekDay(cleanText(item.day)) || cleanText(item.day).slice(0, 40),
      workout: cleanText(item.workout).slice(0, 120),
    })) : [],
    workouts: value.workouts.slice(0, 7).map((workout: Record<string, unknown>) => ({
      name: cleanText(workout.name).slice(0, 100) || 'Treino',
      days: normalizeWeekDays(workout.days),
      focus: cleanText(workout.focus).slice(0, 180),
      durationMinutes: clamp(Number(workout.durationMinutes), 10, 180),
      notes: cleanText(workout.notes).slice(0, 1000),
      exercises: Array.isArray(workout.exercises) ? workout.exercises.slice(0, 12).map((exercise: Record<string, unknown>) => ({
        name: cleanText(exercise.name).slice(0, 120),
        sets: clamp(Number(exercise.sets), 1, 10),
        repetitions: cleanText(exercise.repetitions).slice(0, 40),
        restSeconds: clamp(Number(exercise.restSeconds), 0, 300),
        initialWeight: Number(exercise.initialWeight) > 0 ? Number(exercise.initialWeight) : null,
        notes: cleanText(exercise.notes).slice(0, 500),
        optional: Boolean(exercise.optional),
        advancedTechnique: cleanText(exercise.advancedTechnique).slice(0, 100),
        substitutions: cleanArray(exercise.substitutions, 3),
      })) : [],
    })),
    rationale: cleanText(value.rationale).slice(0, 1500),
    safetyNotice: cleanText(value.safetyNotice).slice(0, 1000),
  }
}

function calculateAge(birthDate: string) {
  const birth = new Date(`${birthDate}T12:00:00Z`)
  const today = new Date()
  let age = today.getUTCFullYear() - birth.getUTCFullYear()
  const beforeBirthday = today.getUTCMonth() < birth.getUTCMonth()
    || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate())
  if (beforeBirthday) age -= 1
  return Math.max(age, 0)
}

function cleanArray(value: unknown, limit = 20) {
  return Array.isArray(value) ? value.map((item) => cleanText(item).slice(0, 120)).filter(Boolean).slice(0, limit) : []
}

function normalizeWeekDays(value: unknown) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((day) => normalizeWeekDay(cleanText(day))).filter(Boolean))].slice(0, 7)
}

function normalizeWeekDay(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
  const aliases: Record<string, string> = {
    domingo: 'Domingo',
    sunday: 'Domingo',
    segunda: 'Segunda',
    'segunda-feira': 'Segunda',
    monday: 'Segunda',
    terca: 'Terça',
    'terca-feira': 'Terça',
    tuesday: 'Terça',
    quarta: 'Quarta',
    'quarta-feira': 'Quarta',
    wednesday: 'Quarta',
    quinta: 'Quinta',
    'quinta-feira': 'Quinta',
    thursday: 'Quinta',
    sexta: 'Sexta',
    'sexta-feira': 'Sexta',
    friday: 'Sexta',
    sabado: 'Sábado',
    saturday: 'Sábado',
  }
  return aliases[normalized] ?? ''
}

function array(value: unknown) {
  return Array.isArray(value) ? value.map(String) : []
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function numberOrNull(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Number.isFinite(value) ? Math.round(value) : min, min), max)
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function geminiError(status: number) {
  if (status === 400) {
    return {
      code: 'GEMINI_INVALID_REQUEST',
      error: 'O Gemini recusou a configuração da geração. Atualize a função e tente novamente.',
    }
  }
  if (status === 401 || status === 403) {
    return {
      code: 'GEMINI_KEY_DENIED',
      error: 'A chave do Gemini não foi aceita. Verifique a chave configurada no Supabase.',
    }
  }
  if (status === 404) {
    return {
      code: 'GEMINI_MODEL_UNAVAILABLE',
      error: 'O modelo do Gemini não está disponível para esta chave.',
    }
  }
  if (status === 429) {
    return {
      code: 'GEMINI_QUOTA_EXCEEDED',
      error: 'A cota do Gemini foi atingida. Verifique o plano e o faturamento no Google AI Studio.',
    }
  }
  return {
    code: 'GEMINI_PROVIDER_ERROR',
    error: 'O Gemini está indisponível no momento. Tente novamente em alguns minutos.',
  }
}
