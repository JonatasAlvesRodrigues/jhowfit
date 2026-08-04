import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  HeartOff,
  LoaderCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react'
import { trainingPlanService } from '../services/trainingPlanService'
import type { ExerciseLibraryItem } from '../types/exerciseLibrary'
import type { AIProfileSummary, GeneratedPlan } from '../types/trainingPlan'

export function AIWorkoutGenerator({
  userId,
  profile,
  library,
  onSave,
}: {
  userId: string
  profile: AIProfileSummary
  library: ExerciseLibraryItem[]
  onSave: (plan: GeneratedPlan) => Promise<void>
}) {
  const [priorityMuscles, setPriorityMuscles] = useState<string[]>([])
  const [dislikedInput, setDislikedInput] = useState('')
  const [plan, setPlan] = useState<GeneratedPlan | null>(null)
  const [confirmedProfile, setConfirmedProfile] = useState<AIProfileSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [openWorkout, setOpenWorkout] = useState(0)
  const muscles = useMemo(() => Array.from(new Set(library.map((exercise) => exercise.primaryMuscle))).sort(), [library])

  const dislikedExercises = dislikedInput.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 12)
  const previewProfile: AIProfileSummary = { ...profile, priorityMuscles, dislikedExercises }

  async function generate() {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const response = await trainingPlanService.generateWithAI(priorityMuscles, dislikedExercises)
      setPlan(response.plan)
      setConfirmedProfile(response.profileSummary)
      setOpenWorkout(0)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível gerar o plano.')
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!plan) return
    const validation = validateGeneratedPlan(plan)
    if (validation) {
      setError(validation)
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(plan)
      setMessage('Plano revisado e salvo nos seus treinos.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar o plano.')
    } finally {
      setSaving(false)
    }
  }

  async function notLiked() {
    if (!plan) return
    setError('')
    try {
      await trainingPlanService.submitNotLiked(userId, plan)
      setMessage('Feedback registrado. Você pode ajustar os dados e gerar outra sugestão.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível registrar o feedback.')
    }
  }

  if (loading) {
    return (
      <section className="ai-generating-state" role="status">
        <span><BrainCircuit size={35} /></span>
        <LoaderCircle className="ai-loader" size={24} />
        <small>GEMINI ESTÁ MONTANDO SUA SUGESTÃO</small>
        <h2>Analisando rotina, objetivos e segurança.</h2>
        <p>Nenhum treino será salvo antes da sua revisão.</p>
      </section>
    )
  }

  if (plan) {
    return (
      <section className="ai-plan-review">
        <header className="ai-review-heading">
          <div><small>REVISÃO OBRIGATÓRIA</small><h1>Revise antes de salvar.</h1><p>Troque exercícios e ajuste séries, repetições ou descanso livremente.</p></div>
          <span><Sparkles size={27} /></span>
        </header>

        {(error || message) && <div className={`training-feedback ${error ? 'is-error' : ''}`}>{error ? <AlertTriangle size={17} /> : <Check size={17} />}<span>{error || message}</span></div>}

        <div className="ai-review-meta">
          <label><span>Nome do plano</span><input value={plan.planName} onChange={(event) => setPlan({ ...plan, planName: event.target.value })} /></label>
          <label><span>Justificativa resumida</span><textarea value={plan.rationale} onChange={(event) => setPlan({ ...plan, rationale: event.target.value })} /></label>
        </div>

        <div className="ai-weekly-split">
          {plan.weeklySplit.map((item, index) => <span key={`${item.day}-${index}`}><b>{item.day}</b>{item.workout}</span>)}
        </div>

        <div className="ai-generated-workouts">
          {plan.workouts.map((workout, workoutIndex) => (
            <article key={`${workout.name}-${workoutIndex}`}>
              <button className="ai-workout-toggle" onClick={() => setOpenWorkout(openWorkout === workoutIndex ? -1 : workoutIndex)}>
                <span><Dumbbell size={18} /></span>
                <div><strong>{workout.name}</strong><small>{workout.days.join(', ')} · {workout.exercises.length} exercícios · {workout.durationMinutes} min</small></div>
                {openWorkout === workoutIndex ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
              </button>
              {openWorkout === workoutIndex && (
                <div className="ai-workout-edit">
                  <div className="ai-workout-fields">
                    <label><span>Nome</span><input value={workout.name} onChange={(event) => updateWorkout(plan, setPlan, workoutIndex, { name: event.target.value })} /></label>
                    <label><span>Duração</span><input type="number" min="10" max="180" value={workout.durationMinutes} onChange={(event) => updateWorkout(plan, setPlan, workoutIndex, { durationMinutes: Number(event.target.value) })} /></label>
                    <label className="is-wide"><span>Foco</span><input value={workout.focus} onChange={(event) => updateWorkout(plan, setPlan, workoutIndex, { focus: event.target.value })} /></label>
                    <label className="is-wide"><span>Observações</span><textarea value={workout.notes} onChange={(event) => updateWorkout(plan, setPlan, workoutIndex, { notes: event.target.value })} /></label>
                  </div>
                  <div className="ai-exercise-review-list">
                    {workout.exercises.map((exercise, exerciseIndex) => (
                      <div key={`${exercise.name}-${exerciseIndex}`} className="ai-exercise-review">
                        <span className="ai-exercise-index">{exerciseIndex + 1}</span>
                        <label className="ai-exercise-name"><span>Exercício</span><select value={exercise.name} onChange={(event) => updateGeneratedExercise(plan, setPlan, workoutIndex, exerciseIndex, { name: event.target.value })}><option value={exercise.name}>{exercise.name}</option>{library.filter((item) => item.name !== exercise.name).map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
                        <label><span>Séries</span><input type="number" min="1" max="10" value={exercise.sets} onChange={(event) => updateGeneratedExercise(plan, setPlan, workoutIndex, exerciseIndex, { sets: Number(event.target.value) })} /></label>
                        <label><span>Repetições</span><input value={exercise.repetitions} onChange={(event) => updateGeneratedExercise(plan, setPlan, workoutIndex, exerciseIndex, { repetitions: event.target.value })} /></label>
                        <label><span>Descanso</span><input type="number" min="0" max="300" value={exercise.restSeconds} onChange={(event) => updateGeneratedExercise(plan, setPlan, workoutIndex, exerciseIndex, { restSeconds: Number(event.target.value) })} /></label>
                        <label className="ai-exercise-detail"><span>Observações</span><textarea value={exercise.notes} onChange={(event) => updateGeneratedExercise(plan, setPlan, workoutIndex, exerciseIndex, { notes: event.target.value })} /></label>
                        <label className="ai-exercise-detail"><span>Substituições</span><input value={exercise.substitutions.join(', ')} onChange={(event) => updateGeneratedExercise(plan, setPlan, workoutIndex, exerciseIndex, { substitutions: parseList(event.target.value, 3) })} placeholder="Separe por vírgulas" /></label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>

        <div className="ai-safety-result"><ShieldCheck size={19} /><div><strong>Aviso de segurança</strong><p>{plan.safetyNotice}</p></div></div>
        <div className="ai-review-actions">
          <button className="ai-dislike" onClick={() => void notLiked()}><HeartOff size={17} /> Não gostei</button>
          <button className="ai-regenerate" onClick={() => void generate()}><RefreshCw size={17} /> Gerar novamente</button>
          <button className="ai-save-plan" onClick={() => void save()} disabled={saving}><Save size={17} /> {saving ? 'Salvando...' : 'Salvar plano revisado'}</button>
        </div>
      </section>
    )
  }

  const shownProfile = confirmedProfile ?? previewProfile
  return (
    <section className="ai-workout-setup">
      <header className="ai-setup-hero">
        <span><WandSparkles size={28} /></span>
        <div><small>TREINO COM GEMINI</small><h1>Uma sugestão adaptada à sua rotina.</h1><p>Confira exatamente quais informações serão enviadas antes de gerar.</p></div>
      </header>

      {error && <div className="training-feedback is-error"><AlertTriangle size={17} /><span>{error}</span></div>}

      <div className="ai-setup-layout">
        <div className="ai-profile-preview">
          <div className="training-section-heading"><div><small>RESUMO PARA A IA</small><h2>Informações do perfil</h2></div><span>Não inclui e-mail</span></div>
          <div className="ai-profile-grid">
            <ProfileItem label="Objetivo" value={labelValue(shownProfile.objective)} />
            <ProfileItem label="Idade" value={shownProfile.age ? `${shownProfile.age} anos` : 'Não informada'} />
            <ProfileItem label="Altura" value={shownProfile.heightCm ? `${shownProfile.heightCm} cm` : 'Não informada'} />
            <ProfileItem label="Peso" value={shownProfile.weightKg ? `${shownProfile.weightKg} kg` : 'Não informado'} />
            <ProfileItem label="Nível" value={labelValue(shownProfile.level)} />
            <ProfileItem label="Disponibilidade" value={`${shownProfile.daysPerWeek ?? '—'} dias · ${shownProfile.durationMinutes ?? '—'} min`} />
            <ProfileItem label="Dias" value={shownProfile.availableDays.join(', ') || 'Não informados'} wide />
            <ProfileItem label="Local" value={shownProfile.locations.join(', ') || 'Não informado'} />
            <ProfileItem label="Equipamentos" value={shownProfile.equipment.join(', ') || 'Não informados'} wide />
            <ProfileItem label="Lesões" value={shownProfile.injuries} wide warning={shownProfile.injuries !== 'Não informadas'} />
            <ProfileItem label="Limitações" value={shownProfile.physicalLimitations} wide warning={shownProfile.physicalLimitations !== 'Não informadas'} />
          </div>
        </div>

        <aside className="ai-extra-preferences">
          <div className="training-section-heading"><div><small>AJUSTES DESTA GERAÇÃO</small><h2>Preferências extras</h2></div></div>
          <div className="ai-priority-picker">
            <span>Grupos prioritários</span>
            <div>{muscles.map((muscle) => <button key={muscle} className={priorityMuscles.includes(muscle) ? 'is-selected' : ''} onClick={() => setPriorityMuscles((current) => current.includes(muscle) ? current.filter((item) => item !== muscle) : [...current, muscle])}>{muscle}</button>)}</div>
          </div>
          <label className="training-field"><span>Exercícios que não gosta</span><textarea value={dislikedInput} onChange={(event) => setDislikedInput(event.target.value)} placeholder="Separe por vírgulas. Ex.: agachamento, corrida..." /></label>
          <div className="ai-privacy-note"><ShieldCheck size={17} /><p>Os dados são usados apenas para gerar esta sugestão. O plano não será salvo automaticamente.</p></div>
          <button className="ai-generate-button" onClick={() => void generate()}><BrainCircuit size={19} /> Gerar sugestão com Gemini</button>
        </aside>
      </div>

      <div className="ai-medical-warning"><AlertTriangle size={19} /><p>O gerador não diagnostica, trata lesões, garante resultados ou substitui avaliação médica e profissional. Em caso de dor ou condição de saúde, procure orientação qualificada.</p></div>
    </section>
  )
}

function ProfileItem({ label, value, wide = false, warning = false }: { label: string; value: string; wide?: boolean; warning?: boolean }) {
  return <div className={`${wide ? 'is-wide' : ''} ${warning ? 'is-warning' : ''}`}><small>{label}</small><strong>{value}</strong></div>
}

function updateWorkout(plan: GeneratedPlan, setPlan: (plan: GeneratedPlan) => void, index: number, patch: Partial<GeneratedPlan['workouts'][number]>) {
  setPlan({ ...plan, workouts: plan.workouts.map((workout, workoutIndex) => workoutIndex === index ? { ...workout, ...patch } : workout) })
}

function updateGeneratedExercise(
  plan: GeneratedPlan,
  setPlan: (plan: GeneratedPlan) => void,
  workoutIndex: number,
  exerciseIndex: number,
  patch: Partial<GeneratedPlan['workouts'][number]['exercises'][number]>,
) {
  setPlan({
    ...plan,
    workouts: plan.workouts.map((workout, currentWorkout) => currentWorkout === workoutIndex ? {
      ...workout,
      exercises: workout.exercises.map((exercise, currentExercise) => currentExercise === exerciseIndex ? { ...exercise, ...patch } : exercise),
    } : workout),
  })
}

function validateGeneratedPlan(plan: GeneratedPlan) {
  if (plan.planName.trim().length < 3) return 'Informe um nome válido para o plano.'
  if (!plan.workouts.length) return 'O plano precisa ter pelo menos um treino.'
  for (const workout of plan.workouts) {
    if (workout.name.trim().length < 3 || !workout.exercises.length) return 'Revise o nome e os exercícios de todos os treinos.'
    for (const exercise of workout.exercises) {
      if (!exercise.name.trim() || exercise.sets < 1 || !exercise.repetitions.trim()) return `Revise os dados do treino ${workout.name}.`
    }
  }
  return ''
}

function labelValue(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase())
}

function parseList(value: string, limit: number) {
  return value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, limit)
}
