import { supabase } from '../integrations/supabase'
import type { ExerciseProgressHistory, HistoryRank, WorkoutHistoryData } from '../types/workoutHistory'

export const workoutHistoryService = {
  async getHistory(userId: string): Promise<WorkoutHistoryData> {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
    const since = new Date()
    since.setMonth(since.getMonth() - 12)
    const { data: sessions, error: sessionsError } = await supabase.from('workout_sessions')
      .select('id,status,started_at,ended_at,duration_seconds,volume_total,completed_sets')
      .eq('user_id', userId).in('status', ['completed', 'abandoned'])
      .gte('started_at', since.toISOString()).order('started_at')
    if (sessionsError) throw new Error('Não foi possível carregar o histórico de treinos.')

    const completed = (sessions ?? []).filter((session) => session.status === 'completed')
    const completedIds = completed.map((session) => session.id)
    let exerciseRows: any[] = []
    if (completedIds.length) {
      const { data, error } = await supabase.from('workout_session_exercises')
        .select('session_id,library_exercise_id,name,skipped,workout_session_sets(weight,repetitions,completed)')
        .eq('user_id', userId).in('session_id', completedIds)
      if (error) throw new Error('Não foi possível carregar a evolução dos exercícios.')
      exerciseRows = data ?? []
    }
    const libraryIds = [...new Set(exerciseRows.map((row) => row.library_exercise_id).filter(Boolean))]
    const muscleByLibrary = new Map<string, string>()
    if (libraryIds.length) {
      const { data } = await supabase.from('exercise_library').select('id,primary_muscle').in('id', libraryIds)
      for (const item of data ?? []) muscleByLibrary.set(item.id, item.primary_muscle)
    }

    const sessionById = new Map(completed.map((session) => [session.id, session]))
    const performed = exerciseRows.filter((row) => !row.skipped && completedSets(row).length)
    const exerciseCounts = countRanks(performed.map((row) => row.name))
    const muscleCounts = countRanks(performed.map((row) => muscleByLibrary.get(row.library_exercise_id) ?? 'Não informado'))
    const exercises = buildExerciseHistory(performed, sessionById, muscleByLibrary)

    return {
      completedDates: completed.map((session) => localDate(new Date(session.ended_at ?? session.started_at))),
      totalWorkouts: completed.length,
      totalDurationSeconds: completed.reduce((sum, session) => sum + Number(session.duration_seconds ?? 0), 0),
      totalVolume: completed.reduce((sum, session) => sum + Number(session.volume_total ?? 0), 0),
      completionRate: sessions?.length ? Math.round(completed.length / sessions.length * 100) : 0,
      weekly: buildWeeks(completed),
      topExercises: exerciseCounts.slice(0, 5),
      muscleFrequency: muscleCounts,
      exercises,
    }
  },
}

function buildExerciseHistory(rows: any[], sessionById: Map<string, any>, muscleByLibrary: Map<string, string>): ExerciseProgressHistory[] {
  const grouped = new Map<string, any[]>()
  for (const row of rows) grouped.set(row.name, [...(grouped.get(row.name) ?? []), row])
  return [...grouped.entries()].map(([name, entries]) => {
    const points = entries.map((entry) => {
      const sets = completedSets(entry)
      const session = sessionById.get(entry.session_id)
      return {
        date: session?.ended_at ?? session?.started_at,
        label: shortDate(session?.ended_at ?? session?.started_at),
        maxWeight: Math.max(0, ...sets.map((set: any) => Number(set.weight ?? 0))),
        repetitions: sets.reduce((sum: number, set: any) => sum + Number(set.repetitions ?? 0), 0),
        volume: sets.reduce((sum: number, set: any) => sum + Number(set.weight ?? 0) * Number(set.repetitions ?? 0), 0),
      }
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const currentMonth = monthKey(new Date())
    const previousDate = new Date()
    previousDate.setMonth(previousDate.getMonth() - 1)
    const previousMonth = monthKey(previousDate)
    const currentVolume = points.filter((point) => monthKey(new Date(point.date)) === currentMonth).reduce((sum, point) => sum + point.volume, 0)
    const previousVolume = points.filter((point) => monthKey(new Date(point.date)) === previousMonth).reduce((sum, point) => sum + point.volume, 0)
    return {
      name,
      muscleGroup: muscleByLibrary.get(entries.find((entry) => entry.library_exercise_id)?.library_exercise_id) ?? 'Não informado',
      sessions: points.length,
      bestWeight: Math.max(0, ...points.map((point) => point.maxWeight)),
      bestVolume: Math.max(0, ...points.map((point) => point.volume)),
      lastWorkout: points[points.length - 1]?.date ?? '',
      monthlyDifference: previousVolume > 0 ? Math.round((currentVolume - previousVolume) / previousVolume * 100) : null,
      points,
      suggestion: progressionSuggestion(points),
    }
  }).sort((a, b) => b.sessions - a.sessions)
}

function progressionSuggestion(points: Array<{ maxWeight: number; repetitions: number; volume: number }>) {
  if (points.length < 2) return { action: 'maintain' as const, title: 'Manter carga', text: 'Colete mais um treino antes de progredir.' }
  const last = points[points.length - 1]
  const previous = points[points.length - 2]
  if (last.volume < previous.volume * .85) return { action: 'reduce' as const, title: 'Reduzir carga', text: 'O desempenho caiu. Considere reduzir 5% e priorizar a técnica.' }
  if (last.maxWeight > previous.maxWeight && last.volume >= previous.volume) return { action: 'maintain' as const, title: 'Manter carga', text: 'A carga já subiu. Consolide a execução antes de aumentar novamente.' }
  if (last.repetitions > previous.repetitions && last.volume >= previous.volume) return { action: 'increase' as const, title: 'Aumentar carga', text: 'Se a técnica estiver estável, teste um aumento pequeno de 2% a 5%.' }
  return { action: 'repetitions' as const, title: 'Tentar mais repetições', text: 'Mantenha a carga e tente acrescentar 1 repetição por série.' }
}

function buildWeeks(sessions: any[]) {
  const weeks = Array.from({ length: 8 }, (_, reverseIndex) => {
    const index = 7 - reverseIndex
    const start = startOfWeek(new Date())
    start.setDate(start.getDate() - index * 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    return { label: `${start.getDate()}/${start.getMonth() + 1}`, count: sessions.filter((session) => {
      const date = new Date(session.ended_at ?? session.started_at)
      return date >= start && date < end
    }).length }
  })
  return weeks
}

function completedSets(row: any) {
  return (row.workout_session_sets ?? []).filter((set: any) => set.completed)
}

function countRanks(values: string[]): HistoryRank[] {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

function startOfWeek(date: Date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = result.getDay() || 7
  result.setDate(result.getDate() - day + 1)
  result.setHours(0, 0, 0, 0)
  return result
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(value))
}

function localDate(date: Date) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}
