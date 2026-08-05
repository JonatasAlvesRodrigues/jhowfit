import { supabase } from '../integrations/supabase'
import type { ExerciseLibraryItem } from '../types/exerciseLibrary'
import type { WorkoutSummary } from '../types/trainingPlan'
import type { ExecutionExercise, ExecutionSet, WorkoutExecutionSession, WorkoutFinishSummary } from '../types/workoutExecution'

const SESSION_STORAGE_KEY = 'MOVELYA:active-workout-session'

export const workoutExecutionService = {
  async getActive(userId: string) {
    requireSupabase()
    const { data, error } = await supabase!.from('workout_sessions').select('id')
      .eq('user_id', userId).in('status', ['active', 'paused']).maybeSingle()
    if (error) throw new Error('Não foi possível verificar o treino em andamento.')
    if (!data) {
      localStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }
    localStorage.setItem(SESSION_STORAGE_KEY, data.id)
    return this.load(data.id, userId)
  },

  async start(userId: string, workout: WorkoutSummary, library: ExerciseLibraryItem[]) {
    requireSupabase()
    const active = await this.getActive(userId)
    if (active) return active

    const { data: history } = await supabase!.from('workout_session_exercises')
      .select('name,workout_session_sets(weight,completed)')
      .eq('user_id', userId)
      .in('name', workout.exercises.map((exercise) => exercise.name))
    const previousByName = new Map<string, number>()
    for (const item of history ?? []) {
      const weights = ((item as any).workout_session_sets ?? [])
        .filter((set: any) => set.completed && set.weight !== null).map((set: any) => Number(set.weight))
      if (weights.length) previousByName.set(item.name, Math.max(previousByName.get(item.name) ?? 0, ...weights))
    }

    const { data: session, error: sessionError } = await supabase!.from('workout_sessions').insert({
      user_id: userId, workout_id: workout.id, workout_name: workout.name,
      exercise_count: workout.exercises.length,
    }).select('id').single()
    if (sessionError || !session) throw new Error('Não foi possível iniciar o treino.')

    try {
      const exerciseRows = workout.exercises.map((exercise, position) => {
        const libraryItem = library.find((item) => item.id === exercise.libraryExerciseId)
        return {
          session_id: session.id, user_id: userId, source_exercise_id: exercise.id ?? null,
          library_exercise_id: exercise.libraryExerciseId, name: exercise.name, position,
          planned_sets: exercise.sets, planned_repetitions: exercise.repetitions,
          recommended_weight: exercise.initialWeight, previous_weight: previousByName.get(exercise.name) ?? null,
          rest_seconds: exercise.restSeconds, notes: exercise.notes || null, image_url: libraryItem?.imageUrl ?? null,
        }
      })
      const { data: createdExercises, error: exerciseError } = await supabase!.from('workout_session_exercises')
        .insert(exerciseRows).select('id,planned_sets,planned_repetitions')
      if (exerciseError || !createdExercises) throw exerciseError
      const setRows = createdExercises.flatMap((exercise) =>
        Array.from({ length: exercise.planned_sets }, (_, index) => ({
          session_id: session.id, session_exercise_id: exercise.id, user_id: userId,
          set_number: index + 1, planned_repetitions: exercise.planned_repetitions,
        })),
      )
      const { error: setsError } = await supabase!.from('workout_session_sets').insert(setRows)
      if (setsError) throw setsError
    } catch {
      await supabase!.from('workout_sessions').delete().eq('id', session.id).eq('user_id', userId)
      throw new Error('Não foi possível preparar as séries do treino.')
    }
    localStorage.setItem(SESSION_STORAGE_KEY, session.id)
    return this.load(session.id, userId)
  },

  async load(sessionId: string, userId: string): Promise<WorkoutExecutionSession> {
    requireSupabase()
    const [sessionResult, exercisesResult] = await Promise.all([
      supabase!.from('workout_sessions').select('*').eq('id', sessionId).eq('user_id', userId).single(),
      supabase!.from('workout_session_exercises')
        .select('*,workout_session_sets(*)').eq('session_id', sessionId).eq('user_id', userId).order('position'),
    ])
    if (sessionResult.error || exercisesResult.error) throw new Error('Não foi possível recuperar o treino.')
    return {
      id: sessionResult.data.id, workoutId: sessionResult.data.workout_id,
      workoutName: sessionResult.data.workout_name, status: sessionResult.data.status,
      startedAt: sessionResult.data.started_at, pausedAt: sessionResult.data.paused_at,
      totalPausedSeconds: Number(sessionResult.data.total_paused_seconds ?? 0),
      currentExerciseIndex: Number(sessionResult.data.current_exercise_index ?? 0),
      exercises: (exercisesResult.data ?? []).map(mapExercise),
    }
  },

  async saveSet(userId: string, set: ExecutionSet, exercise: ExecutionExercise, completed = set.completed) {
    requireSupabase()
    const personalRecord = completed && Number(set.weight ?? 0) > Number(exercise.previousWeight ?? 0)
    const { error } = await supabase!.from('workout_session_sets').update({
      weight: set.weight, repetitions: set.repetitions, completed,
      completed_at: completed ? new Date().toISOString() : null,
      is_personal_record: personalRecord, updated_at: new Date().toISOString(),
    }).eq('id', set.id).eq('user_id', userId)
    if (error) throw new Error('Não foi possível salvar esta série.')
    return personalRecord
  },

  async setCurrentExercise(userId: string, sessionId: string, index: number) {
    requireSupabase()
    await supabase!.from('workout_sessions').update({
      current_exercise_index: index, updated_at: new Date().toISOString(),
    }).eq('id', sessionId).eq('user_id', userId)
  },

  async setPaused(userId: string, session: WorkoutExecutionSession, paused: boolean) {
    requireSupabase()
    let pausedSeconds = session.totalPausedSeconds
    if (!paused && session.pausedAt) pausedSeconds += Math.max(0, Math.floor((Date.now() - new Date(session.pausedAt).getTime()) / 1000))
    const { error } = await supabase!.from('workout_sessions').update({
      status: paused ? 'paused' : 'active',
      paused_at: paused ? new Date().toISOString() : null,
      total_paused_seconds: pausedSeconds,
      updated_at: new Date().toISOString(),
    }).eq('id', session.id).eq('user_id', userId)
    if (error) throw new Error('Não foi possível pausar o treino.')
    return { pausedAt: paused ? new Date().toISOString() : null, totalPausedSeconds: pausedSeconds }
  },

  async skipExercise(userId: string, exerciseId: string) {
    requireSupabase()
    const { error } = await supabase!.from('workout_session_exercises').update({
      skipped: true, updated_at: new Date().toISOString(),
    }).eq('id', exerciseId).eq('user_id', userId)
    if (error) throw new Error('Não foi possível pular o exercício.')
  },

  async replaceExercise(userId: string, exerciseId: string, replacement: ExerciseLibraryItem) {
    requireSupabase()
    const { error } = await supabase!.from('workout_session_exercises').update({
      library_exercise_id: replacement.id, name: replacement.name, image_url: replacement.imageUrl,
      notes: replacement.safetyTips[0] ?? null, updated_at: new Date().toISOString(),
    }).eq('id', exerciseId).eq('user_id', userId)
    if (error) throw new Error('Não foi possível trocar o exercício.')
  },

  async abandon(userId: string, sessionId: string) {
    requireSupabase()
    await supabase!.from('workout_sessions').update({
      status: 'abandoned', ended_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', sessionId).eq('user_id', userId)
    localStorage.removeItem(SESSION_STORAGE_KEY)
  },

  async finish(userId: string, session: WorkoutExecutionSession, difficulty: number, notes: string): Promise<WorkoutFinishSummary> {
    requireSupabase()
    const now = Date.now()
    const pauseInProgress = session.pausedAt ? Math.floor((now - new Date(session.pausedAt).getTime()) / 1000) : 0
    const durationSeconds = Math.max(1, Math.floor((now - new Date(session.startedAt).getTime()) / 1000) - session.totalPausedSeconds - pauseInProgress)
    const sets = session.exercises.flatMap((exercise) => exercise.sets)
    const completedSets = sets.filter((set) => set.completed)
    const volumeTotal = completedSets.reduce((sum, set) => sum + Number(set.weight ?? 0) * Number(set.repetitions ?? 0), 0)
    const exercisesCompleted = session.exercises.filter((exercise) => !exercise.skipped && exercise.sets.some((set) => set.completed)).length
    const personalRecords = completedSets.filter((set) => set.personalRecord).length
    const { data: previous } = session.workoutId ? await supabase!.from('workout_sessions')
      .select('duration_seconds,volume_total').eq('user_id', userId).eq('workout_id', session.workoutId)
      .eq('status', 'completed').order('ended_at', { ascending: false }).limit(1).maybeSingle() : { data: null }
    const { error } = await supabase!.from('workout_sessions').update({
      status: 'completed', ended_at: new Date(now).toISOString(), duration_seconds: durationSeconds,
      volume_total: volumeTotal, completed_sets: completedSets.length, exercise_count: exercisesCompleted,
      pr_count: personalRecords, difficulty, notes: notes.trim() || null, paused_at: null, updated_at: new Date().toISOString(),
    }).eq('id', session.id).eq('user_id', userId)
    if (error) throw new Error('Não foi possível concluir o treino.')
    const date = localDate()
    const { data: daily } = await supabase!.from('daily_stats').select('id,workout_minutes')
      .eq('user_id', userId).eq('date', date).maybeSingle()
    const workoutMinutes = Math.max(1, Math.round(durationSeconds / 60))
    if (daily) {
      await supabase!.from('daily_stats').update({
        workout_minutes: Number(daily.workout_minutes ?? 0) + workoutMinutes,
      }).eq('id', daily.id).eq('user_id', userId)
    } else {
      await supabase!.from('daily_stats').insert({ user_id: userId, date, workout_minutes: workoutMinutes })
    }
    localStorage.removeItem(SESSION_STORAGE_KEY)
    return {
      durationSeconds, exercisesCompleted, volumeTotal, completedSets: completedSets.length, personalRecords,
      volumeDifference: previous ? volumeTotal - Number(previous.volume_total ?? 0) : null,
      durationDifference: previous ? durationSeconds - Number(previous.duration_seconds ?? 0) : null,
    }
  },
}

function mapExercise(row: Record<string, any>): ExecutionExercise {
  return {
    id: row.id, sourceExerciseId: row.source_exercise_id, libraryExerciseId: row.library_exercise_id,
    name: row.name, position: Number(row.position), plannedSets: Number(row.planned_sets),
    plannedRepetitions: row.planned_repetitions, recommendedWeight: numberOrNull(row.recommended_weight),
    previousWeight: numberOrNull(row.previous_weight), restSeconds: Number(row.rest_seconds),
    notes: row.notes ?? '', imageUrl: row.image_url, skipped: Boolean(row.skipped),
    sets: (row.workout_session_sets ?? []).sort((a: any, b: any) => a.set_number - b.set_number).map((set: any): ExecutionSet => ({
      id: set.id, setNumber: Number(set.set_number), plannedRepetitions: set.planned_repetitions,
      weight: numberOrNull(set.weight), repetitions: numberOrNull(set.repetitions),
      completed: Boolean(set.completed), personalRecord: Boolean(set.is_personal_record),
    })),
  }
}

function numberOrNull(value: unknown) {
  return value === null || value === undefined || value === '' ? null : Number(value)
}

function requireSupabase() {
  if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
}

function localDate() {
  const date = new Date()
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

