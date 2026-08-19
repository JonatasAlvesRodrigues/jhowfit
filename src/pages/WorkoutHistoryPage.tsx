import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, CalendarDays, CheckCircle2, Clock, Dumbbell, Gauge, RefreshCw, Share2, ShieldCheck, Target, Trophy, X } from 'lucide-react'
import { workoutHistoryService } from '../services/workoutHistoryService'
import type { ExerciseProgressHistory, WorkoutHistoryData, WorkoutHistorySession } from '../types/workoutHistory'

export function WorkoutHistoryPage({ userId }: { userId: string }) {
  const [data, setData] = useState<WorkoutHistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedExercise, setSelectedExercise] = useState('')
  const [month, setMonth] = useState(() => new Date())
  const [shareTarget, setShareTarget] = useState<WorkoutHistorySession | null>(null)

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

      <RecentWorkouts workouts={data.recentWorkouts} onSelect={setShareTarget} />

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
      {shareTarget && <HistoryShareDialog workout={shareTarget} onClose={() => setShareTarget(null)} />}
    </section>
  )
}

function RecentWorkouts({ workouts, onSelect }: { workouts: WorkoutHistoryData['recentWorkouts']; onSelect: (workout: WorkoutHistorySession) => void }) {
  return <section className="history-panel recent-workouts"><header><PanelTitle eyebrow="SESSÕES SALVAS" title="Treinos recentes" /><span>{workouts.length} registro(s)</span></header><div>{workouts.map((workout) => <button type="button" key={workout.id} onClick={() => onSelect(workout)}><span className="recent-workouts__icon"><Dumbbell size={18} /></span><div className="recent-workouts__main"><strong>{workout.name}</strong><small><CalendarDays size={12} /> {formatDate(workout.completedAt)} · <Clock size={12} /> {formatDuration(workout.durationSeconds)}</small>{workout.exercises.length > 0 && <p>{workout.exercises.slice(0, 4).join(' · ')}{workout.exercises.length > 4 ? ` · +${workout.exercises.length - 4}` : ''}</p>}</div><div className="recent-workouts__metrics"><span><b>{formatNumber(workout.volumeTotal)} kg</b><small>volume</small></span><span><b>{workout.completedSets}</b><small>séries</small></span>{workout.personalRecords > 0 && <i>+{workout.personalRecords} PR</i>}</div><Share2 size={15} /></button>)}</div></section>
}

function HistoryShareDialog({ workout, onClose }: { workout: WorkoutHistorySession; onClose: () => void }) {
  const [style, setStyle] = useState<'aurora' | 'midnight' | 'transparent'>('aurora')
  async function share() {
    const blob = await createHistoryShareCard(workout, style)
    const file = new File([blob], `movelya-treino-${workout.id}.png`, { type: 'image/png' })
    if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ title: workout.name, files: [file] })
    else { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = file.name; link.click(); URL.revokeObjectURL(link.href) }
  }
  return <div className="history-share-backdrop" role="dialog" aria-modal="true" aria-label="Compartilhar treino"><div className={`history-share-dialog is-${style}`}><button className="history-share-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button><small>TREINO SALVO</small><h2>{workout.name}</h2><p>{formatDate(workout.completedAt)} · {formatDuration(workout.durationSeconds)}</p><div className="history-share-muscles"><strong>Áreas trabalhadas</strong><span>{workout.muscles.length ? workout.muscles.join(' · ') : 'Não identificadas'}</span></div><div className="history-share-style-picker"><button className={style === 'aurora' ? 'is-selected' : ''} onClick={() => setStyle('aurora')}>Aura</button><button className={style === 'midnight' ? 'is-selected' : ''} onClick={() => setStyle('midnight')}>Noturno</button><button className={style === 'transparent' ? 'is-selected' : ''} onClick={() => setStyle('transparent')}>Sem fundo</button></div><button className="history-share-generate" onClick={() => void share()}><Share2 size={16} /> Gerar e compartilhar</button></div></div>
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

async function createHistoryShareCard(workout: WorkoutHistorySession, style: 'aurora' | 'midnight' | 'transparent') {
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1920
  const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas indisponível')
  const midnight = style === 'midnight'; const transparent = style === 'transparent'
  const text = midnight ? '#f4faf6' : '#14281c'; const muted = midnight ? '#acc5b5' : '#526d5d'; const accent = midnight ? '#c9ff3b' : '#138557'; const line = midnight ? 'rgba(255,255,255,.18)' : 'rgba(20,40,28,.18)'
  if (midnight) { const gradient = context.createLinearGradient(0, 0, 1080, 1920); gradient.addColorStop(0, '#07110c'); gradient.addColorStop(1, '#183024'); context.fillStyle = gradient; context.fillRect(0, 0, 1080, 1920) }
  else if (!transparent) { const gradient = context.createLinearGradient(0, 0, 1080, 1920); gradient.addColorStop(0, '#eef6ec'); gradient.addColorStop(1, '#aeb7ae'); context.fillStyle = gradient; context.fillRect(0, 0, 1080, 1920) }
  context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = accent; context.font = '800 29px Arial, sans-serif'; context.fillText('MOVELYA', 540, 105)
  context.fillStyle = text; context.font = '700 38px Arial, sans-serif'; context.fillText('TREINO CONCLUÍDO', 540, 185); context.font = '800 69px Arial, sans-serif'; context.fillText(canvasText(context, workout.name, 860), 540, 295)
  context.fillStyle = muted; context.font = '500 31px Arial, sans-serif'; context.fillText(`${formatDate(workout.completedAt)} · ${formatDuration(workout.durationSeconds)}`, 540, 365)
  context.strokeStyle = line; context.lineWidth = 2; context.beginPath(); context.moveTo(130, 445); context.lineTo(950, 445); context.stroke(); context.fillStyle = muted; context.font = '800 24px Arial, sans-serif'; context.fillText('ÁREAS TRABALHADAS', 540, 510)
  const muscles = workout.muscles.length ? workout.muscles : ['Não identificadas']; muscles.slice(0, 6).forEach((muscle, index) => { const x = index % 2 ? 720 : 360; const y = 585 + Math.floor(index / 2) * 70; context.fillStyle = midnight ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.54)'; context.fillRect(x - 155, y - 24, 310, 48); context.fillStyle = accent; context.font = '700 25px Arial, sans-serif'; context.fillText(canvasText(context, muscle, 265), x, y) })
  const metrics = [['VOLUME', `${formatNumber(workout.volumeTotal)} kg`], ['SÉRIES', String(workout.completedSets)], ['RECORDES', String(workout.personalRecords)], ['EXERCÍCIOS', String(workout.exercises.length)]]; metrics.forEach(([label, value], index) => { const x = index % 2 ? 730 : 350; const y = 890 + Math.floor(index / 2) * 150; context.fillStyle = muted; context.font = '700 22px Arial, sans-serif'; context.fillText(label, x, y); context.fillStyle = text; context.font = '800 47px Arial, sans-serif'; context.fillText(value, x, y + 53) })
  context.fillStyle = muted; context.font = '800 24px Arial, sans-serif'; context.fillText('EXERCÍCIOS REALIZADOS', 540, 1245); workout.exercises.slice(0, 5).forEach((exercise, index) => { context.fillStyle = accent; context.beginPath(); context.arc(190, 1315 + index * 72, 8, 0, Math.PI * 2); context.fill(); context.fillStyle = text; context.textAlign = 'left'; context.font = '600 30px Arial, sans-serif'; context.fillText(canvasText(context, exercise, 700), 220, 1315 + index * 72); context.textAlign = 'center' }); context.fillStyle = accent; context.font = '800 27px Arial, sans-serif'; context.fillText('SEU MOVIMENTO, NO SEU RITMO.', 540, 1770)
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem')), 'image/png'))
}
function canvasText(context: CanvasRenderingContext2D, value: string, maxWidth: number) { let text = value; while (context.measureText(text).width > maxWidth && text.length > 1) text = `${text.slice(0, -2)}…`; return text }
