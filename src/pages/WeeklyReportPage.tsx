import { useMemo, useState } from 'react'
import {
  Activity, CalendarDays, Check, ChevronDown, Clock3, Droplets, Dumbbell,
  Flame, Footprints, Gauge, Info, Medal, Scale, Sparkles, TrendingDown,
  TrendingUp, Trophy, Utensils,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

type WeekReport = {
  id: string
  label: string
  shortLabel: string
  metrics: {
    planned: number; completed: number; duration: number; volume: number
    steps: number; distance: number; water: number; calories: number; protein: number
    weightStart: number; weightEnd: number; goals: number
  }
  previous: { completed: number; duration: number; volume: number; steps: number; distance: number; water: number; calories: number; protein: number }
  daily: Array<{ day: string; steps: number; duration: number; water: number }>
  weight: Array<{ day: string; value: number }>
}

const weeks: WeekReport[] = [
  {
    id: '27-jul', label: '27 jul — 02 ago, 2026', shortLabel: 'Esta semana',
    metrics: { planned: 5, completed: 4, duration: 245, volume: 18420, steps: 9248, distance: 45.6, water: 2.4, calories: 2180, protein: 132, weightStart: 78.4, weightEnd: 77.8, goals: 8 },
    previous: { completed: 3, duration: 198, volume: 16120, steps: 8450, distance: 41.2, water: 2.1, calories: 2260, protein: 119 },
    daily: [
      { day: 'Seg', steps: 8420, duration: 55, water: 2.3 }, { day: 'Ter', steps: 10320, duration: 0, water: 2.6 },
      { day: 'Qua', steps: 11840, duration: 70, water: 2.4 }, { day: 'Qui', steps: 7920, duration: 45, water: 2.1 },
      { day: 'Sex', steps: 12460, duration: 75, water: 2.8 }, { day: 'Sáb', steps: 8610, duration: 0, water: 2.5 },
      { day: 'Dom', steps: 5166, duration: 0, water: 2.1 },
    ],
    weight: [{ day: 'Seg', value: 78.4 }, { day: 'Ter', value: 78.3 }, { day: 'Qua', value: 78.2 }, { day: 'Qui', value: 78.1 }, { day: 'Sex', value: 78.0 }, { day: 'Sáb', value: 77.9 }, { day: 'Dom', value: 77.8 }],
  },
  {
    id: '20-jul', label: '20 — 26 jul, 2026', shortLabel: 'Semana anterior',
    metrics: { planned: 4, completed: 3, duration: 198, volume: 16120, steps: 8450, distance: 41.2, water: 2.1, calories: 2260, protein: 119, weightStart: 78.8, weightEnd: 78.4, goals: 6 },
    previous: { completed: 3, duration: 185, volume: 15200, steps: 8010, distance: 39.1, water: 2.0, calories: 2310, protein: 114 },
    daily: [{ day: 'Seg', steps: 7120, duration: 60, water: 2 }, { day: 'Ter', steps: 9210, duration: 0, water: 2.2 }, { day: 'Qua', steps: 10540, duration: 68, water: 2.3 }, { day: 'Qui', steps: 6840, duration: 0, water: 1.8 }, { day: 'Sex', steps: 11220, duration: 70, water: 2.4 }, { day: 'Sáb', steps: 8030, duration: 0, water: 2.1 }, { day: 'Dom', steps: 6190, duration: 0, water: 1.9 }],
    weight: [{ day: 'Seg', value: 78.8 }, { day: 'Ter', value: 78.8 }, { day: 'Qua', value: 78.7 }, { day: 'Qui', value: 78.6 }, { day: 'Sex', value: 78.6 }, { day: 'Sáb', value: 78.5 }, { day: 'Dom', value: 78.4 }],
  },
  {
    id: '13-jul', label: '13 — 19 jul, 2026', shortLabel: 'Há 2 semanas',
    metrics: { planned: 4, completed: 3, duration: 185, volume: 15200, steps: 8010, distance: 39.1, water: 2, calories: 2310, protein: 114, weightStart: 79.0, weightEnd: 78.8, goals: 5 },
    previous: { completed: 2, duration: 140, volume: 12600, steps: 7350, distance: 35.3, water: 1.8, calories: 2380, protein: 108 },
    daily: [{ day: 'Seg', steps: 6620, duration: 50, water: 1.9 }, { day: 'Ter', steps: 8830, duration: 0, water: 2 }, { day: 'Qua', steps: 9520, duration: 65, water: 2.2 }, { day: 'Qui', steps: 7040, duration: 0, water: 1.8 }, { day: 'Sex', steps: 10410, duration: 70, water: 2.3 }, { day: 'Sáb', steps: 7680, duration: 0, water: 2 }, { day: 'Dom', steps: 5970, duration: 0, water: 1.8 }],
    weight: [{ day: 'Seg', value: 79 }, { day: 'Ter', value: 79 }, { day: 'Qua', value: 78.9 }, { day: 'Qui', value: 78.9 }, { day: 'Sex', value: 78.9 }, { day: 'Sáb', value: 78.8 }, { day: 'Dom', value: 78.8 }],
  },
]

function Delta({ current, previous, inverse = false }: { current: number; previous: number; inverse?: boolean }) {
  const delta = ((current - previous) / previous) * 100
  const positive = inverse ? delta <= 0 : delta >= 0
  return <span className={`report-delta ${positive ? 'is-positive' : 'is-neutral'}`}>{delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{Math.abs(delta).toFixed(0)}% vs. anterior</span>
}

const tooltipStyle = { background: '#151c18', border: '1px solid #2b3931', borderRadius: 12, fontSize: 11 }

export function WeeklyReportPage() {
  const [weekId, setWeekId] = useState(weeks[0].id)
  const report = useMemo(() => weeks.find((week) => week.id === weekId) ?? weeks[0], [weekId])
  const m = report.metrics
  const completion = Math.round((m.completed / m.planned) * 100)
  const bestSteps = report.daily.reduce((best, day) => day.steps > best.steps ? day : best)
  const weightDelta = m.weightEnd - m.weightStart

  return (
    <section className="weekly-report">
      <header className="report-hero">
        <div><small>RELATÓRIO SEMANAL</small><h1>Seu progresso em uma semana</h1><p>Uma visão completa da sua rotina, com comparativos que ajudam você a seguir no seu ritmo.</p></div>
        <label className="week-picker"><span>Período</span><CalendarDays size={17} /><select value={weekId} onChange={(event) => setWeekId(event.target.value)} aria-label="Selecionar semana">{weeks.map((week) => <option key={week.id} value={week.id}>{week.label}</option>)}</select><ChevronDown size={15} /></label>
      </header>

      <div className="report-summary">
        <article className="report-card report-card--completion">
          <div className="report-card__heading"><span><Dumbbell size={18} /></span><small>TREINOS</small></div>
          <div className="completion-row"><div><strong>{m.completed}<em> / {m.planned}</em></strong><p>treinos concluídos</p><Delta current={m.completed} previous={report.previous.completed} /></div><div className="report-ring" style={{ '--progress': `${completion * 3.6}deg` } as React.CSSProperties}><span>{completion}%</span></div></div>
          <div className="plan-track"><i style={{ width: `${completion}%` }} /></div><small>{m.planned - m.completed === 0 ? 'Todos os treinos planejados foram concluídos' : `${m.planned - m.completed} treino planejado ficou para a próxima semana`}</small>
        </article>
        <Metric icon={<Clock3 />} label="Duração total" value={`${Math.floor(m.duration / 60)}h ${m.duration % 60}min`} delta={<Delta current={m.duration} previous={report.previous.duration} />} />
        <Metric icon={<Gauge />} label="Volume de treino" value={`${(m.volume / 1000).toFixed(1).replace('.', ',')} mil kg`} delta={<Delta current={m.volume} previous={report.previous.volume} />} />
        <Metric icon={<Trophy />} label="Metas atingidas" value={`${m.goals} de 10`} delta={<span className="report-delta is-positive"><Check size={12} /> Ótimo ritmo</span>} />
      </div>

      <div className="report-metrics-grid">
        <Metric icon={<Footprints />} label="Média de passos" value={m.steps.toLocaleString('pt-BR')} detail="por dia" delta={<Delta current={m.steps} previous={report.previous.steps} />} />
        <Metric icon={<Activity />} label="Distância" value={`${m.distance.toFixed(1).replace('.', ',')} km`} detail="na semana" delta={<Delta current={m.distance} previous={report.previous.distance} />} />
        <Metric icon={<Droplets />} label="Consumo de água" value={`${m.water.toFixed(1).replace('.', ',')} L`} detail="média diária" delta={<Delta current={m.water} previous={report.previous.water} />} color="blue" />
        <Metric icon={<Flame />} label="Média de calorias" value={`${m.calories.toLocaleString('pt-BR')} kcal`} detail="por dia" delta={<Delta current={m.calories} previous={report.previous.calories} inverse />} color="orange" />
        <Metric icon={<Utensils />} label="Média de proteína" value={`${m.protein} g`} detail="por dia" delta={<Delta current={m.protein} previous={report.previous.protein} />} color="purple" />
      </div>

      <div className="report-charts-grid">
        <article className="report-panel report-panel--wide"><PanelTitle eyebrow="ATIVIDADE DIÁRIA" title="Passos e treinos" note="Meta de 10.000 passos" />
          <div className="report-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.daily} barGap={-18}><CartesianGrid stroke="#202a24" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#718078', fontSize: 10 }} /><YAxis hide /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,.025)' }} formatter={(value, name) => [Number(value).toLocaleString('pt-BR'), name === 'steps' ? 'Passos' : 'Minutos']} /><ReferenceLine y={10000} stroke="#53655b" strokeDasharray="4 4" /><Bar dataKey="steps" radius={[7, 7, 2, 2]}>{report.daily.map((day) => <Cell key={day.day} fill={day.steps >= 10000 ? '#27d68f' : '#284b3b'} />)}</Bar><Bar dataKey="duration" fill="#af8cff" radius={[7, 7, 2, 2]} /></BarChart></ResponsiveContainer></div>
          <div className="chart-legend"><span><i className="green" /> Passos</span><span><i className="purple" /> Duração do treino</span><span><i className="dashed" /> Meta diária</span></div>
        </article>
        <article className="report-panel"><PanelTitle eyebrow="EVOLUÇÃO DE PESO" title={`${m.weightEnd.toFixed(1).replace('.', ',')} kg`} note={`${weightDelta < 0 ? '' : '+'}${weightDelta.toFixed(1).replace('.', ',')} kg na semana`} />
          <div className="report-chart report-chart--weight"><ResponsiveContainer width="100%" height="100%"><AreaChart data={report.weight}><defs><linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#27d68f" stopOpacity={.3}/><stop offset="1" stopColor="#27d68f" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#718078', fontSize: 9 }} /><YAxis hide domain={['dataMin - 0.3', 'dataMax + 0.3']} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toFixed(1).replace('.', ',')} kg`, 'Peso']} /><Area dataKey="value" type="monotone" stroke="#27d68f" strokeWidth={2.5} fill="url(#weightFill)" /></AreaChart></ResponsiveContainer></div>
          <div className="weight-comparison"><span>Início <b>{m.weightStart.toFixed(1).replace('.', ',')} kg</b></span><TrendingDown size={17}/><span>Atual <b>{m.weightEnd.toFixed(1).replace('.', ',')} kg</b></span></div>
        </article>
      </div>

      <section className="report-section"><div className="report-section__title"><span><Sparkles size={19} /></span><div><small>CONQUISTAS</small><h2>Destaques da semana</h2></div></div>
        <div className="highlights-grid">
          <Highlight icon={<Footprints />} label="Melhor dia de passos" value={`${bestSteps.day} · ${bestSteps.steps.toLocaleString('pt-BR')}`} />
          <Highlight icon={<Clock3 />} label="Maior treino" value="Pernas · 75 min" />
          <Highlight icon={<Trophy />} label="Recorde de carga" value="Agachamento · 92 kg" />
          <Highlight icon={<Medal />} label="Maior consistência" value="4 treinos concluídos" />
          <Highlight icon={<Scale />} label="Evolução de peso" value={`${Math.abs(weightDelta).toFixed(1).replace('.', ',')} kg no período`} />
        </div>
      </section>

      <section className="attention-section"><div className="attention-copy"><span><Info size={20} /></span><div><small>PARA A PRÓXIMA SEMANA</small><h2>Pontos de atenção</h2><p>Pequenos ajustes podem deixar sua rotina ainda mais equilibrada.</p></div></div><div className="attention-items"><p><i />A hidratação ficou abaixo de 2,2 L em dois dias. Que tal manter uma garrafa por perto?</p><p><i />Domingo teve menos movimento — um passeio leve pode ser uma opção agradável, se fizer sentido para você.</p></div></section>
    </section>
  )
}

function Metric({ icon, label, value, detail, delta, color = 'green' }: { icon: React.ReactNode; label: string; value: string; detail?: string; delta: React.ReactNode; color?: string }) {
  return <article className={`report-card report-metric report-metric--${color}`}><div className="report-card__heading"><span>{icon}</span><small>{label}</small></div><strong>{value}</strong>{detail && <p>{detail}</p>}<div>{delta}</div></article>
}
function PanelTitle({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) { return <div className="report-panel__title"><div><small>{eyebrow}</small><h2>{title}</h2></div><span>{note}</span></div> }
function Highlight({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <article className="highlight-card"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article> }
