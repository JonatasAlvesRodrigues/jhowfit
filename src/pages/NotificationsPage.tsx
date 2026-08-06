import { useEffect, useMemo, useState } from 'react'
import { Bell, BellRing, Check, CheckCheck, ChevronRight, Clock3, Dumbbell, Footprints, GlassWater, Goal, Pause, Scale, Soup, Sparkles, TriangleAlert } from 'lucide-react'
import { Button, Card } from '../components/ui'
import { defaultNotificationSettings, notificationService } from '../services/notificationService'
import type { AppNotification, NotificationPreference, NotificationSettings, NotificationType } from '../types/notification'
import '../notifications.css'

const dayLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const notificationContent: Record<NotificationType, { title: string; description: string; icon: typeof Bell; tone: string }> = {
  workout: { title: 'Hora do treino', description: 'Lembrete antes da sua rotina planejada.', icon: Dumbbell, tone: 'green' },
  water: { title: 'Beber água', description: 'Repetição moderada durante o período ativo.', icon: GlassWater, tone: 'blue' },
  meal: { title: 'Registrar refeição', description: 'Não deixe seu diário alimentar incompleto.', icon: Soup, tone: 'orange' },
  walk: { title: 'Caminhar', description: 'Um convite leve para movimentar o dia.', icon: Footprints, tone: 'purple' },
  weigh_in: { title: 'Pesagem semanal', description: 'Uma vez por semana, sempre no mesmo horário.', icon: Scale, tone: 'pink' },
  goal_near: { title: 'Meta quase atingida', description: 'Só aparece quando faltar pouco para concluir.', icon: Goal, tone: 'yellow' },
  weekly_summary: { title: 'Resumo semanal', description: 'Seu progresso da semana em uma visão rápida.', icon: Sparkles, tone: 'green' },
}

export function NotificationsPage({ userId, onNavigate }: { userId: string; onNavigate: (path: string) => void }) {
  const [settings, setSettings] = useState<NotificationSettings>(defaultNotificationSettings)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const unread = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications])
  const activeCount = settings.preferences.filter((item) => item.enabled).length

  useEffect(() => {
    let active = true
    notificationService.load(userId).then((data) => { if (active) { setSettings(data.settings); setNotifications(data.notifications) } }).catch((reason) => active && setError(message(reason))).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [userId])
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 3500); return () => window.clearTimeout(timer) }, [notice])

  function updatePreference(type: NotificationType, update: Partial<NotificationPreference>) {
    setSettings((current) => ({ ...current, preferences: current.preferences.map((item) => item.type === type ? { ...item, ...update } : item) }))
  }
  function toggleDay(preference: NotificationPreference, day: number) {
    const days = preference.days.includes(day) ? preference.days.filter((item) => item !== day) : [...preference.days, day].sort()
    if (days.length) updatePreference(preference.type, { days })
  }
  async function save() {
    setSaving(true); setError('')
    try { await notificationService.save(userId, settings); setNotice('Preferências salvas. Seus horários já estão atualizados.') }
    catch (reason) { setError(message(reason)) }
    finally { setSaving(false) }
  }
  function pauseFor(value: string) {
    if (value === 'resume') { setSettings((current) => ({ ...current, pausedUntil: null })); return }
    const date = new Date()
    if (value === '1h') date.setHours(date.getHours() + 1)
    if (value === 'tomorrow') { date.setDate(date.getDate() + 1); date.setHours(8, 0, 0, 0) }
    if (value === 'week') date.setDate(date.getDate() + 7)
    setSettings((current) => ({ ...current, pausedUntil: date.toISOString() }))
  }
  async function markRead(item: AppNotification) {
    const readAt = item.readAt ? null : new Date().toISOString()
    setNotifications((current) => current.map((notification) => notification.id === item.id ? { ...notification, readAt } : notification))
    try { await notificationService.markRead(userId, item.id, Boolean(readAt)) } catch (reason) { setError(message(reason)) }
  }
  async function markAll() {
    const readAt = new Date().toISOString(); setNotifications((current) => current.map((item) => ({ ...item, readAt })))
    try { await notificationService.markAllRead(userId) } catch (reason) { setError(message(reason)) }
  }
  async function enablePush() {
    setError('')
    try {
      const result = await notificationService.enablePush(userId)
      setNotice(result === 'enabled' ? 'Notificações push ativadas neste dispositivo.' : result === 'configured' ? 'Permissão concedida. O envio push será ativado assim que a chave do servidor for configurada.' : 'Este navegador não permitiu notificações push.')
    } catch (reason) { setError(message(reason)) }
  }

  if (loading) return <div className="notification-loading"><div /><div /></div>
  return <section className="notifications-page">
    <div className="page-heading notification-hero">
      <div><p>LEMBRETES INTELIGENTES</p><h1>No momento certo, sem exagero.</h1><span>Você controla o que recebe. O período de silêncio sempre tem prioridade.</span></div>
      <div className="notification-hero__status"><span><BellRing size={22} /></span><div><small>ATIVOS AGORA</small><strong>{activeCount} de 7 lembretes</strong></div></div>
    </div>

    {error && <div className="notification-alert is-error"><TriangleAlert size={17} />{error}</div>}
    {notice && <div className="notification-alert is-success"><Check size={17} />{notice}</div>}

    <div className="notification-layout">
      <div className="notification-settings-column">
        <Card className="notification-control-card">
          <div className="notification-section-heading"><div><small>CONTROLE GERAL</small><h2>Pausa e silêncio</h2></div><span className={settings.pausedUntil ? 'is-paused' : ''}>{settings.pausedUntil ? 'Pausadas' : 'Em funcionamento'}</span></div>
          <div className="notification-global-controls">
            <label><span><Pause size={15} />Pausar notificações</span><select value={settings.pausedUntil ? 'paused' : 'resume'} onChange={(event) => pauseFor(event.target.value)}><option value="resume">Não pausar</option>{settings.pausedUntil && <option value="paused" disabled>Até {formatShort(settings.pausedUntil)}</option>}<option value="1h">Por 1 hora</option><option value="tomorrow">Até amanhã</option><option value="week">Por 1 semana</option></select></label>
            <div className="quiet-control"><span><Clock3 size={15} />Período de silêncio</span><label>De <input type="time" value={settings.quietStart} onChange={(event) => setSettings({ ...settings, quietStart: event.target.value })} /></label><label>até <input type="time" value={settings.quietEnd} onChange={(event) => setSettings({ ...settings, quietEnd: event.target.value })} /></label></div>
          </div>
          <p className="notification-limit-note"><Bell size={14} />O MOVELYA agrupa alertas próximos, bloqueia envios no silêncio e mantém pelo menos 1 hora entre notificações repetidas.</p>
        </Card>

        <div className="notification-preference-list">
          {settings.preferences.map((preference) => {
            const content = notificationContent[preference.type], Icon = content.icon
            return <Card className={`notification-preference ${preference.enabled ? 'is-enabled' : ''}`} key={preference.type}>
              <div className="notification-preference__top"><span className={`tone-${content.tone}`}><Icon size={19} /></span><div><h3>{content.title}</h3><p>{content.description}</p></div><label className="notification-switch"><input type="checkbox" checked={preference.enabled} onChange={() => updatePreference(preference.type, { enabled: !preference.enabled })} aria-label={`Ativar ${content.title}`} /><b /></label></div>
              {preference.enabled && <div className="notification-preference__controls">
                <label><small>HORÁRIO INICIAL</small><input type="time" value={preference.time} onChange={(event) => updatePreference(preference.type, { time: event.target.value })} /></label>
                <label><small>INTERVALO</small><select value={preference.intervalMinutes ?? 0} onChange={(event) => updatePreference(preference.type, { intervalMinutes: Number(event.target.value) || null })}><option value="0">Uma vez</option><option value="60">A cada 1 hora</option><option value="120">A cada 2 horas</option><option value="180">A cada 3 horas</option><option value="240">A cada 4 horas</option></select></label>
                <div className="day-picker"><small>DIAS</small><div>{dayLabels.map((label, day) => <button type="button" className={preference.days.includes(day) ? 'is-active' : ''} onClick={() => toggleDay(preference, day)} key={day} aria-label={`${label}, dia ${day + 1}`}>{label}</button>)}</div></div>
              </div>}
            </Card>
          })}
        </div>
        <div className="notification-save-bar"><span>As alterações só entram em vigor depois de salvar.</span><Button onClick={() => void save()} disabled={saving}>{saving ? 'Salvando…' : 'Salvar preferências'}</Button></div>
      </div>

      <aside className="notification-center-column">
        <Card className="notification-center">
          <div className="notification-section-heading"><div><small>CENTRAL</small><h2>Notificações</h2></div>{unread > 0 && <button onClick={() => void markAll()}><CheckCheck size={14} />Marcar lidas</button>}</div>
          <p className="notification-center__summary">{unread ? `${unread} ${unread === 1 ? 'mensagem não lida' : 'mensagens não lidas'}` : 'Tudo em dia por aqui'}</p>
          <div className="notification-feed">{notifications.length ? notifications.map((item) => { const content = notificationContent[item.type], Icon = content.icon; return <article className={!item.readAt ? 'is-unread' : ''} key={item.id}><button className="notification-feed__main" onClick={() => void markRead(item)}><span className={`tone-${content.tone}`}><Icon size={16} /></span><div><strong>{item.title}</strong><p>{item.message}</p><time>{formatRelative(item.createdAt)}</time></div>{!item.readAt && <i />}</button><button className="notification-feed__action" onClick={() => onNavigate(item.actionPath)}>{item.actionLabel}<ChevronRight size={14} /></button></article> }) : <div className="notification-empty"><Bell size={26} /><strong>Nenhuma notificação</strong><p>Seus lembretes e resumos aparecerão aqui.</p></div>}</div>
        </Card>
        <Card className="push-card"><span><BellRing size={20} /></span><div><small>PWA</small><h3>Receba mesmo com o app fechado</h3><p>Ative a permissão neste dispositivo. Seus horários e o período de silêncio continuarão valendo.</p><Button variant="secondary" onClick={() => void enablePush()}>Ativar push neste dispositivo</Button></div></Card>
      </aside>
    </div>
  </section>
}

function formatRelative(value: string) { const diff = Date.now() - new Date(value).getTime(); const hours = Math.floor(diff / 3600000); if (hours < 1) return 'Há poucos minutos'; if (hours < 24) return `Há ${hours} ${hours === 1 ? 'hora' : 'horas'}`; return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function formatShort(value: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function message(error: unknown) { return error instanceof Error ? error.message : 'Não foi possível concluir esta ação.' }

