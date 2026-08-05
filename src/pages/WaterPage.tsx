import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { Bell, BellRing, Check, Clock3, Droplets, Edit3, GlassWater, History, Minus, Plus, RotateCcw, Settings2, Trash2, TriangleAlert } from 'lucide-react'
import { Button, Card, Field, Modal, Progress } from '../components/ui'
import { waterService, type WaterData, type WaterLog, type WaterSettings } from '../services/waterService'
import '../water.css'

export function WaterPage({ userId }: { userId: string }) {
  const [data, setData] = useState<WaterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [editing, setEditing] = useState<WaterLog | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editTime, setEditTime] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<WaterSettings>({ dailyGoalMl: 2500, remindersEnabled: false, reminderTimes: [] })

  async function load() { setLoading(true); setError(''); try { setData(await waterService.getData(userId)) } catch (requestError) { setError(message(requestError)) } finally { setLoading(false) } }
  useEffect(() => { void load() }, [userId])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3000); return () => clearTimeout(timer) }, [toast])

  useEffect(() => {
    if (!data?.settings.remindersEnabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const notify = () => { const now = new Date(); const time = now.toTimeString().slice(0, 5); if (!data.settings.reminderTimes.includes(time)) return; const key = `movelya-water-${localDate()}-${time}`; if (sessionStorage.getItem(key)) return; new Notification('Hora de beber água', { body: 'Este é o lembrete que você configurou no MOVELYA.' }); sessionStorage.setItem(key, '1') }
    notify(); const timer = window.setInterval(notify, 30000); return () => window.clearInterval(timer)
  }, [data?.settings])

  const consumed = data?.logs.reduce((sum, log) => sum + log.amountMl, 0) ?? 0
  const goal = data?.settings.dailyGoalMl ?? 2500
  const percentage = goal > 0 ? Math.round(consumed / goal * 100) : 0
  const weeklyAverage = useMemo(() => Math.round((data?.week.reduce((sum, day) => sum + day.totalMl, 0) ?? 0) / 7), [data?.week])

  async function add(amount: number) { setError(''); try { await waterService.add(userId, amount); setToast(`${amount} ml adicionados.`); setCustomOpen(false); setCustomAmount(''); await load() } catch (requestError) { setError(message(requestError)) } }
  async function undo() { const latest = data?.logs[0]; if (!latest) return; try { await waterService.remove(userId, latest); setToast(`Último registro de ${latest.amountMl} ml desfeito.`); await load() } catch (requestError) { setError(message(requestError)) } }
  async function remove(log: WaterLog) { try { await waterService.remove(userId, log); setToast('Registro removido.'); await load() } catch (requestError) { setError(message(requestError)) } }
  async function saveEdit(event: FormEvent) { event.preventDefault(); if (!editing) return; const date = new Date(editing.occurredAt); const [hours, minutes] = editTime.split(':').map(Number); date.setHours(hours, minutes, 0, 0); try { await waterService.update(userId, editing, Number(editAmount), date.toISOString()); setEditing(null); setToast('Registro atualizado.'); await load() } catch (requestError) { setError(message(requestError)) } }
  async function saveSettings(event: FormEvent) { event.preventDefault(); try { let next = settingsDraft; if (next.remindersEnabled && typeof Notification !== 'undefined' && Notification.permission === 'default') { const permission = await Notification.requestPermission(); if (permission !== 'granted') { next = { ...next, remindersEnabled: false }; setToast('Lembretes salvos desativados porque as notificações não foram permitidas.') } } await waterService.saveSettings(userId, next); setSettingsOpen(false); await load(); if (!toast) setToast('Meta e lembretes atualizados.') } catch (requestError) { setError(message(requestError)) } }
  function openSettings() { if (!data) return; setSettingsDraft({ ...data.settings, reminderTimes: [...data.settings.reminderTimes] }); setSettingsOpen(true) }
  function openEdit(log: WaterLog) { setEditing(log); setEditAmount(String(log.amountMl)); setEditTime(new Date(log.occurredAt).toTimeString().slice(0, 5)) }

  if (loading) return <div className="water-loading"><div /><div /><div /></div>
  return <section className="water-page">
    <div className="page-heading water-hero"><div><p>CONTROLE DE ÁGUA</p><h1>Hidratação no seu ritmo.</h1><span>Registre o que beber e acompanhe sua meta pessoal ao longo do dia.</span></div><Button variant="secondary" onClick={openSettings}><Settings2 size={17} /> Meta e lembretes</Button></div>
    {error && <div className="nutrition-alert"><TriangleAlert size={17} />{error}</div>}{toast && <div className="nutrition-toast"><Check size={16} />{toast}</div>}

    <div className="water-summary-grid">
      <Card className="water-progress-card"><div className="water-progress-ring" style={{ '--water-progress': `${Math.min(percentage, 100)}%` } as CSSProperties}><div><Droplets size={24} /><strong>{percentage}%</strong><small>da meta pessoal</small></div></div><div className="water-progress-copy"><small>CONSUMO DE HOJE</small><h2>{formatLiters(consumed)} <span>/ {formatLiters(goal)}</span></h2><Progress value={percentage} color="blue" /><p>{consumed >= goal ? 'Meta pessoal alcançada hoje.' : `Faltam ${formatMl(goal - consumed)} para sua meta.`}</p></div></Card>
      <Card className="water-stat"><span><GlassWater size={20} /></span><small>CONSUMIDO</small><strong>{formatLiters(consumed)}</strong><p>{data?.logs.length ?? 0} registro(s) hoje</p></Card>
      <Card className="water-stat"><span><History size={20} /></span><small>MÉDIA SEMANAL</small><strong>{formatLiters(weeklyAverage)}</strong><p>média diária dos últimos 7 dias</p></Card>
    </div>

    <Card className="water-quick"><div><small>REGISTRO RÁPIDO</small><h2>Adicionar água</h2></div><div className="water-quick-actions"><button onClick={() => void add(200)}><Plus size={15} /><b>200</b> ml</button><button onClick={() => void add(300)}><Plus size={15} /><b>300</b> ml</button><button onClick={() => void add(500)}><Plus size={15} /><b>500</b> ml</button><button onClick={() => setCustomOpen(true)}><Edit3 size={15} /> Personalizada</button></div></Card>

    <div className="water-layout">
      <Card className="water-history"><div className="water-panel-heading"><div><small>HISTÓRICO DO DIA</small><h2>Seus registros</h2></div><Button variant="secondary" disabled={!data?.logs.length} onClick={() => void undo()}><RotateCcw size={15} /> Desfazer último</Button></div><div className="water-log-list">{data?.logs.map((log) => <article key={log.id}><span><Droplets size={17} /></span><div><strong>{log.amountMl} ml</strong><small><Clock3 size={12} /> {formatTime(log.occurredAt)}</small></div><button onClick={() => openEdit(log)} aria-label="Editar registro"><Edit3 size={15} /></button><button onClick={() => void remove(log)} aria-label="Remover registro"><Trash2 size={15} /></button></article>)}{!data?.logs.length && <div className="water-empty"><GlassWater size={28} /><strong>Nenhum registro hoje</strong><p>Use um dos botões rápidos para começar.</p></div>}</div></Card>
      <Card className="water-weekly"><div className="water-panel-heading"><div><small>ÚLTIMOS 7 DIAS</small><h2>Média de água</h2></div><span>{formatLiters(weeklyAverage)}/dia</span></div><div className="water-chart">{data?.week.map((day) => { const height = Math.max(day.totalMl / Math.max(goal, 1) * 100, day.totalMl ? 6 : 2); return <div key={day.date}><span><i style={{ height: `${Math.min(height, 120)}%` }} /></span><b>{day.totalMl ? `${(day.totalMl / 1000).toFixed(1)}L` : '—'}</b><small>{weekday(day.date)}</small></div> })}</div><div className="water-goal-legend"><i /> Meta pessoal atual: {formatLiters(goal)}</div></Card>
    </div>

    <div className="water-disclaimer"><TriangleAlert size={18} /><p><strong>Uma referência pessoal, não uma prescrição.</strong> A meta exibida é configurada por você e não representa recomendação médica definitiva. Necessidades de hidratação variam; procure orientação profissional quando necessário.</p></div>

    {customOpen && <Modal title="Quantidade personalizada" onClose={() => setCustomOpen(false)}><form className="nutrition-modal-form" onSubmit={(event) => { event.preventDefault(); void add(Number(customAmount)) }}><Field autoFocus required label="Quantidade (ml)" type="number" min="1" max="10000" step="1" value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} placeholder="Ex.: 750" /><div className="nutrition-modal-actions"><Button variant="secondary" type="button" onClick={() => setCustomOpen(false)}>Cancelar</Button><Button type="submit"><Plus size={15} /> Adicionar</Button></div></form></Modal>}
    {editing && <Modal title="Editar registro" onClose={() => setEditing(null)}><form className="nutrition-modal-form" onSubmit={saveEdit}><div className="nutrition-modal-grid"><Field required label="Quantidade (ml)" type="number" min="1" max="10000" value={editAmount} onChange={(event) => setEditAmount(event.target.value)} /><Field required label="Horário" type="time" value={editTime} onChange={(event) => setEditTime(event.target.value)} /></div><div className="nutrition-modal-actions"><Button variant="secondary" type="button" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit">Salvar alterações</Button></div></form></Modal>}
    {settingsOpen && <Modal title="Meta e lembretes" onClose={() => setSettingsOpen(false)}><form className="nutrition-modal-form" onSubmit={saveSettings}><Field required label="Meta pessoal diária (ml)" type="number" min="250" max="15000" step="50" value={settingsDraft.dailyGoalMl} onChange={(event) => setSettingsDraft((current) => ({ ...current, dailyGoalMl: Number(event.target.value) }))} /><label className="water-reminder-toggle"><span><BellRing size={18} /><div><strong>Ativar lembretes</strong><small>As notificações funcionam enquanto o navegador permitir.</small></div></span><input type="checkbox" checked={settingsDraft.remindersEnabled} onChange={(event) => setSettingsDraft((current) => ({ ...current, remindersEnabled: event.target.checked }))} /></label>{settingsDraft.remindersEnabled && <ReminderTimes value={settingsDraft.reminderTimes} onChange={(reminderTimes) => setSettingsDraft((current) => ({ ...current, reminderTimes }))} />}<div className="water-settings-note"><Bell size={15} /> Você pode alterar ou desativar os horários quando quiser.</div><div className="nutrition-modal-actions"><Button variant="secondary" type="button" onClick={() => setSettingsOpen(false)}>Cancelar</Button><Button type="submit">Salvar preferências</Button></div></form></Modal>}
  </section>
}

function ReminderTimes({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) { const [time, setTime] = useState('09:00'); return <div className="water-reminder-times"><span>Horários dos lembretes</span><div>{value.map((item) => <button type="button" key={item} onClick={() => onChange(value.filter((current) => current !== item))}>{item}<Minus size={12} /></button>)}</div><label><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /><Button variant="secondary" type="button" onClick={() => { if (time && !value.includes(time)) onChange([...value, time].sort()) }}><Plus size={14} /> Adicionar horário</Button></label></div> }
function message(error: unknown) { return error instanceof Error ? error.message : 'Não foi possível concluir esta ação.' }
function formatLiters(ml: number) { return `${(Math.max(ml, 0) / 1000).toFixed(2).replace('.', ',')} L` }
function formatMl(ml: number) { return ml >= 1000 ? formatLiters(ml) : `${Math.max(Math.round(ml), 0)} ml` }
function formatTime(value: string) { return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function weekday(date: string) { return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)).replace('.', '') }
function localDate() { const date = new Date(); const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 10) }
