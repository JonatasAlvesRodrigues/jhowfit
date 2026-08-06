import { supabase } from '../integrations/supabase'
import type { AppNotification, NotificationPreference, NotificationSettings, NotificationType } from '../types/notification'

export const defaultPreferences: NotificationPreference[] = [
  { type: 'workout', enabled: true, time: '18:00', days: [1, 3, 5], intervalMinutes: null },
  { type: 'water', enabled: true, time: '08:00', days: [0, 1, 2, 3, 4, 5, 6], intervalMinutes: 120 },
  { type: 'meal', enabled: false, time: '12:00', days: [0, 1, 2, 3, 4, 5, 6], intervalMinutes: null },
  { type: 'walk', enabled: false, time: '17:30', days: [1, 2, 3, 4, 5], intervalMinutes: null },
  { type: 'weigh_in', enabled: true, time: '08:00', days: [1], intervalMinutes: null },
  { type: 'goal_near', enabled: true, time: '19:00', days: [0, 1, 2, 3, 4, 5, 6], intervalMinutes: null },
  { type: 'weekly_summary', enabled: true, time: '09:00', days: [0], intervalMinutes: null },
]

export const defaultNotificationSettings: NotificationSettings = {
  pausedUntil: null,
  quietStart: '22:00',
  quietEnd: '07:00',
  preferences: defaultPreferences,
}

let localSettings = cloneSettings(defaultNotificationSettings)
let localNotifications: AppNotification[] = seedNotifications()

export const notificationService = {
  async load(userId: string): Promise<{ settings: NotificationSettings; notifications: AppNotification[] }> {
    if (!supabase) return { settings: cloneSettings(localSettings), notifications: [...localNotifications] }
    const [settingsResult, notificationsResult] = await Promise.all([
      supabase.from('notification_settings').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('app_notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(60),
    ])
    if (settingsResult.error || notificationsResult.error) throw new Error('Não foi possível carregar suas notificações.')
    const row = settingsResult.data
    return {
      settings: row ? {
        pausedUntil: row.paused_until ? String(row.paused_until) : null,
        quietStart: String(row.quiet_start).slice(0, 5),
        quietEnd: String(row.quiet_end).slice(0, 5),
        preferences: mergePreferences(row.preferences),
      } : cloneSettings(defaultNotificationSettings),
      notifications: (notificationsResult.data ?? []).map(mapNotification),
    }
  },

  async save(userId: string, settings: NotificationSettings) {
    validateSettings(settings)
    if (!supabase) { localSettings = cloneSettings(settings); return }
    const { error } = await supabase.from('notification_settings').upsert({
      user_id: userId, paused_until: settings.pausedUntil, quiet_start: settings.quietStart,
      quiet_end: settings.quietEnd, preferences: settings.preferences, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) throw new Error('Não foi possível salvar suas preferências.')
  },

  async markRead(userId: string, id: string, read: boolean) {
    const readAt = read ? new Date().toISOString() : null
    if (!supabase) { localNotifications = localNotifications.map((item) => item.id === id ? { ...item, readAt } : item); return }
    const { error } = await supabase.from('app_notifications').update({ read_at: readAt }).eq('id', id).eq('user_id', userId)
    if (error) throw new Error('Não foi possível atualizar a notificação.')
  },

  async markAllRead(userId: string) {
    const readAt = new Date().toISOString()
    if (!supabase) { localNotifications = localNotifications.map((item) => ({ ...item, readAt })); return }
    const { error } = await supabase.from('app_notifications').update({ read_at: readAt }).eq('user_id', userId).is('read_at', null)
    if (error) throw new Error('Não foi possível marcar todas como lidas.')
  },

  async enablePush(userId: string): Promise<'enabled' | 'unsupported' | 'configured'> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'unsupported'
    const registration = await navigator.serviceWorker.ready
    const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!publicKey) return 'configured'
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
    if (supabase) {
      const json = subscription.toJSON()
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: userId, endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth_key: json.keys?.auth, user_agent: navigator.userAgent,
      }, { onConflict: 'user_id,endpoint' })
      if (error) throw new Error('A permissão foi concedida, mas a inscrição push não pôde ser salva.')
    }
    return 'enabled'
  },
}

export function isNotificationAllowed(settings: NotificationSettings, type: NotificationType, now = new Date(), lastSentAt?: string) {
  const preference = settings.preferences.find((item) => item.type === type)
  if (!preference?.enabled || (settings.pausedUntil && new Date(settings.pausedUntil) > now) || !preference.days.includes(now.getDay())) return false
  const minutes = now.getHours() * 60 + now.getMinutes()
  const quietStart = toMinutes(settings.quietStart), quietEnd = toMinutes(settings.quietEnd)
  const inQuietHours = quietStart > quietEnd ? minutes >= quietStart || minutes < quietEnd : minutes >= quietStart && minutes < quietEnd
  if (inQuietHours) return false
  const minimumGap = Math.max(preference.intervalMinutes ?? 180, 60)
  return !lastSentAt || now.getTime() - new Date(lastSentAt).getTime() >= minimumGap * 60000
}

function mergePreferences(value: unknown) {
  const rows = Array.isArray(value) ? value as NotificationPreference[] : []
  return defaultPreferences.map((fallback) => ({ ...fallback, ...rows.find((row) => row.type === fallback.type) }))
}
function validateSettings(settings: NotificationSettings) {
  if (!/^\d{2}:\d{2}$/.test(settings.quietStart) || !/^\d{2}:\d{2}$/.test(settings.quietEnd)) throw new Error('Confira o período de silêncio.')
  if (settings.preferences.some((item) => !/^\d{2}:\d{2}$/.test(item.time) || item.days.some((day) => day < 0 || day > 6))) throw new Error('Confira os horários e dias selecionados.')
}
function cloneSettings(settings: NotificationSettings): NotificationSettings { return { ...settings, preferences: settings.preferences.map((item) => ({ ...item, days: [...item.days] })) } }
function mapNotification(row: Record<string, unknown>): AppNotification { return { id: String(row.id), type: String(row.type) as NotificationType, title: String(row.title), message: String(row.message), createdAt: String(row.created_at), readAt: row.read_at ? String(row.read_at) : null, actionPath: String(row.action_path), actionLabel: String(row.action_label) } }
function toMinutes(time: string) { const [hours, minutes] = time.split(':').map(Number); return hours * 60 + minutes }
function urlBase64ToUint8Array(value: string) { const padding = '='.repeat((4 - value.length % 4) % 4); const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0)) }
function seedNotifications(): AppNotification[] { const now = Date.now(); return [
  { id: 'welcome-reminders', type: 'weekly_summary', title: 'Seus lembretes estão prontos', message: 'Revise os horários e ative somente o que ajuda na sua rotina.', createdAt: new Date(now - 35 * 60000).toISOString(), readAt: null, actionPath: '/notificacoes', actionLabel: 'Configurar' },
  { id: 'water-reminder', type: 'water', title: 'Hora de se hidratar', message: 'Um copo de água agora ajuda você a manter o ritmo da meta diária.', createdAt: new Date(now - 3 * 3600000).toISOString(), readAt: null, actionPath: '/agua', actionLabel: 'Registrar água' },
  { id: 'weekly-progress', type: 'weekly_summary', title: 'Seu resumo semanal chegou', message: 'Veja seus treinos, passos e consistência dos últimos sete dias.', createdAt: new Date(now - 26 * 3600000).toISOString(), readAt: new Date(now - 25 * 3600000).toISOString(), actionPath: '/relatorios', actionLabel: 'Ver resumo' },
] }
