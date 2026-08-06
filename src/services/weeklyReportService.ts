import { supabase } from '../integrations/supabase'

export interface WeeklyReport {
  start: string
  end: string
  days: number
  planned: number
  completed: number
  duration: number
  volume: number
  steps: number
  distance: number
  water: number
  calories: number
  protein: number
  weightStart: number | null
  weightEnd: number | null
  goals: number
  daily: Array<{ date: string; day: string; steps: number; duration: number; water: number }>
  largestWorkout: { name: string; minutes: number } | null
  loadRecord: { name: string; weight: number } | null
  hasData: boolean
}

export const weeklyReportService = {
  async getWeek(userId: string, weekStart: string): Promise<WeeklyReport> {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
    const start = fromLocalDate(weekStart)
    const end = addDays(start, 7)
    const previousStart = addDays(start, -7)
    const todayEnd = addDays(startOfLocalDay(new Date()), 1)
    const effectiveEnd = end < todayEnd ? end : todayEnd
    const days = Math.max(1, Math.min(7, daysBetween(start, effectiveEnd)))
    const rangeStart = toLocalDate(previousStart)
    const rangeEnd = toLocalDate(end)
    const isoStart = previousStart.toISOString()
    const isoEnd = end.toISOString()

    const [sessionsResult, workoutsResult, stepsResult, healthResult, waterResult, mealsResult, bodyResult, goalsResult, setsResult, profileResult] = await Promise.all([
      supabase.from('workout_sessions').select('id,workout_name,status,started_at,ended_at,duration_seconds,volume_total').eq('user_id', userId).gte('started_at', isoStart).lt('started_at', isoEnd),
      supabase.from('workouts').select('scheduled_days,is_active').eq('user_id', userId).eq('is_active', true),
      supabase.from('step_records').select('steps,distance_km,occurred_on').eq('user_id', userId).gte('occurred_on', rangeStart).lt('occurred_on', rangeEnd),
      supabase.from('health_sync_records').select('data_type,started_at,value,unit').eq('user_id', userId).in('data_type', ['steps', 'distance']).gte('started_at', isoStart).lt('started_at', isoEnd),
      supabase.from('water_intake_logs').select('amount_ml,occurred_at').eq('user_id', userId).gte('occurred_at', isoStart).lt('occurred_at', isoEnd),
      supabase.from('meals').select('date,calories,protein').eq('user_id', userId).gte('date', rangeStart).lt('date', rangeEnd),
      supabase.from('body_progress_entries').select('recorded_at,weight_kg').eq('user_id', userId).lt('recorded_at', end.toISOString()).order('recorded_at', { ascending: true }),
      supabase.from('personal_goals').select('status,updated_at').eq('user_id', userId).eq('status', 'completed').gte('updated_at', isoStart).lt('updated_at', isoEnd),
      supabase.from('workout_session_sets').select('weight,is_personal_record,completed_at,workout_session_exercises(name)').eq('user_id', userId).eq('completed', true).gte('completed_at', isoStart).lt('completed_at', isoEnd).order('weight', { ascending: false }).limit(20),
      supabase.from('profiles').select('current_weight').eq('id', userId).maybeSingle(),
    ])

    const failure = [sessionsResult, workoutsResult, stepsResult, healthResult, waterResult, mealsResult, bodyResult, goalsResult, setsResult, profileResult].find((result) => result.error)
    if (failure?.error) throw new Error('Não foi possível carregar os dados deste relatório.')

    const allSessions = sessionsResult.data ?? []
    const allSteps = stepsResult.data ?? []
    const allHealth = healthResult.data ?? []
    const allWater = waterResult.data ?? []
    const allMeals = mealsResult.data ?? []

    const daily = Array.from({ length: 7 }, (_, index) => {
      const date = toLocalDate(addDays(start, index))
      const manualSteps = allSteps.filter((row) => row.occurred_on === date)
      const health = allHealth.filter((row) => toLocalDate(new Date(row.started_at)) === date)
      const daySessions = allSessions.filter((row) => toLocalDate(new Date(row.started_at)) === date && row.status === 'completed')
      return {
        date,
        day: new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(fromLocalDate(date)).replace('.', '').slice(0, 3),
        steps: Math.round(manualSteps.reduce((sum, row) => sum + Number(row.steps ?? 0), 0) + health.filter((row) => row.data_type === 'steps').reduce((sum, row) => sum + Number(row.value ?? 0), 0)),
        duration: Math.round(daySessions.reduce((sum, row) => sum + Number(row.duration_seconds ?? 0), 0) / 60),
        water: allWater.filter((row) => toLocalDate(new Date(row.occurred_at)) === date).reduce((sum, row) => sum + Number(row.amount_ml ?? 0), 0) / 1000,
      }
    })

    const inWeek = (value: string, dateOnly = false) => {
      const date = dateOnly ? fromLocalDate(value) : new Date(value)
      return date >= start && date < end
    }
    const sessions = allSessions.filter((row) => inWeek(row.started_at) && row.status === 'completed')
    const stepRows = allSteps.filter((row) => inWeek(row.occurred_on, true))
    const healthRows = allHealth.filter((row) => inWeek(row.started_at))
    const waterRows = allWater.filter((row) => inWeek(row.occurred_at))
    const meals = allMeals.filter((row) => inWeek(row.date, true))
    const weights = (bodyResult.data ?? []).map((row) => ({ date: new Date(row.recorded_at), value: Number(row.weight_kg) }))
    const startCandidates = weights.filter((item) => item.date <= start)
    const endCandidates = weights.filter((item) => item.date < end)
    const beforeStart = startCandidates[startCandidates.length - 1] ?? weights.find((item) => item.date >= start)
    const profileWeight = profileResult.data?.current_weight === null || profileResult.data?.current_weight === undefined ? null : Number(profileResult.data.current_weight)
    const beforeEnd = endCandidates[endCandidates.length - 1]
    const isCurrentWeek = weekStart === currentWeekStart()
    const weekdayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    const activeDayNames = Array.from({ length: 7 }, (_, index) => weekdayNames[addDays(start, index).getDay()])
    const planned = (workoutsResult.data ?? []).reduce((sum, workout) => sum + (workout.scheduled_days ?? []).filter((day: string) => activeDayNames.includes(day)).length, 0)
    const largest = sessions.reduce<(typeof sessions)[number] | null>((best, row) => !best || Number(row.duration_seconds) > Number(best.duration_seconds) ? row : best, null)
    const recordSet = (setsResult.data ?? []).find((row) => row.is_personal_record) ?? setsResult.data?.[0]
    const recordExercise = Array.isArray(recordSet?.workout_session_exercises) ? recordSet?.workout_session_exercises[0] : recordSet?.workout_session_exercises
    const distance = stepRows.reduce((sum, row) => sum + Number(row.distance_km ?? 0), 0) + healthRows.filter((row) => row.data_type === 'distance').reduce((sum, row) => sum + (row.unit === 'm' ? Number(row.value) / 1000 : Number(row.value)), 0)
    const calories = meals.reduce((sum, row) => sum + Number(row.calories ?? 0), 0)
    const protein = meals.reduce((sum, row) => sum + Number(row.protein ?? 0), 0)
    const totalSteps = daily.slice(0, days).reduce((sum, day) => sum + day.steps, 0)
    const waterLiters = waterRows.reduce((sum, row) => sum + Number(row.amount_ml ?? 0), 0) / 1000

    return {
      start: toLocalDate(start), end: toLocalDate(addDays(end, -1)), days,
      planned: Math.max(planned, sessions.length), completed: sessions.length,
      duration: Math.round(sessions.reduce((sum, row) => sum + Number(row.duration_seconds ?? 0), 0) / 60),
      volume: sessions.reduce((sum, row) => sum + Number(row.volume_total ?? 0), 0),
      steps: Math.round(totalSteps / days), distance, water: waterLiters / days, calories: calories / days, protein: protein / days,
      weightStart: beforeStart?.value ?? null, weightEnd: beforeEnd?.value ?? (isCurrentWeek ? profileWeight : null), goals: goalsResult.data?.length ?? 0,
      daily,
      largestWorkout: largest ? { name: largest.workout_name, minutes: Math.round(Number(largest.duration_seconds ?? 0) / 60) } : null,
      loadRecord: recordSet ? { name: String(recordExercise?.name ?? 'Exercício'), weight: Number(recordSet.weight ?? 0) } : null,
      hasData: Boolean(sessions.length || stepRows.length || healthRows.length || waterRows.length || meals.length || beforeEnd || goalsResult.data?.length),
    }
  },
}

function fromLocalDate(value: string) { return new Date(`${value}T00:00:00`) }
function startOfLocalDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()) }
function addDays(date: Date, days: number) { const result = new Date(date); result.setDate(result.getDate() + days); return result }
function daysBetween(start: Date, end: Date) { return Math.ceil((end.getTime() - start.getTime()) / 86400000) }
export function toLocalDate(date: Date) { const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 10) }
export function currentWeekStart() { const date = startOfLocalDay(new Date()); const day = date.getDay() || 7; date.setDate(date.getDate() - day + 1); return toLocalDate(date) }
export function reportWeekOptions(count = 12) { const start = fromLocalDate(currentWeekStart()); return Array.from({ length: count }, (_, index) => toLocalDate(addDays(start, -index * 7))) }
