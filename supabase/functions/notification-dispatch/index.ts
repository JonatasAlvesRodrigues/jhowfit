import webpush from 'web-push'

type ReminderType = 'workout' | 'water' | 'meal' | 'walk' | 'weigh_in' | 'goal_near' | 'weekly_summary'
type Preference = { type: ReminderType; enabled: boolean; time: string; days: number[]; intervalMinutes: number | null }
type SettingsRow = { user_id: string; paused_until: string | null; quiet_start: string; quiet_end: string; preferences: Preference[] }
type Subscription = { id: string; user_id: string; endpoint: string; p256dh: string; auth_key: string }

const copy: Record<ReminderType, { title: string; message: string; path: string }> = {
  workout: { title: 'Hora do treino', message: 'Seu treino planejado está esperando por você.', path: '/treinos' },
  water: { title: 'Hora de beber água', message: 'Um copo agora ajuda você a manter sua meta.', path: '/agua' },
  meal: { title: 'Registrar refeição', message: 'Registre sua refeição para manter o diário em dia.', path: '/dieta' },
  walk: { title: 'Que tal caminhar?', message: 'Alguns minutos de movimento já fazem diferença.', path: '/atividades' },
  weigh_in: { title: 'Lembrete de pesagem', message: 'Registre seu peso para acompanhar a evolução.', path: '/evolucao' },
  goal_near: { title: 'Sua meta está perto', message: 'Você está a poucos passos de concluir a meta de hoje.', path: '/metas' },
  weekly_summary: { title: 'Seu resumo semanal', message: 'Confira o que você conquistou nesta semana.', path: '/relatorios' },
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return response({ error: 'Método não permitido.' }, 405)
  const cronSecret = Deno.env.get('NOTIFICATION_CRON_SECRET')
  if (!cronSecret || request.headers.get('x-movelya-cron-secret') !== cronSecret) return response({ error: 'Não autorizado.' }, 401)

  const baseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT')
  if (!baseUrl || !serviceKey || !publicKey || !privateKey || !subject) return response({ error: 'Envio push não configurado.' }, 503)

  webpush.setVapidDetails(subject, publicKey, privateKey)
  const now = new Date()
  const settingsResult = await rest<SettingsRow[]>(baseUrl, serviceKey, 'notification_settings?select=user_id,paused_until,quiet_start,quiet_end,preferences')
  if (!settingsResult.ok) return response({ error: 'Não foi possível consultar os lembretes.' }, 502)
  const candidates = settingsResult.data.filter((settings) => dueTypes(settings, now).length > 0)
  if (!candidates.length) return response({ delivered: 0, skipped: 0 })

  const ids = candidates.map((item) => item.user_id)
  const [subscriptionsResult, logsResult] = await Promise.all([
    rest<Subscription[]>(baseUrl, serviceKey, `push_subscriptions?user_id=in.(${ids.join(',')})&select=id,user_id,endpoint,p256dh,auth_key`),
    rest<Array<{ user_id: string; type: ReminderType; delivered_at: string }>>(baseUrl, serviceKey, `notification_delivery_log?user_id=in.(${ids.join(',')})&delivered_at=gte.${encodeURIComponent(new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())}&select=user_id,type,delivered_at`),
  ])
  if (!subscriptionsResult.ok || !logsResult.ok) return response({ error: 'Não foi possível preparar os envios.' }, 502)

  let delivered = 0, skipped = 0
  for (const settings of candidates) {
    const userSubscriptions = subscriptionsResult.data.filter((item) => item.user_id === settings.user_id)
    for (const type of dueTypes(settings, now)) {
      const lastSent = logsResult.data.filter((log) => log.user_id === settings.user_id && log.type === type).sort((a, b) => b.delivered_at.localeCompare(a.delivered_at))[0]?.delivered_at
      const dailyCount = logsResult.data.filter((log) => log.user_id === settings.user_id).length
      if (!userSubscriptions.length || dailyCount >= 6 || !allowed(settings, type, now, lastSent)) { skipped++; continue }
      const sent = await sendToUser(baseUrl, serviceKey, userSubscriptions, type)
      if (!sent) { skipped++; continue }
      const item = copy[type]
      await Promise.all([
        insert(baseUrl, serviceKey, 'notification_delivery_log', { user_id: settings.user_id, type }),
        insert(baseUrl, serviceKey, 'app_notifications', { user_id: settings.user_id, type, title: item.title, message: item.message, action_path: item.path, action_label: 'Abrir' }),
      ])
      delivered++
    }
  }
  return response({ delivered, skipped })
})

function dueTypes(settings: SettingsRow, now: Date) {
  const local = saoPaulo(now)
  return (Array.isArray(settings.preferences) ? settings.preferences : []).filter((item) => item.enabled && item.days.includes(local.day) && isScheduledMinute(item, local.minutes)).map((item) => item.type)
}
function allowed(settings: SettingsRow, type: ReminderType, now: Date, lastSent?: string) {
  const local = saoPaulo(now)
  if (settings.paused_until && new Date(settings.paused_until) > now) return false
  const quietStart = minutes(settings.quiet_start), quietEnd = minutes(settings.quiet_end)
  const quiet = quietStart > quietEnd ? local.minutes >= quietStart || local.minutes < quietEnd : local.minutes >= quietStart && local.minutes < quietEnd
  if (quiet) return false
  const preference = settings.preferences.find((item) => item.type === type)
  const minimumGap = Math.max(preference?.intervalMinutes ?? 180, 60)
  return !lastSent || now.getTime() - new Date(lastSent).getTime() >= minimumGap * 60_000
}
function isScheduledMinute(preference: Preference, currentMinute: number) { const initial = minutes(preference.time); return preference.intervalMinutes ? currentMinute >= initial && (currentMinute - initial) % preference.intervalMinutes === 0 : currentMinute === initial }
function saoPaulo(now: Date) { const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now); const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0); const weekday = parts.find((part) => part.type === 'weekday')?.value; return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday ?? ''), minutes: value('hour') * 60 + value('minute') } }
async function sendToUser(base: string, key: string, subscriptions: Subscription[], type: ReminderType) {
  const item = copy[type], payload = JSON.stringify({ title: item.title, body: item.message, url: `./#${item.path}`, tag: `movelya-${type}` })
  const results = await Promise.all(subscriptions.map(async (subscription) => {
    try { await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } }, payload, { TTL: 3600, urgency: type === 'water' ? 'normal' : 'high' }); return true }
    catch (error) { const statusCode = Number((error as { statusCode?: number }).statusCode); if (statusCode === 404 || statusCode === 410) await remove(base, key, subscription.id); console.error('push failed', statusCode); return false }
  }))
  return results.some(Boolean)
}
async function rest<T>(base: string, key: string, path: string) { const result = await fetch(`${base}/rest/v1/${path}`, { headers: headers(key) }); return { ok: result.ok, data: result.ok ? await result.json() as T : [] as T } }
async function insert(base: string, key: string, table: string, body: Record<string, unknown>) { return fetch(`${base}/rest/v1/${table}`, { method: 'POST', headers: { ...headers(key), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }
async function remove(base: string, key: string, id: string) { await fetch(`${base}/rest/v1/push_subscriptions?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers(key) }) }
function headers(key: string) { return { apikey: key, Authorization: `Bearer ${key}` } }
function minutes(value: string) { const [hour, minute] = String(value).slice(0, 5).split(':').map(Number); return hour * 60 + minute }
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } }) }
