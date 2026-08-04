import { useEffect, useMemo, useState } from 'react'
import {
  Bot,
  CalendarDays,
  Check,
  ChevronRight,
  CircleOff,
  Copy,
  Dumbbell,
  Library,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Power,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { AIWorkoutGenerator } from '../components/AIWorkoutGenerator'
import { WorkoutEditor, createEmptyWorkout, createTrainingExercise } from '../components/WorkoutEditor'
import { useTrainingHub } from '../hooks/useTrainingHub'
import type { WorkoutDraft, WorkoutSummary, WorkoutTemplate } from '../types/trainingPlan'
import { weekDays } from '../types/trainingPlan'
import { ExerciseLibraryPage } from './ExerciseLibraryPage'
import { WorkoutExecutionPage } from './WorkoutExecutionPage'
import { workoutExecutionService } from '../services/workoutExecutionService'

type TrainingTab = 'plans' | 'library' | 'ai'

export function TrainingHubPage({ userId }: { userId: string }) {
  const hub = useTrainingHub(userId)
  const [tab, setTab] = useState<TrainingTab>('plans')
  const [editor, setEditor] = useState<WorkoutDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<WorkoutSummary | null>(null)
  const [actionMenu, setActionMenu] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [runningWorkout, setRunningWorkout] = useState<WorkoutSummary | null>(null)
  const [recoverySessionId, setRecoverySessionId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    workoutExecutionService.getActive(userId).then((session) => {
      if (mounted && session) setRecoverySessionId(session.id)
    }).catch(() => undefined)
    return () => { mounted = false }
  }, [userId])

  if (hub.loading) return <TrainingHubLoading />
  if (hub.error || !hub.data) {
    return (
      <section className="training-hub-state">
        <span><RefreshCw size={24} /></span><small>TREINOS INDISPONÍVEIS</small><h1>Não foi possível carregar suas fichas.</h1><p>{hub.error}</p>
        <button className="vita-primary-button" onClick={() => void hub.retry()}><RefreshCw size={16} /> Tentar novamente</button>
      </section>
    )
  }

  async function saveWorkout(draft: WorkoutDraft) {
    setSaving(true)
    setActionError('')
    try {
      await hub.saveWorkout(draft)
      setEditor(null)
      setMessage(draft.id ? 'Treino atualizado com sucesso.' : 'Treino criado com sucesso.')
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar o treino.')
    } finally {
      setSaving(false)
    }
  }

  async function duplicate(workout: WorkoutSummary) {
    setActionMenu(null)
    setActionError('')
    try {
      await hub.duplicateWorkout(workout)
      setMessage('Treino duplicado. Você pode editar a cópia quando quiser.')
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Não foi possível duplicar o treino.')
    }
  }

  async function toggle(workout: WorkoutSummary) {
    setActionMenu(null)
    setActionError('')
    try {
      await hub.setActive(workout.id, !workout.active)
      setMessage(workout.active ? 'Treino desativado.' : 'Treino ativado.')
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Não foi possível alterar o treino.')
    }
  }

  async function remove() {
    if (!deleteTarget) return
    setSaving(true)
    setActionError('')
    try {
      await hub.deleteWorkout(deleteTarget.id)
      setDeleteTarget(null)
      setMessage('Treino excluído.')
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Não foi possível excluir o treino.')
    } finally {
      setSaving(false)
    }
  }

  function useTemplate(template: WorkoutTemplate) {
    const exercises = template.exercises.map((templateExercise) => {
      const libraryExercise = hub.data!.library.find((exercise) => exercise.name === templateExercise.name)
      return libraryExercise ? {
        ...createTrainingExercise(libraryExercise),
        sets: templateExercise.sets,
        repetitions: templateExercise.repetitions,
        restSeconds: templateExercise.rest,
      } : {
        clientId: crypto.randomUUID(),
        libraryExerciseId: null,
        name: templateExercise.name,
        sets: templateExercise.sets,
        repetitions: templateExercise.repetitions,
        initialWeight: null,
        restSeconds: templateExercise.rest,
        notes: '',
        optional: false,
        advancedTechnique: '',
        substitutions: [],
      }
    })
    setEditor({
      ...createEmptyWorkout(),
      name: template.name,
      notes: template.description,
      days: template.suggestedDays,
      source: 'template',
      exercises,
    })
  }

  if (editor) {
    return <WorkoutEditor initial={editor} library={hub.data.library} saving={saving} onSave={(draft) => void saveWorkout(draft)} onCancel={() => setEditor(null)} />
  }

  if (runningWorkout || recoverySessionId) {
    return <WorkoutExecutionPage
      userId={userId}
      workout={runningWorkout ?? undefined}
      recoverySessionId={recoverySessionId ?? undefined}
      library={hub.data.library}
      onExit={() => {
        setRunningWorkout(null)
        setRecoverySessionId(null)
        void hub.retry()
      }}
    />
  }

  return (
    <section className="training-hub-page">
      <header className="training-hub-heading">
        <div><small>SEUS TREINOS</small><h1>Planeje. Execute. Evolua.</h1><p>Monte fichas manualmente ou revise uma sugestão criada com IA.</p></div>
        {tab === 'plans' && <button onClick={() => setEditor(createEmptyWorkout())}><Plus size={17} /> Criar treino</button>}
      </header>

      <nav className="training-tabs" aria-label="Áreas de treino">
        <button className={tab === 'plans' ? 'is-active' : ''} onClick={() => setTab('plans')}><Dumbbell size={17} /> Meus treinos</button>
        <button className={tab === 'library' ? 'is-active' : ''} onClick={() => setTab('library')}><Library size={17} /> Biblioteca</button>
        <button className={tab === 'ai' ? 'is-active' : ''} onClick={() => setTab('ai')}><Bot size={17} /> Gerar com IA <span>NOVO</span></button>
      </nav>

      {(message || actionError) && <div className={`training-feedback ${actionError ? 'is-error' : ''}`}>{actionError ? <CircleOff size={17} /> : <Check size={17} />}<span>{actionError || message}</span><button onClick={() => { setMessage(''); setActionError('') }}><X size={15} /></button></div>}
      {recoverySessionId && <button className="recover-workout-banner" onClick={() => setRecoverySessionId(recoverySessionId)}><Play size={17} /><span><strong>Treino em andamento</strong><small>Toque para continuar de onde parou.</small></span><ChevronRight /></button>}

      {tab === 'library' && <ExerciseLibraryPage userId={userId} />}
      {tab === 'ai' && <AIWorkoutGenerator userId={userId} profile={hub.data.profile} library={hub.data.library} onSave={hub.saveGenerated} />}
      {tab === 'plans' && (
        <>
          <WeeklyWorkoutView workouts={hub.data.workouts} />

          <section className="workout-list-section">
            <div className="training-section-heading">
              <div><small>FICHAS SALVAS</small><h2>Meus treinos</h2></div>
              <span>{hub.data.workouts.filter((workout) => workout.active).length} ativos</span>
            </div>
            {hub.data.workouts.length ? (
              <div className="training-workout-grid">
                {hub.data.workouts.map((workout) => (
                  <article className={`training-workout-card ${!workout.active ? 'is-inactive' : ''}`} key={workout.id}>
                    <div className="training-workout-card__top">
                      <span><Dumbbell size={20} /></span>
                      <i className={workout.active ? 'is-active' : ''}>{workout.active ? 'ATIVO' : 'INATIVO'}</i>
                      <div className="workout-actions-menu">
                        <button onClick={() => setActionMenu(actionMenu === workout.id ? null : workout.id)} aria-label="Ações do treino"><MoreVertical size={18} /></button>
                        {actionMenu === workout.id && (
                          <div>
                            <button onClick={() => { setEditor(structuredClone(workout)); setActionMenu(null) }}><Pencil size={14} /> Editar</button>
                            <button onClick={() => void duplicate(workout)}><Copy size={14} /> Duplicar</button>
                            <button onClick={() => void toggle(workout)}><Power size={14} /> {workout.active ? 'Desativar' : 'Ativar'}</button>
                            <button className="is-danger" onClick={() => { setDeleteTarget(workout); setActionMenu(null) }}><Trash2 size={14} /> Excluir</button>
                          </div>
                        )}
                      </div>
                    </div>
                    <small>{workout.source === 'ai' ? 'CRIADO COM IA' : workout.source === 'template' ? 'MODELO PERSONALIZADO' : 'TREINO MANUAL'}</small>
                    <h3>{workout.name}</h3>
                    <p>{workout.focus || workout.notes || 'Sem observações cadastradas.'}</p>
                    <div className="training-workout-meta">
                      <span><CalendarDays size={14} /> {workout.days.length ? workout.days.map((day) => day.slice(0, 3)).join(' · ') : 'Sem dias'}</span>
                      <span><Dumbbell size={14} /> {workout.exercises.length} exercícios</span>
                    </div>
                    <div className="workout-card-ctas">
                      <button className="start-workout-cta" onClick={() => setRunningWorkout(workout)}><Play size={15} /> Iniciar treino</button>
                      <button className="edit-workout-cta" onClick={() => setEditor(structuredClone(workout))}>Editar <ChevronRight size={15} /></button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="training-empty-workouts">
                <span><Dumbbell size={29} /></span><h3>Sua primeira ficha começa aqui</h3><p>Crie do zero, escolha um exemplo ou gere uma sugestão com IA.</p><button onClick={() => setEditor(createEmptyWorkout())}><Plus size={16} /> Criar treino</button>
              </div>
            )}
          </section>

          <section className="workout-template-section">
            <div className="training-section-heading"><div><small>COMECE MAIS RÁPIDO</small><h2>Exemplos de treino</h2></div><span>{hub.data.templates.length} modelos</span></div>
            <div className="workout-template-track">
              {hub.data.templates.map((template) => (
                <button key={template.id} onClick={() => useTemplate(template)}>
                  <span><Sparkles size={18} /></span><strong>{template.name}</strong><p>{template.description}</p><small>{template.exercises.length} exercícios · {template.suggestedDays.join(', ')}</small><i>Usar modelo <ChevronRight size={14} /></i>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {deleteTarget && (
        <div className="training-modal-backdrop" onMouseDown={() => setDeleteTarget(null)}>
          <div className="delete-workout-modal" onMouseDown={(event) => event.stopPropagation()}>
            <span><Trash2 size={24} /></span><small>CONFIRMAR EXCLUSÃO</small><h2>Excluir “{deleteTarget.name}”?</h2><p>Os exercícios e configurações desta ficha também serão removidos. Esta ação não pode ser desfeita.</p>
            <div><button onClick={() => setDeleteTarget(null)}>Cancelar</button><button onClick={() => void remove()} disabled={saving}><Trash2 size={16} /> {saving ? 'Excluindo...' : 'Excluir treino'}</button></div>
          </div>
        </div>
      )}
    </section>
  )
}

function WeeklyWorkoutView({ workouts }: { workouts: WorkoutSummary[] }) {
  const schedule = useMemo(() => weekDays.map((day) => ({
    day,
    workouts: workouts.filter((workout) => workout.active && workout.days.includes(day)),
  })), [workouts])
  return (
    <section className="weekly-workout-view">
      <div className="training-section-heading"><div><small>VISÃO SEMANAL</small><h2>Sua semana de treinos</h2></div><CalendarDays size={20} /></div>
      <div className="weekly-days">
        {schedule.map(({ day, workouts: dayWorkouts }) => (
          <div key={day} className={dayWorkouts.length ? 'has-workout' : ''}>
            <strong>{day.slice(0, 3)}</strong>
            <span>{dayWorkouts.length ? dayWorkouts.map((workout) => workout.name).join(' + ') : 'Descanso'}</span>
            {dayWorkouts.length > 0 && <i />}
          </div>
        ))}
      </div>
    </section>
  )
}

function TrainingHubLoading() {
  return <section className="training-hub-page" role="status"><div className="training-loading training-loading--heading" /><div className="training-loading training-loading--tabs" /><div className="training-loading training-loading--week" /><div className="training-loading-grid">{[1,2,3].map((item) => <div className="training-loading" key={item} />)}</div></section>
}
