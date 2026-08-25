import { useMemo, useState } from 'react'
import {
  Activity,
  ArrowRight,
  CircleCheck,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  RefreshCw,
  Salad,
  Sparkles,
  Target,
} from 'lucide-react'
import { DashboardProgressRing } from '../components/DashboardCards'
import { useDailyDashboard } from '../hooks/useDailyDashboard'

interface DailyDashboardPageProps {
  userId: string
  onNavigate: (path: string) => void
}

export function DailyDashboardPage({ userId, onNavigate }: DailyDashboardPageProps) {
  const { data, loading, error, retry } = useDailyDashboard(userId)
  const greeting = useMemo(getGreeting, [])
  const currentDate = useMemo(() => new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date()), [])

  if (loading) return <DashboardLoading />
  if (error || !data) {
    return (
      <section className="dashboard-state dashboard-state--error">
        <span><RefreshCw size={24} /></span>
        <small>RESUMO INDISPONÍVEL</small>
        <h1>Não foi possível carregar seu dia.</h1>
        <p>{error || 'Tente novamente em alguns instantes.'}</p>
        <button className="vita-primary-button" onClick={() => void retry()}><RefreshCw size={17} /> Tentar novamente</button>
      </section>
    )
  }

  const nextAction = getNextAction(data)
  const NextActionIcon = nextAction.icon

  return (
    <section className="daily-dashboard">
      <header className="daily-welcome daily-welcome--reference">
        <div className="daily-user">
          <div>
            <small>{capitalize(currentDate)}</small>
            <h1>{greeting}, {data.profile.name.split(' ')[0]} <span className="daily-wave" aria-hidden="true">👋</span></h1>
            <p>Seu progresso começa com pequenas escolhas todos os dias.</p>
          </div>
        </div>
        <div className="daily-hero-portrait" aria-label={`${data.activeStreak} dias de sequência`}>
          <Sparkles size={48} aria-hidden="true" />
          <span><Flame size={13} fill="currentColor" /> {data.activeStreak}</span>
        </div>
      </header>

      <article className="daily-next-action">
        <span className="daily-next-action__icon"><NextActionIcon size={20} /></span>
        <div>
          <small>PRÓXIMA AÇÃO</small>
          <strong>{nextAction.title}</strong>
          <p>{nextAction.description}</p>
        </div>
        <button onClick={() => onNavigate(nextAction.path)}>{nextAction.action} <ArrowRight size={16} /></button>
      </article>

      <article className="daily-progress-panel">
        <header><small>PROGRESSO DO DIA</small><button onClick={() => onNavigate('/metas')}>Ver metas <ArrowRight size={14} /></button></header>
        <div className="daily-progress-panel__body"><div className="daily-progress-panel__ring"><DashboardProgressRing value={data.completion} /><p>do seu objetivo</p></div><div className="daily-progress-panel__metrics">
          <DashboardQuickMetric icon={Footprints} color="green" value={Math.round(data.metrics.steps.current).toLocaleString('pt-BR')} detail={`/ ${Math.round(data.metrics.steps.goal).toLocaleString('pt-BR')} passos`} />
          <DashboardQuickMetric icon={Flame} color="orange" value={Math.round(data.metrics.calories.current).toLocaleString('pt-BR')} detail={`/ ${Math.round(data.metrics.calories.goal).toLocaleString('pt-BR')} kcal`} />
          <DashboardQuickMetric icon={Droplets} color="blue" value={`${data.metrics.water.current.toFixed(1).replace('.', ',')} L`} detail={`/ ${data.metrics.water.goal.toFixed(1).replace('.', ',')} L água`} />
          <DashboardQuickMetric icon={Salad} color="purple" value={String(data.metrics.meals)} detail="/ 3 refeições" />
        </div></div>
      </article>

      <article className="daily-focus-card">
        <div><span><Target size={20} /></span><small>FOCO DE HOJE</small><h2>{data.workout?.completed ? 'Treino concluído. Excelente!' : data.workout ? data.workout.title : 'Ainda não treinou hoje.'}</h2><p>{data.workout?.completed ? 'Mantenha a hidratação e aproveite sua recuperação.' : data.workout ? `${data.workout.duration} minutos para avançar no seu objetivo.` : 'Que tal um treino de 30 minutos para iniciar seu dia?'}</p><button onClick={() => onNavigate('/treinos')}>{data.workout?.completed ? 'Ver treinos' : 'Começar treino'} <ArrowRight size={18} /></button></div>
        <div className="daily-focus-card__art" aria-hidden="true"><Dumbbell size={82} /></div>
      </article>

      <section className="daily-shortcuts"><small>ATALHOS RÁPIDOS</small><div>
        <DashboardShortcut icon={Droplets} color="blue" label="Água" detail="Registrar" onClick={() => onNavigate('/agua')} />
        <DashboardShortcut icon={Salad} color="purple" label="Refeição" detail="Registrar" onClick={() => onNavigate('/dieta')} />
        <DashboardShortcut icon={Footprints} color="green" label="Passos" detail="Ver detalhes" onClick={() => onNavigate('/atividades')} />
        <DashboardShortcut icon={Dumbbell} color="orange" label="Treino" detail="Iniciar agora" onClick={() => onNavigate('/treinos')} />
      </div></section>

      <article className="daily-insight daily-insight--compact"><span className="daily-insight__icon"><Sparkles size={21} /></span><div><small>INSIGHT MOVELYA IA</small><h2>{data.insight}</h2></div><button onClick={() => onNavigate('/relatorios')}>Ver detalhes <ArrowRight size={15} /></button></article>
    </section>
  )
}

function DashboardLoading() {
  return (
    <section className="daily-dashboard" aria-label="Carregando resumo diário" role="status">
      <div className="daily-loading daily-loading--header" />
      <div className="daily-loading daily-loading--summary" />
      <div className="daily-loading-grid">{Array.from({ length: 6 }, (_, index) => <div className="daily-loading" key={index} />)}</div>
      <div className="daily-loading-grid daily-loading-grid--wide"><div className="daily-loading" /><div className="daily-loading" /></div>
    </section>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function motivation(completion: number) {
  if (completion >= 75) return 'Você está muito perto das suas metas.'
  if (completion >= 40) return 'Bom ritmo. Continue cuidando de você.'
  return 'Cada escolha de hoje conta.'
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function DashboardQuickMetric({ icon:Icon, color, value, detail }: { icon:typeof Footprints; color:'green'|'orange'|'blue'|'purple'; value:string; detail:string }) { return <div className={`daily-quick-metric is-${color}`}><span><Icon size={21} /></span><div><strong>{value}</strong><small>{detail}</small></div></div> }
function DashboardShortcut({ icon:Icon, color, label, detail, onClick }: { icon:typeof Footprints; color:'green'|'orange'|'blue'|'purple'; label:string; detail:string; onClick:()=>void }) { return <button className={`daily-shortcut is-${color}`} onClick={onClick}><span><Icon size={25} /></span><strong>{label}</strong><small>{detail}</small></button> }

function getNextAction(data: import('../types/dashboard').DailyDashboardData) {
  if (data.allGoalsCompleted) return {
    icon: CircleCheck,
    title: 'Seu dia está completo',
    description: 'Revise sua evolução e mantenha o ritmo de hoje.',
    action: 'Ver progresso',
    path: '/relatorios',
  }
  if (data.metrics.water.current < data.metrics.water.goal) {
    const remaining = Math.max(data.metrics.water.goal - data.metrics.water.current, 0)
    return {
      icon: Droplets,
      title: 'Cuide da sua hidratação',
      description: `Faltam ${remaining.toFixed(2).replace('.', ',')} L para sua meta de hoje.`,
      action: 'Registrar água',
      path: '/agua',
    }
  }
  if (data.metrics.meals < 3) return {
    icon: Salad,
    title: 'Registre sua próxima refeição',
    description: `${data.metrics.meals} de 3 refeições foram registradas hoje.`,
    action: 'Abrir dieta',
    path: '/dieta',
  }
  if (data.workout && !data.workout.completed) return {
    icon: Dumbbell,
    title: data.workout.title,
    description: `${data.workout.duration} min para concluir o treino planejado.`,
    action: 'Iniciar treino',
    path: '/treinos',
  }
  return {
    icon: Footprints,
    title: 'Movimente-se um pouco mais',
    description: 'Uma caminhada curta já ajuda a aproximar você da meta diária.',
    action: 'Ver atividades',
    path: '/atividades',
  }
}

