import { supabase } from '../integrations/supabase'
import type { WeeklyReport } from './weeklyReportService'

export interface FitnessPdfOptions { includeBodyMetrics: boolean; includeObservations: boolean }
export interface FitnessPdfData {
  userName: string
  period: { start: string; end: string }
  summary: WeeklyReport
  workouts: Array<{ date: string; name: string; status: string; minutes: number; volume: number; notes: string }>
  meals: Array<{ date: string; time: string; name: string; calories: number; protein: number; carbs: number; fat: number }>
  steps: Array<{ date: string; steps: number; distance: number }>
  water: Array<{ date: string; time: string; amountMl: number }>
  measurements: Array<{ date: string; weight: number; bodyFat: number | null; waist: number | null; abdomen: number | null; chest: number | null; arm: number | null; hips: number | null; thigh: number | null; calf: number | null; notes: string }>
  goals: Array<{ name: string; progress: number; target: number; unit: string; status: string }>
  observations: string[]
}

export const fitnessPdfService = {
  async getData(userId: string, summary: WeeklyReport, options: FitnessPdfOptions): Promise<FitnessPdfData> {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
    const startIso = new Date(`${summary.start}T00:00:00`).toISOString()
    const afterEnd = new Date(`${summary.end}T00:00:00`); afterEnd.setDate(afterEnd.getDate() + 1)
    const endIso = afterEnd.toISOString()
    const workoutFields = options.includeObservations ? 'started_at,workout_name,status,duration_seconds,volume_total,notes' : 'started_at,workout_name,status,duration_seconds,volume_total'

    const [profileResult, workoutsResult, mealsResult, stepsResult, healthResult, waterResult, goalsResult, measurementsResult] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
      supabase.from('workout_sessions').select(workoutFields).eq('user_id', userId).gte('started_at', startIso).lt('started_at', endIso).order('started_at'),
      supabase.from('meals').select('date,time,name,calories,protein,carbs,fat').eq('user_id', userId).gte('date', summary.start).lte('date', summary.end).order('date').order('time'),
      supabase.from('step_records').select('occurred_on,steps,distance_km').eq('user_id', userId).gte('occurred_on', summary.start).lte('occurred_on', summary.end).order('occurred_on'),
      supabase.from('health_sync_records').select('data_type,started_at,value,unit').eq('user_id', userId).in('data_type', ['steps', 'distance']).gte('started_at', startIso).lt('started_at', endIso).order('started_at'),
      supabase.from('water_intake_logs').select('occurred_at,amount_ml').eq('user_id', userId).gte('occurred_at', startIso).lt('occurred_at', endIso).order('occurred_at'),
      supabase.from('personal_goals').select('name,progress_value,target_value,unit,status').eq('user_id', userId).lte('start_date', summary.end).gte('end_date', summary.start).order('created_at'),
      options.includeBodyMetrics
        ? supabase.from('body_progress_entries').select('recorded_at,weight_kg,body_fat_percent,waist_cm,abdomen_cm,chest_cm,right_arm_cm,hips_cm,right_thigh_cm,calf_cm,notes').eq('user_id', userId).gte('recorded_at', startIso).lt('recorded_at', endIso).order('recorded_at')
        : Promise.resolve({ data: [], error: null }),
    ])
    const failure = [profileResult, workoutsResult, mealsResult, stepsResult, healthResult, waterResult, goalsResult, measurementsResult].find((result) => result.error)
    if (failure?.error) throw new Error('Não foi possível reunir os registros para o PDF.')

    const workoutRows = (workoutsResult.data ?? []) as unknown as Array<Record<string, unknown>>
    const workouts = workoutRows.map((row) => ({
      date: String(row.started_at), name: String(row.workout_name), status: statusLabel(String(row.status)),
      minutes: Math.round(Number(row.duration_seconds ?? 0) / 60), volume: Number(row.volume_total ?? 0),
      notes: options.includeObservations ? String(row.notes ?? '') : '',
    }))
    const measurements = (measurementsResult.data ?? []).map((row: Record<string, unknown>) => ({
      date: String(row.recorded_at), weight: Number(row.weight_kg), bodyFat: nullable(row.body_fat_percent), waist: nullable(row.waist_cm),
      abdomen: nullable(row.abdomen_cm), chest: nullable(row.chest_cm), arm: nullable(row.right_arm_cm), hips: nullable(row.hips_cm),
      thigh: nullable(row.right_thigh_cm), calf: nullable(row.calf_cm), notes: options.includeObservations ? String(row.notes ?? '') : '',
    }))
    const observations = options.includeObservations
      ? [...workouts.map((row) => row.notes), ...measurements.map((row) => row.notes)].filter((note) => note.trim())
      : []

    const stepDays = new Map<string, { date: string; steps: number; distance: number }>()
    for (const row of stepsResult.data ?? []) { const day = stepDays.get(row.occurred_on) ?? { date: row.occurred_on, steps: 0, distance: 0 }; day.steps += Number(row.steps); day.distance += Number(row.distance_km); stepDays.set(row.occurred_on, day) }
    for (const row of healthResult.data ?? []) { const date = localDate(new Date(row.started_at)); const day = stepDays.get(date) ?? { date, steps: 0, distance: 0 }; if (row.data_type === 'steps') day.steps += Number(row.value); if (row.data_type === 'distance') day.distance += row.unit === 'm' ? Number(row.value) / 1000 : Number(row.value); stepDays.set(date, day) }

    return {
      userName: String(profileResult.data?.full_name || 'Usuário MOVELYA'), period: { start: summary.start, end: summary.end }, summary, workouts,
      meals: (mealsResult.data ?? []).map((row) => ({ date: row.date, time: String(row.time).slice(0, 5), name: row.name, calories: Number(row.calories), protein: Number(row.protein), carbs: Number(row.carbs), fat: Number(row.fat) })),
      steps: [...stepDays.values()].sort((a, b) => a.date.localeCompare(b.date)),
      water: (waterResult.data ?? []).map((row) => ({ date: row.occurred_at, time: new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(row.occurred_at)), amountMl: Number(row.amount_ml) })),
      measurements,
      goals: (goalsResult.data ?? []).map((row) => ({ name: row.name, progress: Number(row.progress_value), target: Number(row.target_value), unit: row.unit, status: statusLabel(row.status) })),
      observations,
    }
  },
}

function nullable(value: unknown) { return value === null || value === undefined ? null : Number(value) }
function statusLabel(value: string) { return ({ completed: 'Concluído', active: 'Em andamento', paused: 'Pausado', abandoned: 'Interrompido', overdue: 'Prazo encerrado', archived: 'Arquivado' } as Record<string, string>)[value] ?? value }
function localDate(date: Date) { const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 10) }
