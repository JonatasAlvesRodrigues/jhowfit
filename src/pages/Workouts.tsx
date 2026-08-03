import { Check, Clock3, Dumbbell, Play, Plus } from 'lucide-react'
import { Button, Card } from '../components/ui'
import type { Workout } from '../types'

export function Workouts({ workouts, toggleWorkout }: { workouts: Workout[]; toggleWorkout: (id: string) => void }) {
  return <div className="page">
    <div className="page-heading"><div><p>SEU PLANO</p><h1>Treinos</h1><span>Construa força. Supere limites.</span></div><Button><Plus size={18}/> Novo treino</Button></div>
    <div className="workout-list">
      {workouts.map((workout, index) => <Card className={`workout-item ${workout.completed ? 'completed' : ''}`} key={workout.id}>
        <div className="workout-index">0{index + 1}</div>
        <div className="workout-icon"><Dumbbell size={24}/></div>
        <div className="workout-info"><small>{workout.focus}</small><h3>{workout.title}</h3><p><Clock3 size={15}/>{workout.duration} minutos <span/> {workout.exercises} exercícios</p></div>
        <Button variant={workout.completed ? 'secondary' : 'primary'} onClick={() => toggleWorkout(workout.id)}>
          {workout.completed ? <><Check size={17}/> Concluído</> : <><Play size={16} fill="currentColor"/> Começar</>}
        </Button>
      </Card>)}
    </div>
  </div>
}
