import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowRight, Check, ChevronLeft, CircleStop, Dumbbell, Gauge,
  ImageOff, Medal, Pause, Play, RefreshCw, Save, SkipForward, Timer, Volume2, X,
} from 'lucide-react'
import { workoutExecutionService } from '../services/workoutExecutionService'
import type { ExerciseLibraryItem } from '../types/exerciseLibrary'
import type { ExecutionSet, WorkoutExecutionProps, WorkoutExecutionSession, WorkoutFinishSummary } from '../types/workoutExecution'

export function WorkoutExecutionPage({ userId, workout, recoverySessionId, library, onExit }: WorkoutExecutionProps) {
  const [session, setSession] = useState<WorkoutExecutionSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [restRemaining, setRestRemaining] = useState(0)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [difficulty, setDifficulty] = useState(3)
  const [finalNotes, setFinalNotes] = useState('')
  const [summary, setSummary] = useState<WorkoutFinishSummary | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    async function prepare() {
      try {
        const loaded = recoverySessionId
          ? await workoutExecutionService.load(recoverySessionId, userId)
          : workout ? await workoutExecutionService.start(userId, workout, library) : await workoutExecutionService.getActive(userId)
        if (active) setSession(loaded)
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Não foi possível iniciar o treino.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void prepare()
    return () => { active = false }
  }, [library, recoverySessionId, userId, workout])

  useEffect(() => {
    if (!session || session.status === 'paused' || summary) return
    const update = () => setElapsed(activeSeconds(session))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [session, summary])

  useEffect(() => {
    if (restRemaining <= 0 || session?.status === 'paused') return
    const timer = window.setInterval(() => {
      setRestRemaining((current) => {
        if (current <= 1) {
          notifyRestFinished()
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [restRemaining > 0, session?.status])

  const current = session?.exercises[session.currentExerciseIndex]
  const progress = useMemo(() => {
    if (!session) return 0
    const all = session.exercises.flatMap((exercise) => exercise.sets)
    return all.length ? Math.round(all.filter((set) => set.completed).length / all.length * 100) : 0
  }, [session])

  function patchSet(setId: string, patch: Partial<ExecutionSet>, persist = true) {
    if (!session || !current) return
    const nextSet = { ...current.sets.find((set) => set.id === setId)!, ...patch }
    const next = { ...session, exercises: session.exercises.map((exercise) => exercise.id === current.id
      ? { ...exercise, sets: exercise.sets.map((set) => set.id === setId ? nextSet : set) } : exercise) }
    setSession(next)
    if (persist) void workoutExecutionService.saveSet(userId, nextSet, current).catch((err) => setError(err.message))
  }

  async function completeSet(set: ExecutionSet) {
    if (!current) return
    if (!set.repetitions || set.repetitions < 1) {
      setError('Informe as repetições realizadas.')
      return
    }
    setError('')
    const nextSet = { ...set, completed: true }
    const personalRecord = await workoutExecutionService.saveSet(userId, nextSet, current, true)
    patchSet(set.id, { completed: true, personalRecord }, false)
    setRestRemaining(current.restSeconds)
  }

  async function goTo(index: number) {
    if (!session) return
    const safeIndex = Math.min(Math.max(index, 0), session.exercises.length - 1)
    setSession({ ...session, currentExerciseIndex: safeIndex })
    setRestRemaining(0)
    await workoutExecutionService.setCurrentExercise(userId, session.id, safeIndex)
  }

  async function togglePause() {
    if (!session) return
    const paused = session.status !== 'paused'
    const patch = await workoutExecutionService.setPaused(userId, session, paused)
    setSession({ ...session, status: paused ? 'paused' : 'active', ...patch })
  }

  async function skip() {
    if (!session || !current) return
    await workoutExecutionService.skipExercise(userId, current.id)
    setSession({ ...session, exercises: session.exercises.map((exercise) => exercise.id === current.id ? { ...exercise, skipped: true } : exercise) })
    if (session.currentExerciseIndex < session.exercises.length - 1) await goTo(session.currentExerciseIndex + 1)
  }

  async function replace(replacement: ExerciseLibraryItem) {
    if (!session || !current) return
    await workoutExecutionService.replaceExercise(userId, current.id, replacement)
    setSession({ ...session, exercises: session.exercises.map((exercise) => exercise.id === current.id ? {
      ...exercise, name: replacement.name, libraryExerciseId: replacement.id, imageUrl: replacement.imageUrl,
      notes: replacement.safetyTips[0] ?? exercise.notes,
    } : exercise) })
    setReplaceOpen(false)
  }

  async function abandon() {
    if (!session) return
    await workoutExecutionService.abandon(userId, session.id)
    onExit()
  }

  async function finish() {
    if (!session) return
    setSaving(true)
    try {
      const result = await workoutExecutionService.finish(userId, session, difficulty, finalNotes)
      setSummary(result)
      setFinishOpen(false)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível concluir o treino.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="execution-state"><RefreshCw className="ai-loader" /><h1>Preparando seu treino...</h1></div>
  if (error && !session) return <div className="execution-state"><AlertTriangle /><h1>Treino indisponível</h1><p>{error}</p><button onClick={onExit}>Voltar</button></div>
  if (!session || !current) return <div className="execution-state"><Dumbbell /><h1>Nenhum treino em andamento</h1><button onClick={onExit}>Voltar</button></div>
  if (summary) return <WorkoutSummaryView summary={summary} difficulty={difficulty} notes={finalNotes} onDone={onExit} />

  return (
    <section className={`workout-execution ${session.status === 'paused' ? 'is-paused' : ''}`}>
      <header className="execution-header">
        <button onClick={() => setConfirmAbandon(true)} aria-label="Sair"><ChevronLeft /></button>
        <div><small>TREINO EM ANDAMENTO</small><h1>{session.workoutName}</h1></div>
        <div className="execution-clock"><Timer size={16} /><strong>{formatTime(elapsed)}</strong></div>
      </header>
      <div className="execution-progress"><span style={{ width: `${progress}%` }} /><small>{progress}% concluído</small></div>
      {error && <div className="training-feedback is-error"><AlertTriangle size={17} />{error}<button onClick={() => setError('')}><X size={14} /></button></div>}

      <div className="execution-layout">
        <main>
          <div className="execution-exercise-visual">
            {current.gifUrl || current.imageUrl || current.thumbnailUrl || current.externalId ? <img src={current.gifUrl || current.imageUrl || current.thumbnailUrl || `https://static.exercisedb.dev/media/${encodeURIComponent(current.externalId || '')}.gif`} alt={`Demonstração de ${current.name}`} loading="eager" /> : current.videoUrl ? <video src={current.videoUrl} autoPlay loop muted playsInline preload="metadata" aria-label={`Demonstração de ${current.name}`} /> : <div><ImageOff size={35} /><span>Demonstração indisponível</span></div>}
            <i>{session.currentExerciseIndex + 1} / {session.exercises.length}</i>
          </div>
          <div className="execution-exercise-title">
            <div><small>EXERCÍCIO ATUAL</small><h2>{current.name}</h2><p>{current.plannedSets} séries · {current.plannedRepetitions} repetições</p></div>
            <button onClick={() => setReplaceOpen(true)}><RefreshCw size={15} /> Trocar</button>
          </div>
          <div className="execution-weight-history">
            <span><small>Carga recomendada</small><strong>{formatKg(current.recommendedWeight)}</strong></span>
            <span><small>Usada anteriormente</small><strong>{formatKg(current.previousWeight)}</strong></span>
          </div>
          <div className="execution-sets">
            <div className="execution-set-head"><span>Série</span><span>Carga atual</span><span>Repetições</span><span>Status</span></div>
            {current.sets.map((set) => (
              <div className={`execution-set-row ${set.completed ? 'is-complete' : ''}`} key={set.id}>
                <strong>{set.setNumber}</strong>
                <label><input type="number" inputMode="decimal" min="0" value={set.weight ?? ''} onChange={(event) => patchSet(set.id, { weight: numberInput(event.target.value) })} /><span>kg</span></label>
                <label><input type="number" inputMode="numeric" min="0" value={set.repetitions ?? ''} placeholder={set.plannedRepetitions} onChange={(event) => patchSet(set.id, { repetitions: numberInput(event.target.value) })} /><span>reps</span></label>
                <button disabled={set.completed} onClick={() => void completeSet(set)}>{set.completed ? <><Check size={16} /> Feita</> : 'Concluir série'}</button>
              </div>
            ))}
          </div>
          {current.notes && <div className="execution-notes"><strong>Observações</strong><p>{current.notes}</p></div>}
        </main>

        <aside>
          <div className={`rest-timer ${restRemaining > 0 ? 'is-running' : ''}`}>
            <Volume2 size={18} /><small>DESCANSO</small><strong>{formatTime(restRemaining)}</strong>
            <div><button onClick={() => setRestRemaining((value) => value + 15)}>+15s</button><button onClick={() => setRestRemaining(0)}>Pular</button></div>
          </div>
          <div className="execution-controls">
            <button onClick={() => void togglePause()}>{session.status === 'paused' ? <Play /> : <Pause />} {session.status === 'paused' ? 'Continuar' : 'Pausar'}</button>
            <button onClick={() => void skip()}><SkipForward /> Pular exercício</button>
            <button onClick={() => setFinishOpen(true)}><CircleStop /> Encerrar treino</button>
          </div>
          {session.currentExerciseIndex < session.exercises.length - 1 && <button className="next-exercise" onClick={() => void goTo(session.currentExerciseIndex + 1)}><span><small>PRÓXIMO EXERCÍCIO</small><strong>{session.exercises[session.currentExerciseIndex + 1].name}</strong></span><ArrowRight /></button>}
        </aside>
      </div>

      {session.status === 'paused' && <div className="pause-overlay"><Pause size={34} /><h2>Treino pausado</h2><button onClick={() => void togglePause()}><Play size={18} /> Continuar treino</button></div>}
      {replaceOpen && <ChoiceModal library={library} currentId={current.libraryExerciseId} onChoose={(item) => void replace(item)} onClose={() => setReplaceOpen(false)} />}
      {confirmAbandon && <ConfirmModal title="Abandonar este treino?" text="Seu progresso parcial ficará no histórico como treino abandonado." confirm="Abandonar" onConfirm={() => void abandon()} onClose={() => setConfirmAbandon(false)} />}
      {finishOpen && <FinishModal difficulty={difficulty} notes={finalNotes} saving={saving} onDifficulty={setDifficulty} onNotes={setFinalNotes} onConfirm={() => void finish()} onClose={() => setFinishOpen(false)} />}
    </section>
  )
}

function ChoiceModal({ library, currentId, onChoose, onClose }: { library: ExerciseLibraryItem[]; currentId: string | null; onChoose: (item: ExerciseLibraryItem) => void; onClose: () => void }) {
  return <div className="execution-modal-backdrop" onMouseDown={onClose}><div className="execution-choice-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><small>TROCAR EXERCÍCIO</small><h2>Escolha uma alternativa</h2></div><button onClick={onClose}><X /></button></header><div>{library.filter((item) => item.id !== currentId).map((item) => <button key={item.id} onClick={() => onChoose(item)}><Dumbbell /><span><strong>{item.name}</strong><small>{item.primaryMuscle} · {item.equipment}</small></span><ArrowRight /></button>)}</div></div></div>
}

function ConfirmModal({ title, text, confirm, onConfirm, onClose }: { title: string; text: string; confirm: string; onConfirm: () => void; onClose: () => void }) {
  return <div className="execution-modal-backdrop"><div className="execution-confirm"><AlertTriangle /><h2>{title}</h2><p>{text}</p><div><button onClick={onClose}>Continuar treino</button><button onClick={onConfirm}>{confirm}</button></div></div></div>
}

function FinishModal({ difficulty, notes, saving, onDifficulty, onNotes, onConfirm, onClose }: { difficulty: number; notes: string; saving: boolean; onDifficulty: (value: number) => void; onNotes: (value: string) => void; onConfirm: () => void; onClose: () => void }) {
  return <div className="execution-modal-backdrop"><div className="execution-finish-modal"><Medal /><small>FINALIZAR TREINO</small><h2>Como foi seu treino?</h2><p>Avalie a dificuldade e registre uma observação opcional.</p><div className="difficulty-picker">{[1,2,3,4,5].map((value) => <button className={difficulty === value ? 'is-active' : ''} onClick={() => onDifficulty(value)} key={value}>{value}</button>)}</div><textarea value={notes} onChange={(event) => onNotes(event.target.value)} placeholder="Como você se sentiu? Alguma observação?" /><div className="execution-finish-actions"><button onClick={onClose}>Voltar</button><button onClick={onConfirm} disabled={saving}><Save size={16} /> {saving ? 'Salvando...' : 'Concluir e salvar'}</button></div></div></div>
}

function WorkoutSummaryView({ summary, difficulty, notes, onDone }: { summary: WorkoutFinishSummary; difficulty: number; notes: string; onDone: () => void }) {
  return <section className="workout-finish-summary"><span><Medal size={35} /></span><small>TREINO CONCLUÍDO</small><h1>Excelente trabalho!</h1><p>Seu treino foi salvo e já faz parte da sua evolução.</p><div className="finish-summary-grid"><SummaryCard icon={<Timer />} label="Duração" value={formatTime(summary.durationSeconds)} /><SummaryCard icon={<Dumbbell />} label="Exercícios" value={String(summary.exercisesCompleted)} /><SummaryCard icon={<Gauge />} label="Volume total" value={`${Math.round(summary.volumeTotal)} kg`} /><SummaryCard icon={<Check />} label="Séries concluídas" value={String(summary.completedSets)} /><SummaryCard icon={<Medal />} label="Recordes pessoais" value={String(summary.personalRecords)} /><SummaryCard icon={<ArrowRight />} label="Vs. treino anterior" value={summary.volumeDifference === null ? 'Primeiro registro' : `${summary.volumeDifference >= 0 ? '+' : ''}${Math.round(summary.volumeDifference)} kg`} /></div><div className="finish-feedback"><strong>Dificuldade: {difficulty}/5</strong>{notes && <p>{notes}</p>}</div><button onClick={onDone}>Voltar aos meus treinos</button></section>
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div>{icon}<small>{label}</small><strong>{value}</strong></div>
}

function notifyRestFinished() {
  if ('vibrate' in navigator) navigator.vibrate([180, 90, 180])
  try {
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    oscillator.connect(context.destination)
    oscillator.frequency.value = 880
    oscillator.start()
    oscillator.stop(context.currentTime + 0.22)
  } catch { /* navegador sem áudio programático */ }
}

function activeSeconds(session: WorkoutExecutionSession) {
  const pausedNow = session.pausedAt ? Math.floor((Date.now() - new Date(session.pausedAt).getTime()) / 1000) : 0
  return Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000) - session.totalPausedSeconds - pausedNow)
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const remaining = safe % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
}

function formatKg(value: number | null) {
  return value === null ? 'Sem registro' : `${value} kg`
}

function numberInput(value: string) {
  return value === '' ? null : Math.max(0, Number(value))
}
