import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, CalendarDays, CheckCircle2, Clock, Dumbbell, Gauge, RefreshCw, ShieldCheck, Target, Trophy } from 'lucide-react'
import { workoutHistoryService } from '../services/workoutHistoryService'
import type { ExerciseProgressHistory, WorkoutHistoryData } from '../types/workoutHistory'

export function WorkoutHistoryPage({ userId }: { userId: string }) {
  const [data, setData] = useState<WorkoutHistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedExercise, setSelectedExercise] = useState('')
  const [month, setMonth] = useState(() => new Date())

  useEffect(() => {
    workoutHistoryService.getHistory(userId).then((result) => {
      setData(result)
      setSelectedExercise(result.exercises[0]?.name ?? '')
    }).catch((requestError) => {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar o histórico.')
    }).finally(() => setLoading(false))
  }, [userId])

  const exercise = data?.exercises.find((item) => item.name === selectedExercise) ?? data?.exercises[0]
  if (loading) return <HistoryLoading />
  if (error || !data) return <div className="history-state"><AlertTriangle /><h2>Histórico indisponível</h2><p>{error}</p></div>
  if (!data.totalWorkouts) return <div className="history-empty"><Dumbbell /><small>HISTÓRICO DE TREINOS</small><h2>Conclua seu primeiro treino</h2><p>Calendário, cargas e sugestões de progressão aparecerão aqui depois da primeira sessão concluída.</p></div>

  return (
    <section className="workout-history-page">
      <header className="history-heading"><div><small>HISTÓRICO E PROGRESSÃO</small><h1>Sua consistência em números.</h1><p>Acompanhe frequência, volume e evolução de cargas.</p></div><Trophy /></header>
      <div className="history-kpis">
        <HistoryKpi icon={<Dumbbell />} label="Treinos" value={String(data.totalWorkouts)} />
        <HistoryKpi icon={<Clock />} label="Tempo total" value={formatDuration(data.totalDurationSeconds)} />
        <HistoryKpi icon={<Gauge />} label="Volume total" value={`${formatNumber(data.totalVolume)} kg`} />
        <HistoryKpi icon={<CheckCircle2 />} label="Taxa de conclusão" value={`${data.completionRate}%`} />
      </div>

      <div className="history-overview-grid">
        <WorkoutCalendar month={month} dates={data.completedDates} onMonth={setMonth} />
        <section className="history-panel weekly-history"><PanelTitle eyebrow="ÚLTIMAS 8 SEMANAS" title="Treinos por semana" /><div className="history-chart"><ResponsiveContainer><BarChart data={data.weekly}><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#718078', fontSize: 8 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#718078', fontSize: 8 }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="count" name="Treinos" fill="#27d68f" radius={[7,7,2,2]} /></BarChart></ResponsiveContainer></div></section>
      </div>

      <div className="history-ranks-grid">
        <RankPanel title="Exercícios mais realizados" items={data.topExercises} />
        <RankPanel title="Frequência por grupo muscular" items={data.muscleFrequency} />
      </div>

      {exercise && <ExerciseProgressPanel exercise={exercise} exercises={data.exercises} onSelect={setSelectedExercise} />}
      <div className="history-safety"><ShieldCheck /><p>As sugestões de progressão são conservadoras, baseadas apenas no histórico registrado e não substituem orientação de um profissional de educação física.</p></div>
    </section>
  )
}

function ExerciseProgressPanel({ exercise, exercises, onSelect }: { exercise: ExerciseProgressHistory; exercises: ExerciseProgressHistory[]; onSelect: (name: string) => void }) {
  const suggestionIcon = exercise.suggestion.action === 'increase' ? <ArrowUp /> : exercise.suggestion.action === 'reduce' ? <ArrowDown /> : exercise.suggestion.action === 'repetitions' ? <Target /> : <ArrowRight />
  return <section className="exercise-progress-panel">
    <header><div><small>EVOLUÇÃO POR EXERCÍCIO</small><h2>Progressão de cargas</h2></div><select value={exercise.name} onChange={(event) => onSelect(event.target.value)}>{exercises.map((item) => <option key={item.name}>{item.name}</option>)}</select></header>
    <div className="exercise-progress-kpis">
      <div><small>Melhor carga</small><strong>{exercise.bestWeight} kg</strong></div>
      <div><small>Melhor volume</small><strong>{formatNumber(exercise.bestVolume)} kg</strong></div>
      <div><small>Último treino</small><strong>{formatDate(exercise.lastWorkout)}</strong></div>
      <div><small>Comparação mensal</small><strong className={(exercise.monthlyDifference ?? 0) >= 0 ? 'is-positive' : 'is-negative'}>{exercise.monthlyDifference === null ? 'Sem comparação' : `${exercise.monthlyDifference >= 0 ? '+' : ''}${exercise.monthlyDifference}%`}</strong></div>
    </div>
    <div className="exercise-history-charts">
      <div><h3>Histórico de cargas</h3><ResponsiveContainer width="100%" height={220}><AreaChart data={exercise.points}><defs><linearGradient id="historyWeight" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#27d68f" stopOpacity=".35"/><stop offset="100%" stopColor="#27d68f" stopOpacity="0"/></linearGradient></defs><CartesianGrid stroke="#202b24" vertical={false}/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill:'#718078',fontSize:8}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#718078',fontSize:8}}/><Tooltip contentStyle={tooltipStyle}/><Area type="monotone" dataKey="maxWeight" name="Carga (kg)" stroke="#27d68f" strokeWidth={3} fill="url(#historyWeight)"/></AreaChart></ResponsiveContainer></div>
      <div><h3>Histórico de repetições</h3><ResponsiveContainer width="100%" height={220}><BarChart data={exercise.points}><CartesianGrid stroke="#202b24" vertical={false}/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill:'#718078',fontSize:8}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#718078',fontSize:8}}/><Tooltip contentStyle={tooltipStyle}/><Bar dataKey="repetitions" name="Repetições" fill="#4b9fff" radius={[6,6,2,2]}/></BarChart></ResponsiveContainer></div>
    </div>
    <div className={`progression-suggestion is-${exercise.suggestion.action}`}><span>{suggestionIcon}</span><div><small>SUGESTÃO CONSERVADORA</small><h3>{exercise.suggestion.title}</h3><p>{exercise.suggestion.text}</p></div></div>
  </section>
}

function WorkoutCalendar({ month, dates, onMonth }: { month: Date; dates: string[]; onMonth: (date: Date) => void }) {
  const cells = useMemo(() => calendarCells(month), [month])
  const counts = new Map<string, number>()
  for (const date of dates) counts.set(date, (counts.get(date) ?? 0) + 1)
  return <section className="history-panel workout-calendar"><header><PanelTitle eyebrow="CALENDÁRIO" title={new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(month)} /><div><button onClick={() => onMonth(addMonth(month,-1))}>‹</button><button onClick={() => onMonth(addMonth(month,1))}>›</button></div></header><div className="calendar-weekdays">{['S','T','Q','Q','S','S','D'].map((day,index)=><span key={`${day}-${index}`}>{day}</span>)}</div><div className="calendar-grid">{cells.map((cell,index) => cell ? <div className={counts.has(cell.key) ? 'has-training' : ''} key={cell.key}><span>{cell.day}</span>{counts.has(cell.key)&&<i>{counts.get(cell.key)}</i>}</div>:<div key={`empty-${index}`}/>)}</div></section>
}

function RankPanel({ title, items }: { title: string; items: Array<{name:string;value:number}> }) {
  const max = Math.max(1,...items.map((item)=>item.value))
  return <section className="history-panel rank-panel"><PanelTitle eyebrow="FREQUÊNCIA" title={title}/><div>{items.slice(0,6).map((item,index)=><div key={item.name}><span>{index+1}</span><div><strong>{item.name}</strong><i><b style={{width:`${item.value/max*100}%`}}/></i></div><small>{item.value}x</small></div>)}</div></section>
}

function HistoryKpi({icon,label,value}:{icon:React.ReactNode;label:string;value:string}) { return <div>{icon}<span><small>{label}</small><strong>{value}</strong></span></div> }
function PanelTitle({eyebrow,title}:{eyebrow:string;title:string}) { return <div className="history-panel-title"><small>{eyebrow}</small><h2>{title}</h2></div> }
function HistoryLoading(){return <div className="history-loading">{[1,2,3,4,5].map(item=><i key={item}/>)}</div>}

function calendarCells(month:Date){
  const first=new Date(month.getFullYear(),month.getMonth(),1);const offset=(first.getDay()+6)%7;const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate()
  return [...Array(offset).fill(null),...Array.from({length:days},(_,index)=>{const day=index+1;return{day,key:`${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`}})]
}
function addMonth(date:Date,amount:number){return new Date(date.getFullYear(),date.getMonth()+amount,1)}
function formatDuration(seconds:number){const hours=Math.floor(seconds/3600);const minutes=Math.round((seconds%3600)/60);return hours?`${hours}h ${minutes}min`:`${minutes} min`}
function formatNumber(value:number){return new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(value)}
function formatDate(value:string){return value?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'2-digit'}).format(new Date(value)):'—'}
const tooltipStyle={background:'#101612',border:'1px solid #29362e',borderRadius:10,fontSize:10}
