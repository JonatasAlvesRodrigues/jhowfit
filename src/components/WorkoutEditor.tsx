import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Dumbbell,
  GripVertical,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import type { ExerciseLibraryItem } from '../types/exerciseLibrary'
import type { TrainingExercise, WorkoutDraft } from '../types/trainingPlan'
import { weekDays } from '../types/trainingPlan'

export function WorkoutEditor({
  initial,
  library,
  saving,
  onSave,
  onCancel,
}: {
  initial: WorkoutDraft
  library: ExerciseLibraryItem[]
  saving: boolean
  onSave: (draft: WorkoutDraft) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<WorkoutDraft>(() => structuredClone(initial))
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)

  function submit() {
    const validation = validateWorkout(draft)
    if (validation) {
      setError(validation)
      return
    }
    setError('')
    onSave(draft)
  }

  function updateExercise(clientId: string, patch: Partial<TrainingExercise>) {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) => exercise.clientId === clientId ? { ...exercise, ...patch } : exercise),
    }))
  }

  function moveExercise(clientId: string, direction: -1 | 1) {
    setDraft((current) => {
      const index = current.exercises.findIndex((exercise) => exercise.clientId === clientId)
      const destination = index + direction
      if (index < 0 || destination < 0 || destination >= current.exercises.length) return current
      const exercises = [...current.exercises]
      const [moved] = exercises.splice(index, 1)
      exercises.splice(destination, 0, moved)
      return { ...current, exercises }
    })
  }

  function dropBefore(targetId: string) {
    if (!draggedId || draggedId === targetId) return
    setDraft((current) => {
      const exercises = [...current.exercises]
      const from = exercises.findIndex((exercise) => exercise.clientId === draggedId)
      const to = exercises.findIndex((exercise) => exercise.clientId === targetId)
      if (from < 0 || to < 0) return current
      const [moved] = exercises.splice(from, 1)
      exercises.splice(to, 0, moved)
      return { ...current, exercises }
    })
    setDraggedId(null)
  }

  return (
    <section className="workout-editor">
      <header className="workout-editor__header">
        <button onClick={onCancel}><ArrowLeft size={17} /> Voltar</button>
        <div><small>{draft.id ? 'EDITAR FICHA' : 'NOVA FICHA'}</small><h1>{draft.id ? draft.name : 'Monte seu treino'}</h1></div>
        <button className="editor-save-top" onClick={submit} disabled={saving}><Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}</button>
      </header>

      {error && <div className="workout-editor-error">{error}</div>}

      <div className="workout-editor-layout">
        <aside className="workout-editor-settings">
          <label className="training-field">
            <span>Nome do treino</span>
            <input value={draft.name} maxLength={80} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Treino A" />
          </label>
          <div className="training-field">
            <span>Dias da semana</span>
            <div className="training-day-picker">
              {weekDays.map((day) => <button key={day} className={draft.days.includes(day) ? 'is-selected' : ''} onClick={() => setDraft((current) => ({ ...current, days: current.days.includes(day) ? current.days.filter((item) => item !== day) : [...current.days, day] }))}>{day.slice(0, 3)}</button>)}
            </div>
          </div>
          <div className="training-inline-fields">
            <label className="training-field"><span>Duração estimada</span><div className="training-unit"><input type="number" min="10" max="240" value={draft.durationMinutes} onChange={(event) => setDraft((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} /><i>min</i></div></label>
            <label className="training-field"><span>Estado</span><select value={draft.active ? 'active' : 'inactive'} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.value === 'active' }))}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label>
          </div>
          <label className="training-field">
            <span>Foco do treino</span>
            <input value={draft.focus} maxLength={120} onChange={(event) => setDraft((current) => ({ ...current, focus: event.target.value }))} placeholder="Ex.: Força e hipertrofia" />
          </label>
          <label className="training-field">
            <span>Observações gerais</span>
            <textarea value={draft.notes} maxLength={1000} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Orientações para esta sessão..." />
          </label>
        </aside>

        <main className="workout-exercise-editor">
          <div className="workout-exercise-editor__heading">
            <div><small>EXERCÍCIOS</small><h2>{draft.exercises.length} selecionados</h2></div>
            <button onClick={() => setPickerOpen(true)}><Plus size={16} /> Adicionar exercício</button>
          </div>

          {draft.exercises.length ? (
            <div className="configured-exercise-list">
              {draft.exercises.map((exercise, index) => (
                <article
                  key={exercise.clientId}
                  draggable
                  onDragStart={() => setDraggedId(exercise.clientId)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropBefore(exercise.clientId)}
                  className={draggedId === exercise.clientId ? 'is-dragging' : ''}
                >
                  <div className="configured-exercise-header">
                    <span className="drag-handle"><GripVertical size={18} /></span>
                    <i>{String(index + 1).padStart(2, '0')}</i>
                    <div><strong>{exercise.name}</strong><small>{exercise.optional ? 'Exercício opcional' : 'Exercício principal'}</small></div>
                    <div className="exercise-order-actions">
                      <button onClick={() => moveExercise(exercise.clientId, -1)} disabled={index === 0} aria-label="Mover para cima"><ArrowUp size={15} /></button>
                      <button onClick={() => moveExercise(exercise.clientId, 1)} disabled={index === draft.exercises.length - 1} aria-label="Mover para baixo"><ArrowDown size={15} /></button>
                      <button className="remove-configured-exercise" onClick={() => setDraft((current) => ({ ...current, exercises: current.exercises.filter((item) => item.clientId !== exercise.clientId) }))} aria-label="Remover exercício"><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <div className="exercise-config-grid">
                    <label><span>Séries</span><input type="number" min="1" max="20" value={exercise.sets} onChange={(event) => updateExercise(exercise.clientId, { sets: Number(event.target.value) })} /></label>
                    <label><span>Repetições</span><input value={exercise.repetitions} maxLength={40} onChange={(event) => updateExercise(exercise.clientId, { repetitions: event.target.value })} /></label>
                    <label><span>Carga inicial</span><div className="training-unit"><input type="number" min="0" step=".5" value={exercise.initialWeight ?? ''} onChange={(event) => updateExercise(exercise.clientId, { initialWeight: event.target.value === '' ? null : Number(event.target.value) })} /><i>kg</i></div></label>
                    <label><span>Descanso</span><div className="training-unit"><input type="number" min="0" max="900" value={exercise.restSeconds} onChange={(event) => updateExercise(exercise.clientId, { restSeconds: Number(event.target.value) })} /><i>s</i></div></label>
                    <label className="is-wide"><span>Técnica avançada</span><select value={exercise.advancedTechnique} onChange={(event) => updateExercise(exercise.clientId, { advancedTechnique: event.target.value })}><option value="">Nenhuma</option><option>Drop-set</option><option>Bi-set</option><option>Rest-pause</option><option>Pirâmide</option><option>Cluster set</option></select></label>
                    <label className="is-wide"><span>Observações</span><input value={exercise.notes} maxLength={500} onChange={(event) => updateExercise(exercise.clientId, { notes: event.target.value })} placeholder="Execução, cadência ou ajuste..." /></label>
                  </div>
                  <label className="optional-exercise-toggle"><input type="checkbox" checked={exercise.optional} onChange={(event) => updateExercise(exercise.clientId, { optional: event.target.checked })} /><span><Check size={13} /></span> Marcar como opcional</label>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-workout-exercises">
              <span><Dumbbell size={27} /></span><h3>Adicione o primeiro exercício</h3><p>Escolha na biblioteca e configure séries, repetições, carga e descanso.</p><button onClick={() => setPickerOpen(true)}><Plus size={16} /> Abrir biblioteca</button>
            </div>
          )}
        </main>
      </div>

      <div className="workout-editor-mobile-actions"><button onClick={onCancel}>Cancelar</button><button onClick={submit} disabled={saving}><Save size={16} /> {saving ? 'Salvando...' : 'Salvar treino'}</button></div>

      {pickerOpen && (
        <ExercisePicker
          library={library}
          selectedIds={new Set(draft.exercises.map((exercise) => exercise.libraryExerciseId))}
          onSelect={(exercise) => {
            setDraft((current) => ({ ...current, exercises: [...current.exercises, createTrainingExercise(exercise)] }))
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </section>
  )
}

function ExercisePicker({ library, selectedIds, onSelect, onClose }: { library: ExerciseLibraryItem[]; selectedIds: Set<string | null>; onSelect: (exercise: ExerciseLibraryItem) => void; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const term = normalize(search)
    return library.filter((exercise) => !term || normalize(`${exercise.name} ${exercise.primaryMuscle} ${exercise.equipment}`).includes(term))
  }, [library, search])
  return (
    <div className="training-modal-backdrop" onMouseDown={onClose}>
      <div className="exercise-picker-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><small>BIBLIOTECA</small><h2>Adicionar exercícios</h2></div><button onClick={onClose}><X size={19} /></button></header>
        <label className="exercise-picker-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar exercício..." /></label>
        <div className="exercise-picker-list">
          {filtered.map((exercise) => {
            const selected = selectedIds.has(exercise.id)
            return <button key={exercise.id} onClick={() => !selected && onSelect(exercise)} disabled={selected}><span><Dumbbell size={18} /></span><div><strong>{exercise.name}</strong><small>{exercise.primaryMuscle} · {exercise.equipment}</small></div>{selected ? <Check size={17} /> : <Plus size={17} />}</button>
          })}
        </div>
        <button className="exercise-picker-done" onClick={onClose}>Concluir</button>
      </div>
    </div>
  )
}

export function createTrainingExercise(exercise: ExerciseLibraryItem): TrainingExercise {
  return {
    clientId: crypto.randomUUID(),
    libraryExerciseId: exercise.id,
    name: exercise.name,
    sets: 3,
    repetitions: '10',
    initialWeight: null,
    restSeconds: 60,
    notes: '',
    optional: false,
    advancedTechnique: '',
    substitutions: exercise.substitutions,
  }
}

export function createEmptyWorkout(): WorkoutDraft {
  return {
    name: '',
    days: [],
    notes: '',
    active: true,
    source: 'manual',
    durationMinutes: 45,
    focus: '',
    exercises: [],
  }
}

function validateWorkout(draft: WorkoutDraft) {
  if (draft.name.trim().length < 3) return 'Informe um nome com pelo menos 3 caracteres.'
  if (!draft.days.length) return 'Selecione pelo menos um dia da semana.'
  if (!draft.exercises.length) return 'Adicione pelo menos um exercício.'
  if (draft.durationMinutes < 10 || draft.durationMinutes > 240) return 'A duração deve ficar entre 10 e 240 minutos.'
  for (const exercise of draft.exercises) {
    if (exercise.sets < 1 || exercise.sets > 20) return `Revise a quantidade de séries de ${exercise.name}.`
    if (!exercise.repetitions.trim()) return `Informe as repetições de ${exercise.name}.`
    if (exercise.restSeconds < 0 || exercise.restSeconds > 900) return `Revise o descanso de ${exercise.name}.`
    if (exercise.initialWeight !== null && exercise.initialWeight < 0) return `A carga de ${exercise.name} não pode ser negativa.`
  }
  return ''
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
