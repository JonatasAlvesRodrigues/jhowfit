import { useEffect, useMemo, useState } from 'react'
import { Activity, CalendarDays, Check, ChevronDown, Clock3, Droplets, Dumbbell, Flame, Footprints, Gauge, Info, Medal, RefreshCw, Scale, Sparkles, TrendingDown, TrendingUp, Trophy, Utensils } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { currentWeekStart, reportWeekOptions, toLocalDate, weeklyReportService, type WeeklyReport } from '../services/weeklyReportService'

type Props = { userId: string }

export function WeeklyReportPage({ userId }: Props) {
  const options = useMemo(() => reportWeekOptions(), [])
  const [weekStart, setWeekStart] = useState(currentWeekStart())
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [previous, setPrevious] = useState<WeeklyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    const previousStart = new Date(`${weekStart}T00:00:00`); previousStart.setDate(previousStart.getDate() - 7)
    Promise.all([weeklyReportService.getWeek(userId, weekStart), weeklyReportService.getWeek(userId, toLocalDate(previousStart))])
      .then(([current, prior]) => { if (active) { setReport(current); setPrevious(prior) } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o relatório.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [userId, weekStart, retryKey])

  if (loading) return <ReportState loading />
  if (error || !report || !previous) return <ReportState message={error} onRetry={() => setRetryKey((value) => value + 1)} />

  const completion = report.planned ? Math.min(100, Math.round(report.completed / report.planned * 100)) : 0
  const bestSteps = report.daily.reduce((best, day) => day.steps > best.steps ? day : best, report.daily[0])
  const weightDelta = report.weightStart !== null && report.weightEnd !== null ? report.weightEnd - report.weightStart : null
  const formatPeriod = (start: string) => {
    const date = new Date(`${start}T00:00:00`); const end = new Date(date); end.setDate(end.getDate() + 6)
    return `${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date)} — ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(end)}`
  }

  return <section className="weekly-report">
    <header className="report-hero"><div><small>RELATÓRIO SEMANAL</small><h1>Seu progresso em uma semana</h1><p>Dados calculados a partir dos registros vinculados ao seu perfil.</p></div><label className="week-picker"><span>Período</span><CalendarDays size={17}/><select value={weekStart} onChange={(event) => setWeekStart(event.target.value)} aria-label="Selecionar semana">{options.map((start) => <option key={start} value={start}>{formatPeriod(start)}</option>)}</select><ChevronDown size={15}/></label></header>

    {!report.hasData && <div className="report-empty-banner"><Info size={20}/><div><strong>Sem registros nesta semana</strong><p>Os indicadores permanecerão zerados até que você registre treinos, refeições, água, passos ou peso.</p></div></div>}

    <div className="report-summary">
      <article className="report-card report-card--completion"><div className="report-card__heading"><span><Dumbbell size={18}/></span><small>TREINOS</small></div><div className="completion-row"><div><strong>{report.completed}<em> / {report.planned}</em></strong><p>treinos concluídos</p><Delta current={report.completed} previous={previous.completed}/></div><div className="report-ring" style={{ '--progress': `${completion * 3.6}deg` } as React.CSSProperties}><span>{completion}%</span></div></div><div className="plan-track"><i style={{ width: `${completion}%` }}/></div><small>{report.planned ? `${Math.max(0, report.planned - report.completed)} treino(s) planejado(s) não concluído(s)` : 'Nenhum treino planejado para o período'}</small></article>
      <Metric icon={<Clock3/>} label="Duração total" value={formatDuration(report.duration)} delta={<Delta current={report.duration} previous={previous.duration}/>}/>
      <Metric icon={<Gauge/>} label="Volume de treino" value={report.volume ? `${(report.volume / 1000).toFixed(1).replace('.', ',')} mil kg` : '0 kg'} delta={<Delta current={report.volume} previous={previous.volume}/>}/>
      <Metric icon={<Trophy/>} label="Metas atingidas" value={String(report.goals)} detail="metas concluídas" delta={<span className="report-delta is-positive"><Check size={12}/> no período</span>}/>
    </div>

    <div className="report-metrics-grid">
      <Metric icon={<Footprints/>} label="Média de passos" value={report.steps.toLocaleString('pt-BR')} detail="por dia" delta={<Delta current={report.steps} previous={previous.steps}/>}/>
      <Metric icon={<Activity/>} label="Distância" value={`${report.distance.toFixed(1).replace('.', ',')} km`} detail="na semana" delta={<Delta current={report.distance} previous={previous.distance}/>}/>
      <Metric icon={<Droplets/>} label="Consumo de água" value={`${report.water.toFixed(1).replace('.', ',')} L`} detail="média diária" delta={<Delta current={report.water} previous={previous.water}/>} color="blue"/>
      <Metric icon={<Flame/>} label="Média de calorias" value={`${Math.round(report.calories).toLocaleString('pt-BR')} kcal`} detail="por dia" delta={<Delta current={report.calories} previous={previous.calories} inverse/>} color="orange"/>
      <Metric icon={<Utensils/>} label="Média de proteína" value={`${Math.round(report.protein)} g`} detail="por dia" delta={<Delta current={report.protein} previous={previous.protein}/>} color="purple"/>
    </div>

    <div className="report-charts-grid">
      <article className="report-panel report-panel--wide"><PanelTitle eyebrow="ATIVIDADE DIÁRIA" title="Passos e treinos" note="Registros do perfil"/><div className="report-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.daily}><CartesianGrid stroke="#202a24" vertical={false}/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#718078', fontSize: 10 }}/><YAxis hide/><Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [Number(value).toLocaleString('pt-BR'), name === 'steps' ? 'Passos' : 'Minutos']}/><Bar dataKey="steps" radius={[7,7,2,2]}>{report.daily.map((day) => <Cell key={day.date} fill={day.steps ? '#27d68f' : '#26322b'}/>)}</Bar><Bar dataKey="duration" fill="#af8cff" radius={[7,7,2,2]}/></BarChart></ResponsiveContainer></div><div className="chart-legend"><span><i className="green"/> Passos</span><span><i className="purple"/> Duração do treino</span></div></article>
      <article className="report-panel"><PanelTitle eyebrow="EVOLUÇÃO DE PESO" title={report.weightEnd !== null ? `${report.weightEnd.toFixed(1).replace('.', ',')} kg` : 'Sem registro'} note={weightDelta !== null ? `${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1).replace('.', ',')} kg na semana` : 'Registre seu peso para acompanhar'}/><div className="report-chart report-chart--weight"><ResponsiveContainer width="100%" height="100%"><AreaChart data={weightChart(report)}><defs><linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#27d68f" stopOpacity={.3}/><stop offset="1" stopColor="#27d68f" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#718078', fontSize: 9 }}/><YAxis hide domain={['dataMin - 0.3','dataMax + 0.3']}/><Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toFixed(1).replace('.', ',')} kg`, 'Peso']}/><Area dataKey="value" type="monotone" stroke="#27d68f" strokeWidth={2.5} fill="url(#weightFill)" connectNulls/></AreaChart></ResponsiveContainer></div><div className="weight-comparison"><span>Início <b>{formatWeight(report.weightStart)}</b></span>{weightDelta !== null && weightDelta <= 0 ? <TrendingDown size={17}/> : <TrendingUp size={17}/>}<span>Final <b>{formatWeight(report.weightEnd)}</b></span></div></article>
    </div>

    <section className="report-section"><div className="report-section__title"><span><Sparkles size={19}/></span><div><small>CONQUISTAS</small><h2>Destaques da semana</h2></div></div><div className="highlights-grid"><Highlight icon={<Footprints/>} label="Melhor dia de passos" value={bestSteps.steps ? `${bestSteps.day} · ${bestSteps.steps.toLocaleString('pt-BR')}` : 'Sem registro'}/><Highlight icon={<Clock3/>} label="Maior treino" value={report.largestWorkout ? `${report.largestWorkout.name} · ${report.largestWorkout.minutes} min` : 'Sem registro'}/><Highlight icon={<Trophy/>} label="Recorde de carga" value={report.loadRecord ? `${report.loadRecord.name} · ${report.loadRecord.weight.toLocaleString('pt-BR')} kg` : 'Sem registro'}/><Highlight icon={<Medal/>} label="Consistência" value={report.completed ? `${report.completed} treino(s) concluído(s)` : 'Sem treino concluído'}/><Highlight icon={<Scale/>} label="Evolução de peso" value={weightDelta !== null ? `${Math.abs(weightDelta).toFixed(1).replace('.', ',')} kg no período` : 'Sem registros suficientes'}/></div></section>

    <Attention report={report}/>
  </section>
}

function Delta({ current, previous, inverse = false }: { current: number; previous: number; inverse?: boolean }) { if (!previous) return <span className="report-delta">Sem base anterior</span>; const delta = (current - previous) / previous * 100; const positive = inverse ? delta <= 0 : delta >= 0; return <span className={`report-delta ${positive ? 'is-positive' : 'is-neutral'}`}>{delta >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>} {Math.abs(delta).toFixed(0)}% vs. anterior</span> }
function Metric({ icon, label, value, detail, delta, color = 'green' }: { icon: React.ReactNode; label: string; value: string; detail?: string; delta: React.ReactNode; color?: string }) { return <article className={`report-card report-metric report-metric--${color}`}><div className="report-card__heading"><span>{icon}</span><small>{label}</small></div><strong>{value}</strong>{detail && <p>{detail}</p>}<div>{delta}</div></article> }
function PanelTitle({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) { return <div className="report-panel__title"><div><small>{eyebrow}</small><h2>{title}</h2></div><span>{note}</span></div> }
function Highlight({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <article className="highlight-card"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article> }
function Attention({ report }: { report: WeeklyReport }) { const points: string[] = []; if (report.water > 0 && report.water < 2) points.push('A média de hidratação ficou abaixo de 2 L. Manter uma garrafa por perto pode ajudar.'); if (report.planned > report.completed) points.push(`${report.planned - report.completed} treino(s) planejado(s) não foi(ram) concluído(s). Ajustar os dias pode deixar a rotina mais confortável.`); if (report.steps > 0 && report.steps < 5000) points.push('A média de passos ficou abaixo de 5.000. Uma caminhada leve pode ser uma opção, se fizer sentido para você.'); if (!points.length) points.push(report.hasData ? 'Seus registros não indicam pontos urgentes nesta semana. Continue observando como você se sente.' : 'Registre sua rotina para receber observações personalizadas nesta seção.'); return <section className="attention-section"><div className="attention-copy"><span><Info size={20}/></span><div><small>PARA A PRÓXIMA SEMANA</small><h2>Pontos de atenção</h2><p>Sugestões baseadas apenas nos seus registros.</p></div></div><div className="attention-items">{points.map((point) => <p key={point}><i/>{point}</p>)}</div></section> }
function ReportState({ loading, message, onRetry }: { loading?: boolean; message?: string; onRetry?: () => void }) { return <section className="dashboard-state"><span>{loading ? <RefreshCw className="spin" size={24}/> : <Info size={24}/>}</span><small>{loading ? 'CARREGANDO RELATÓRIO' : 'RELATÓRIO INDISPONÍVEL'}</small><h1>{loading ? 'Reunindo seus registros…' : 'Não foi possível carregar a semana.'}</h1>{message && <p>{message}</p>}{onRetry && <button className="vita-primary-button" onClick={onRetry}><RefreshCw size={16}/> Tentar novamente</button>}</section> }
function formatDuration(minutes: number) { return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}min` : `${minutes} min` }
function formatWeight(value: number | null) { return value === null ? '—' : `${value.toFixed(1).replace('.', ',')} kg` }
function weightChart(report: WeeklyReport) { if (report.weightStart === null && report.weightEnd === null) return []; return [{ day: 'Início', value: report.weightStart }, { day: 'Final', value: report.weightEnd }] }
const tooltipStyle = { background: '#151c18', border: '1px solid #2b3931', borderRadius: 12, fontSize: 11 }
