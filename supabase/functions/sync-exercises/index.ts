const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL'), anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), providerUrl = Deno.env.get('EXERCISE_PROVIDER_URL')
    const providerKey = Deno.env.get('EXERCISE_PROVIDER_API_KEY'), providerHost = Deno.env.get('EXERCISE_PROVIDER_HOST'), authorization = request.headers.get('Authorization')
    if (!supabaseUrl || !anonKey || !serviceKey || !providerUrl) return json({ error: 'Sincronização não configurada.' }, 503)
    if (!authorization) return json({ error: 'Sessão não encontrada.' }, 401)
    const authHeaders = { apikey: anonKey, Authorization: authorization }
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: authHeaders })
    if (!userResponse.ok) return json({ error: 'Sessão inválida ou expirada.' }, 401)
    const user = await userResponse.json()
    const roleResponse = await fetch(`${supabaseUrl}/rest/v1/app_roles?user_id=eq.${encodeURIComponent(user.id)}&select=role`, { headers: authHeaders })
    const [role] = roleResponse.ok ? await roleResponse.json() : []
    if (!['admin', 'moderator'].includes(role?.role)) return json({ error: 'Apenas administradores podem sincronizar exercícios.' }, 403)
    const input = await request.json().catch(() => ({})), url = new URL(providerUrl)
    if (input.query) url.searchParams.set('q', String(input.query).slice(0, 80))
    url.searchParams.set('limit', String(Math.min(Math.max(Number(input.limit ?? 50), 1), 300)))
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (providerKey && providerHost) { headers['X-RapidAPI-Key'] = providerKey; headers['X-RapidAPI-Host'] = providerHost }
    else if (providerKey) headers.Authorization = `Bearer ${providerKey}`
    const providerResponse = await fetch(url, { headers })
    if (!providerResponse.ok) return json({ error: 'Não foi possível consultar o provider agora.' }, 502)
    const payload = await providerResponse.json()
    const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.exercises) ? payload.exercises : []
    const exercises = rows.map(normalize).filter((item: Record<string, unknown>) => item.name && item.external_id)
    if (!exercises.length) return json({ synced: 0, message: 'Nenhum exercício novo retornado.' })
    const write = await fetch(`${supabaseUrl}/rest/v1/exercise_library?on_conflict=source,external_id`, { method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(exercises) })
    if (!write.ok) return json({ error: 'Os exercícios foram recebidos, mas não puderam ser salvos.' }, 502)
    return json({ synced: exercises.length })
  } catch (error) { console.error(error); return json({ error: 'Não foi possível sincronizar novos exercícios agora.' }, 500) }
})

function normalize(row: Record<string, unknown>) {
  const name = String(row.name_pt ?? row.name ?? '').trim()
  const slug = String(row.slug ?? name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return { external_id: String(row.external_id ?? row.externalId ?? row.id), source: String(row.source ?? 'exercise-provider'), slug, name, name_en: row.name_en ?? row.name ?? null, body_part: row.body_part ?? row.bodyPart ?? null, primary_muscle: row.primary_muscle ?? row.targetMuscle ?? row.bodyPart ?? 'Outro', secondary_muscles: array(row.secondary_muscles ?? row.secondaryMuscles), equipment: row.equipment_pt ?? row.equipment ?? 'Nenhum', level: normalizeLevel(row.difficulty ?? row.level), instructions: array(row.instructions_pt ?? row.instructions), common_mistakes: array(row.common_mistakes ?? row.commonMistakes), safety_tips: array(row.safety_tips ?? row.safetyTips), substitutions: array(row.substitutions), locations: ['Academia', 'Casa'], image_url: row.image_url ?? null, gif_url: row.gif_url ?? row.gifUrl ?? null, video_url: row.video_url ?? row.videoUrl ?? null, thumbnail_url: row.thumbnail_url ?? row.thumbnailUrl ?? null, source_url: row.source_url ?? row.sourceUrl ?? null }
}
function array(value: unknown) { return Array.isArray(value) ? value.map(String) : typeof value === 'string' && value ? [value] : [] }
function normalizeLevel(value: unknown) { const text = String(value ?? '').toLowerCase(); return text.includes('avan') ? 'Avançado' : text.includes('inter') ? 'Intermediário' : 'Iniciante' }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
