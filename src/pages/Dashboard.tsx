import { Activity, ArrowUpRight, Droplets, Footprints, Flame, Play, Plus, Sparkles, Timer, TrendingDown } from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { ActivityChart } from '../components/Charts'
import { Button, Card, Progress } from '../components/ui'
import type { DailyStats, Workout } from '../types'

export function Dashboard({ stats, workouts, addWater }: { stats: DailyStats; workouts: Workout[]; addWater: () => void }) {
  const { navigate, openModal } = useApp()
  const nextWorkout = workouts[0]
  return <>
    <section className="welcome">
      <div><p>SEGUNDA-FEIRA, 3 DE AGOSTO</p><h1>Boa noite, João! <span>👋</span></h1><h2>Pronto para superar seus limites hoje?</h2></div>
      <Button onClick={() => openModal('quick')}><Plus size={19}/> Registro rápido</Button>
    </section>

    <div className="metric-grid">
      <Card className="metric metric--orange"><div className="metric__top"><span><Flame size={19}/></span><small>CALORIAS</small><i>56%</i></div><strong>{stats.calories.current.toLocaleString('pt-BR')}</strong><p>de {stats.calories.goal.toLocaleString('pt-BR')} kcal</p><Progress value={stats.calories.current / stats.calories.goal * 100} color="orange"/></Card>
      <Card className="metric metric--blue"><div className="metric__top"><span><Droplets size={19}/></span><small>ÁGUA</small><button onClick={addWater} aria-label="Adicionar água"><Plus size={16}/></button></div><strong>{stats.water.current.toFixed(1)}<em> L</em></strong><p>de {stats.water.goal} litros</p><Progress value={stats.water.current / stats.water.goal * 100} color="blue"/></Card>
      <Card className="metric"><div className="metric__top"><span><Footprints size={19}/></span><small>PASSOS</small><i>68%</i></div><strong>{stats.steps.current.toLocaleString('pt-BR')}</strong><p>de {stats.steps.goal.toLocaleString('pt-BR')} passos</p><Progress value={stats.steps.current / stats.steps.goal * 100}/></Card>
      <Card className="metric"><div className="metric__top"><span><Timer size={19}/></span><small>ATIVIDADE</small><ArrowUpRight size={17}/></div><strong>{stats.workout.minutes}<em> min</em></strong><p>{stats.workout.calories} kcal queimadas</p><Progress value={80}/></Card>
    </div>

    <div className="dashboard-grid">
      <Card className="workout-card">
        <div className="section-heading"><div><small>PRÓXIMO TREINO</small><h3>{nextWorkout.title}</h3></div><span>HOJE</span></div>
        <p className="muted">{nextWorkout.focus} · {nextWorkout.exercises} exercícios</p>
        <div className="exercise-preview">
          <div className="exercise-art"><DumbbellArt /></div>
          <div><strong>Supino reto</strong><span>4 séries × 10 repetições</span><b>Última carga: 72 kg</b></div>
        </div>
        <div className="workout-card__footer"><span><Timer size={16}/>{nextWorkout.duration} min</span><Button onClick={() => navigate('treinos')}><Play fill="currentColor" size={16}/> Iniciar treino</Button></div>
      </Card>
      <Card className="activity-card">
        <div className="section-heading"><div><small>CONSISTÊNCIA</small><h3>Atividade semanal</h3></div><select aria-label="Período"><option>7 dias</option></select></div>
        <ActivityChart />
        <div className="activity-summary"><span><b>5</b> dias ativos</span><span><b>4h 12min</b> total</span></div>
      </Card>
      <Card className="coach-card">
        <div className="coach-orb"><Sparkles size={25}/></div>
        <div><small>COACH JHOW IA</small><h3>Seu desempenho está incrível!</h3><p>Você treinou 3 dias seguidos. Hoje, foque em manter a hidratação para acelerar sua recuperação.</p><button onClick={() => openModal('ai')}>Conversar com o coach <ArrowUpRight size={16}/></button></div>
      </Card>
      <Card className="goal-card">
        <div className="section-heading"><div><small>META ATUAL</small><h3>Definição muscular</h3></div><button onClick={() => navigate('progresso')}>Ver detalhes</button></div>
        <div className="goal-content"><div className="goal-ring"><span>68%</span></div><div><p><TrendingDown size={17}/> <b>-4,4 kg</b> desde o início</p><span>Atual: 79,8 kg</span><span>Meta: 76 kg</span></div></div>
      </Card>
    </div>
  </>
}

function DumbbellArt() {
  return <Activity size={42} strokeWidth={1.5}/>
}
