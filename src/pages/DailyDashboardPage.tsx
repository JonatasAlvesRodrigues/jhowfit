import { useMemo, useState } from 'react'
import {
  Activity,
  ArrowRight,
  Bell,
  CircleCheck,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  Gauge,
  Play,
  RefreshCw,
  Salad,
  Scale,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { DashboardMetricCard, DashboardProgressRing, MiniWeightChart } from '../components/DashboardCards'
import { useDailyDashboard } from '../hooks/useDailyDashboard'

interface DailyDashboardPageProps {
  userId: string
  onNavigate: (path: string) => void
}

export function DailyDashboardPage({ userId, onNavigate }: DailyDashboardPageProps) {
  const { data, loading, error, retry, addWater } = useDailyDashboard(userId)
  const [actionError, setActionError] = useState('')
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

  const initials = data.profile.name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const weightDifference = data.weight.difference

  async function handleWater() {
    setActionError('')
    try {
      await addWater()
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Não foi possível atualizar sua água.')
    }
  }

  return (
    <section className="daily-dashboard">
      <header className="daily-welcome">
        <div className="daily-user">
          <span className="daily-avatar">
            {data.profile.avatarUrl
              ? <img src={data.profile.avatarUrl} alt="" />
              : initials}
          </span>
          <div>
            <small>{greeting}</small>
            <h1>{data.profile.name.split(' ')[0]}</h1>
            <p>{capitalize(currentDate)}</p>
          </div>
        </div>
        <button className="daily-notification" aria-label="Abrir notificações"><Bell size={20} /><i /></button>
      </header>

      {!data.hasAnyData && (
        <div className="dashboard-empty-banner">
          <span><Gauge size={22} /></span>
          <div><strong>Seu dia começa aqui</strong><p>Registre água, alimentação ou atividade para acompanhar seu progresso.</p></div>
          <button onClick={() => onNavigate('/atividades')}>Registrar <ArrowRight size={15} /></button>
        </div>
      )}

      {data.allGoalsCompleted && (
        <div className="dashboard-complete-banner">
          <CircleCheck size={22} />
          <div><strong>Todas as metas concluídas!</strong><p>Ótimo trabalho. Consistência também inclui uma boa recuperação.</p></div>
        </div>
      )}

      {actionError && <div className="dashboard-inline-error" role="alert">{actionError}</div>}

      <article className="today-summary">
        <div className="today-summary__copy">
          <small>RESUMO DE HOJE</small>
          <h2>{data.allGoalsCompleted ? 'Dia completo. Mandou muito bem!' : motivation(data.completion)}</h2>
          <p>{data.insight}</p>
          <div className="today-summary__legend">
            <span><i /> Metas diárias</span>
            <b>{data.completion}% concluído</b>
          </div>
        </div>
        <DashboardProgressRing value={data.completion} />
      </article>

      <div className="daily-metrics-grid">
        <DashboardMetricCard
          label="Passos"
          icon={Footprints}
          metric={data.metrics.steps}
          currentLabel={data.metrics.steps.current.toLocaleString('pt-BR')}
          goalLabel={`Meta ${data.metrics.steps.goal.toLocaleString('pt-BR')}`}
          color="green"
          onClick={() => onNavigate('/atividades')}
        />
        <DashboardMetricCard
          label="Calorias"
          icon={Flame}
          metric={data.metrics.calories}
          currentLabel={`${Math.round(data.metrics.calories.current).toLocaleString('pt-BR')} kcal`}
          goalLabel={`Meta ${Math.round(data.metrics.calories.goal).toLocaleString('pt-BR')} kcal`}
          color="orange"
          onClick={() => onNavigate('/dieta')}
        />
        <DashboardMetricCard
          label="Proteína"
          icon={Salad}
          metric={data.metrics.protein}
          currentLabel={`${Math.round(data.metrics.protein.current)} g`}
          goalLabel={`Meta ${Math.round(data.metrics.protein.goal)} g`}
          color="purple"
          onClick={() => onNavigate('/dieta')}
        />
        <DashboardMetricCard
          label="Água"
          icon={Droplets}
          metric={data.metrics.water}
          currentLabel={`${data.metrics.water.current.toFixed(2).replace('.', ',')} L`}
          goalLabel={`Meta ${data.metrics.water.goal.toFixed(1).replace('.', ',')} L · toque para +250 ml`}
          color="blue"
          onClick={() => void handleWater()}
        />
        <DashboardMetricCard
          label="Minutos ativos"
          icon={Timer}
          currentLabel={`${data.metrics.activeMinutes} min`}
          goalLabel="Meta diária de 30 min"
          metric={{ current: data.metrics.activeMinutes, goal: 30 }}
          color="green"
          onClick={() => onNavigate('/atividades')}
        />
        <DashboardMetricCard
          label="Treino"
          icon={Dumbbell}
          currentLabel={data.workout?.completed ? 'Concluído' : data.workout ? 'Pendente' : 'Sem treino'}
          goalLabel={data.workout?.title ?? 'Planeje seu próximo treino'}
          metric={{ current: data.workout?.completed ? 1 : 0, goal: 1 }}
          status={data.workout?.completed ? 'FEITO' : 'HOJE'}
          color="green"
          onClick={() => onNavigate('/treinos')}
        />
      </div>

      <div className="daily-details-grid">
        <article className="daily-panel workout-today">
          <div className="daily-panel__heading">
            <div><small>TREINO DO DIA</small><h2>{data.workout?.title ?? 'Nenhum treino programado'}</h2></div>
            <span className={data.workout?.completed ? 'is-complete' : ''}>{data.workout?.completed ? 'CONCLUÍDO' : 'HOJE'}</span>
          </div>
          {data.workout ? (
            <>
              <p className="workout-muscles">
                {data.workout.muscleGroups.length ? data.workout.muscleGroups.join(' · ') : data.workout.focus || 'Treino personalizado'}
              </p>
              <div className="workout-facts">
                <span><Timer size={17} /><b>{data.workout.duration} min</b><small>Duração</small></span>
                <span><Activity size={17} /><b>{data.workout.level}</b><small>Nível</small></span>
                <span><Dumbbell size={17} /><b>{data.workout.exerciseCount}</b><small>Exercícios</small></span>
              </div>
              <button className="start-workout-button" onClick={() => onNavigate('/treinos')} disabled={data.workout.completed}>
                {data.workout.completed ? <CircleCheck size={18} /> : <Play size={18} fill="currentColor" />}
                {data.workout.completed ? 'Treino concluído' : 'Iniciar treino'}
              </button>
            </>
          ) : (
            <div className="no-workout">
              <span><Dumbbell size={25} /></span>
              <p>Seu dia está livre. Você pode descansar ou escolher um treino para manter a rotina.</p>
              <button onClick={() => onNavigate('/treinos')}>Escolher treino <ArrowRight size={15} /></button>
            </div>
          )}
        </article>

        <article className="daily-panel weight-evolution">
          <div className="daily-panel__heading">
            <div><small>EVOLUÇÃO</small><h2>Peso corporal</h2></div>
            <button onClick={() => onNavigate('/evolucao')}>Ver evolução <ArrowRight size={14} /></button>
          </div>
          <div className="weight-current">
            <div>
              <span><Scale size={20} /></span>
              <strong>{data.weight.current !== null ? `${data.weight.current.toFixed(1).replace('.', ',')} kg` : 'Sem registro'}</strong>
              {weightDifference !== null && (
                <small className={weightDifference <= 0 ? 'is-positive' : 'is-warning'}>
                  {weightDifference <= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                  {weightDifference > 0 ? '+' : ''}{weightDifference.toFixed(1).replace('.', ',')} kg desde o anterior
                </small>
              )}
            </div>
            <MiniWeightChart points={data.weight.history} />
          </div>
          {data.weight.current === null && <p className="weight-hint">Adicione seu primeiro registro para visualizar sua evolução.</p>}
        </article>
      </div>

      <article className="daily-insight">
        <span className="daily-insight__icon"><Sparkles size={23} /></span>
        <div><small>INSIGHT VITAFIT IA</small><h2>{data.insight}</h2><p>Baseado nos registros e metas do seu dia.</p></div>
        <button onClick={() => onNavigate('/relatorios')}>Ver detalhes <ArrowRight size={15} /></button>
      </article>
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
