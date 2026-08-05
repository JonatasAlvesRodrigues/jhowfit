import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { CalendarDays, Check, Clock3, Edit3, Flame, Footprints, Gauge, Medal, Play, Plus, Route, Settings2, Target, Trash2, TriangleAlert } from 'lucide-react'
import { Button, Card, Field, Modal, Progress } from '../components/ui'
import { OutdoorActivityTracker } from '../components/OutdoorActivityTracker'
import { localDate, stepService, type StepData, type StepRecord, type StepRecordInput } from '../services/stepService'
import '../steps.css'

const emptyForm = (): StepRecordInput => ({ steps: 0, distanceKm: 0, durationMinutes: 0, calories: 0, occurredOn: localDate() })

export function StepsPage({ userId }: { userId: string }) {
  const [data, setData] = useState<StepData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<StepRecord | null>(null)
  const [draft, setDraft] = useState<StepRecordInput>(emptyForm)
  const [goalOpen, setGoalOpen] = useState(false)
  const [goalDraft, setGoalDraft] = useState('10000')
  const [saving, setSaving] = useState(false)
  const [startRequest, setStartRequest] = useState(0)

  async function load() {
    setLoading(true); setError('')
    try { setData(await stepService.getData(userId)) }
    catch (requestError) { setError(message(requestError)) }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [userId])
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3000); return () => window.clearTimeout(timer) }, [toast])

  const today = useMemo(() => data?.week.find((day) => day.date === localDate()) ?? null, [data])
  const percentage = Math.round((today?.steps ?? 0) / Math.max(data?.dailyGoal ?? 10000, 1) * 100)
  const recentRecords = data?.records.slice(0, 12) ?? []

  function openAdd() { setEditing(null); setDraft(emptyForm()); setFormOpen(true) }
  function openEdit(record: StepRecord) {
    setEditing(record)
    setDraft({ steps: record.steps, distanceKm: record.distanceKm, durationMinutes: record.durationMinutes, calories: record.calories, occurredOn: record.occurredOn })
    setFormOpen(true)
  }

  async function saveRecord(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      if (editing) await stepService.update(userId, editing.id, draft)
      else await stepService.add(userId, draft)
      setFormOpen(false); setToast(editing ? 'Registro atualizado.' : 'Passos registrados.'); await load()
    } catch (requestError) { setError(message(requestError)) }
    finally { setSaving(false) }
  }

  async function remove(record: StepRecord) {
    if (!window.confirm(`Remover o registro de ${formatNumber(record.steps)} passos?`)) return
    try { await stepService.remove(userId, record.id); setToast('Registro removido.'); await load() }
    catch (requestError) { setError(message(requestError)) }
  }

  async function saveGoal(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try { await stepService.saveGoal(userId, Number(goalDraft)); setGoalOpen(false); setToast('Meta diária atualizada.'); await load() }
    catch (requestError) { setError(message(requestError)) }
    finally { setSaving(false) }
  }

  function openGoal() { setGoalDraft(String(data?.dailyGoal ?? 10000)); setGoalOpen(true) }

  if (loading) return <div className="steps-loading"><div /><div /><div /><div /></div>

  return <section className="steps-page">
    <div className="page-heading steps-hero">
      <div><p>PASSOS, CAMINHADA E CORRIDA</p><h1>Seu movimento, passo a passo.</h1><span>Registre caminhadas e corridas manualmente e acompanhe sua constância.</span></div>
      <div className="steps-hero-actions"><Button variant="secondary" onClick={openGoal}><Settings2 size={17} /> Meta diária</Button><Button variant="secondary" onClick={openAdd}><Plus size={17} /> Registrar passos</Button><Button onClick={() => setStartRequest((value) => value + 1)}><Play size={17} fill="currentColor" /> Iniciar atividade</Button></div>
    </div>

    {error && <div className="nutrition-alert"><TriangleAlert size={17} />{error}</div>}
    {toast && <div className="nutrition-toast"><Check size={16} />{toast}</div>}

    <OutdoorActivityTracker userId={userId} startRequest={startRequest} />

    <div className="steps-summary-grid">
      <Card className="steps-progress-card">
        <div className="steps-progress-ring" style={{ '--steps-progress': `${Math.min(percentage, 100)}%` } as CSSProperties}><div><Footprints size={25} /><strong>{percentage}%</strong><small>DA META</small></div></div>
        <div className="steps-progress-copy"><small>PASSOS DE HOJE</small><h2>{formatNumber(today?.steps ?? 0)} <span>/ {formatNumber(data?.dailyGoal ?? 10000)}</span></h2><Progress value={percentage} /><p>{percentage >= 100 ? 'Meta diária atingida. Continue no seu ritmo!' : `Faltam ${formatNumber(Math.max((data?.dailyGoal ?? 10000) - (today?.steps ?? 0), 0))} passos para a meta.`}</p></div>
      </Card>
      <Stat icon={<Gauge size={20} />} label="MÉDIA SEMANAL" value={formatNumber(data?.weeklyAverage ?? 0)} caption="passos por dia" />
      <Stat icon={<Medal size={20} />} label="MELHOR DIA" value={formatNumber(data?.bestDay?.steps ?? 0)} caption={data?.bestDay ? formatDate(data.bestDay.date) : 'nenhum registro'} />
      <Stat icon={<Flame size={20} />} label="SEQUÊNCIA" value={`${data?.goalStreak ?? 0} ${(data?.goalStreak ?? 0) === 1 ? 'dia' : 'dias'}`} caption="com a meta atingida" />
    </div>

    <div className="steps-detail-strip">
      <span><Route size={17} /><div><small>DISTÂNCIA HOJE</small><strong>{formatDistance(today?.distanceKm ?? 0)}</strong></div></span>
      <span><Clock3 size={17} /><div><small>TEMPO EM MOVIMENTO</small><strong>{formatDuration(today?.durationMinutes ?? 0)}</strong></div></span>
      <span><Flame size={17} /><div><small>CALORIAS ESTIMADAS</small><strong>{formatNumber(Math.round(today?.calories ?? 0))} kcal</strong></div></span>
    </div>

    <div className="steps-layout">
      <Card className="steps-weekly">
        <div className="steps-panel-heading"><div><small>ÚLTIMOS SETE DIAS</small><h2>Ritmo semanal</h2></div><span><Target size={13} /> meta {formatNumber(data?.dailyGoal ?? 10000)}</span></div>
        <div className="steps-chart" role="img" aria-label="Gráfico de passos dos últimos sete dias">
          {data?.week.map((day) => { const ratio = day.steps / Math.max(data.dailyGoal, 1); return <div key={day.date} className={day.date === localDate() ? 'is-today' : ''}><b>{day.steps ? compactNumber(day.steps) : '—'}</b><span><i style={{ height: `${Math.max(Math.min(ratio * 100, 100), day.steps ? 5 : 2)}%` }} className={ratio >= 1 ? 'hit-goal' : ''} /></span><small>{weekday(day.date)}</small></div> })}
        </div>
        <div className="steps-chart-legend"><i /> Meta diária <span>As barras verdes indicam metas atingidas.</span></div>
      </Card>

      <Card className="steps-history">
        <div className="steps-panel-heading"><div><small>REGISTROS RECENTES</small><h2>Histórico de movimento</h2></div><Button variant="secondary" onClick={openAdd}><Plus size={15} /> Novo</Button></div>
        <div className="steps-record-list">
          {recentRecords.map((record) => <article key={record.id}><span><Footprints size={17} /></span><div><strong>{formatNumber(record.steps)} passos {record.source !== 'manual' && <em>{record.source === 'apple_health' ? 'Apple Health' : 'Health Connect'}</em>}</strong><small><CalendarDays size={12} /> {formatDate(record.occurredOn)} · {formatDistance(record.distanceKm)} · {formatDuration(record.durationMinutes)}</small></div><b>{formatNumber(Math.round(record.calories))} kcal</b>{record.source === 'manual' ? <><button onClick={() => openEdit(record)} aria-label="Editar registro"><Edit3 size={15} /></button><button onClick={() => void remove(record)} aria-label="Remover registro"><Trash2 size={15} /></button></> : <span className="steps-synced-lock" title="Registro sincronizado"><Check size={14} /></span>}</article>)}
          {!recentRecords.length && <div className="steps-empty"><Footprints size={30} /><strong>Nenhum passo registrado</strong><p>Adicione sua primeira caminhada ou corrida.</p><Button onClick={openAdd}><Plus size={15} /> Registrar agora</Button></div>}
        </div>
      </Card>
    </div>

    <div className="steps-integration-note"><span><Route size={18} /></span><div><strong>Apple Health e Health Connect</strong><p>Registros importados aparecem automaticamente aqui e são protegidos contra duplicação. A conexão é opcional e pode ser controlada em Configurações.</p></div></div>

    {formOpen && <Modal title={editing ? 'Editar registro' : 'Registrar passos'} onClose={() => setFormOpen(false)}><form className="nutrition-modal-form" onSubmit={saveRecord}><div className="steps-form-grid"><Field autoFocus required label="Passos" type="number" min="1" max="200000" step="1" value={draft.steps || ''} onChange={(event) => setDraft({ ...draft, steps: Number(event.target.value) })} placeholder="Ex.: 6500" /><Field required label="Data" type="date" max={localDate()} value={draft.occurredOn} onChange={(event) => setDraft({ ...draft, occurredOn: event.target.value })} /><Field required label="Distância (km)" type="number" min="0" max="300" step="0.01" value={draft.distanceKm} onChange={(event) => setDraft({ ...draft, distanceKm: Number(event.target.value) })} /><Field required label="Tempo (minutos)" type="number" min="0" max="1440" step="1" value={draft.durationMinutes} onChange={(event) => setDraft({ ...draft, durationMinutes: Number(event.target.value) })} /><Field required label="Calorias estimadas (kcal)" type="number" min="0" max="20000" step="1" value={draft.calories} onChange={(event) => setDraft({ ...draft, calories: Number(event.target.value) })} /></div><p className="steps-form-note">Distância e calorias são informadas por você e não representam medição clínica.</p><div className="nutrition-modal-actions"><Button variant="secondary" type="button" onClick={() => setFormOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Registrar passos'}</Button></div></form></Modal>}
    {goalOpen && <Modal title="Definir meta diária" onClose={() => setGoalOpen(false)}><form className="nutrition-modal-form" onSubmit={saveGoal}><Field autoFocus required label="Meta de passos por dia" type="number" min="100" max="100000" step="100" value={goalDraft} onChange={(event) => setGoalDraft(event.target.value)} /><p className="steps-form-note">A meta é pessoal e será usada no progresso diário, no gráfico e no cálculo da sequência.</p><div className="nutrition-modal-actions"><Button variant="secondary" type="button" onClick={() => setGoalOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>Salvar meta</Button></div></form></Modal>}
  </section>
}

function Stat({ icon, label, value, caption }: { icon: React.ReactNode; label: string; value: string; caption: string }) { return <Card className="steps-stat"><span>{icon}</span><small>{label}</small><strong>{value}</strong><p>{caption}</p></Card> }
function message(error: unknown) { return error instanceof Error ? error.message : 'Não foi possível concluir esta ação.' }
function formatNumber(value: number) { return Math.round(value).toLocaleString('pt-BR') }
function compactNumber(value: number) { return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace('.', ',')}k` : String(value) }
function formatDistance(value: number) { return `${value.toLocaleString('pt-BR', { minimumFractionDigits: value ? 1 : 0, maximumFractionDigits: 2 })} km` }
function formatDuration(value: number) { const hours = Math.floor(value / 60); const minutes = Math.round(value % 60); return hours ? `${hours}h ${minutes.toString().padStart(2, '0')}min` : `${minutes} min` }
function formatDate(date: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T12:00:00`)).replace('.', '') }
function weekday(date: string) { return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)).replace('.', '') }
