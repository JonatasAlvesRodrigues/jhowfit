import { supabase } from '../integrations/supabase'
import type { DailyDashboardData, DashboardMetric, DashboardWorkout, WeightPoint } from '../types/dashboard'

interface DailyStatsRow {
  calories_current: number
  calories_goal: number
  protein_current: number
  protein_goal: number
  water_current: number
  water_goal: number
  steps_current: number
  steps_goal: number
  workout_minutes: number
}

const emptyMetric = (goal: number): DashboardMetric => ({ current: 0, goal })

export const dashboardService = {
  async getDailyDashboard(userId: string): Promise<DailyDashboardData> {
    if (!supabase) throw new Error('A conexÃ£o com o Supabase nÃ£o estÃ¡ configurada.')

    const date = localDate()
    const [profileResult, statsResult, mealsResult, workoutResult, weightResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name,avatar_url,current_weight')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('daily_stats')
        .select('calories_current,calories_goal,protein_current,protein_goal,water_current,water_goal,steps_current,steps_goal,workout_minutes')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle(),
      supabase
        .from('meals')
        .select('calories,protein')
        .eq('user_id', userId)
        .eq('date', date),
      supabase
        .from('workouts')
        .select('id,title,focus,duration,exercise_count,completed,level,muscle_groups')
        .eq('user_id', userId)
        .eq('scheduled_date', date)
        .order('position')
        .limit(1)
        .maybeSingle(),
      supabase
        .from('body_measurements')
        .select('measured_at,weight')
        .eq('user_id', userId)
        .order('measured_at', { ascending: false })
        .limit(7),
    ])

    const firstError = [profileResult.error, statsResult.error, mealsResult.error, workoutResult.error, weightResult.error]
      .find(Boolean)
    if (firstError) throw new Error('NÃ£o foi possÃ­vel carregar o resumo do dia.')

    const stats = statsResult.data as DailyStatsRow | null
    const mealCalories = mealsResult.data?.reduce((total, meal) => total + Number(meal.calories ?? 0), 0) ?? 0
    const mealProtein = mealsResult.data?.reduce((total, meal) => total + Number(meal.protein ?? 0), 0) ?? 0
    const metrics = {
      steps: stats ? metric(stats.steps_current, stats.steps_goal) : emptyMetric(10000),
      calories: stats ? metric(mealCalories || stats.calories_current, stats.calories_goal) : emptyMetric(2200),
      protein: stats ? metric(mealProtein || stats.protein_current, stats.protein_goal) : emptyMetric(120),
      water: stats ? metric(stats.water_current, stats.water_goal) : emptyMetric(3),
      activeMinutes: Number(stats?.workout_minutes ?? 0),
    }
    const workout = workoutResult.data ? mapWorkout(workoutResult.data) : null
    const history = (weightResult.data ?? [])
      .map((item): WeightPoint => ({ date: item.measured_at, value: Number(item.weight) }))
      .reverse()
    const profileWeight = profileResult.data?.current_weight ? Number(profileResult.data.current_weight) : null
    const currentWeight = history[history.length - 1]?.value ?? profileWeight
    const previousWeight = history[history.length - 2]?.value ?? null
    const difference = currentWeight !== null && previousWeight !== null
      ? round(currentWeight - previousWeight, 1)
      : null
    const completion = calculateCompletion(metrics, workout)
    const allGoalsCompleted = [
      ratio(metrics.steps),
      ratio(metrics.calories),
      ratio(metrics.protein),
      ratio(metrics.water),
    ].every((value) => value >= 1) && (!workout || workout.completed)
    const hasAnyData = Boolean(stats || mealsResult.data?.length || workout || history.length)

    return {
      profile: {
        name: profileResult.data?.full_name?.trim() || 'UsuÃ¡rio MOVELYA',
        avatarUrl: profileResult.data?.avatar_url || null,
      },
      metrics,
      workout,
      weight: { current: currentWeight, difference, history },
      completion,
      insight: getInsight(metrics, workout, allGoalsCompleted),
      hasAnyData,
      allGoalsCompleted,
    }
  },

}

function mapWorkout(row: Record<string, unknown>): DashboardWorkout {
  return {
    id: String(row.id),
    title: String(row.title),
    muscleGroups: Array.isArray(row.muscle_groups) ? row.muscle_groups.map(String) : [],
    focus: String(row.focus || ''),
    duration: Number(row.duration || 0),
    level: String(row.level || 'Iniciante'),
    exerciseCount: Number(row.exercise_count || 0),
    completed: Boolean(row.completed),
  }
}

function metric(current: number, goal: number): DashboardMetric {
  return { current: Number(current || 0), goal: Number(goal || 1) }
}

function ratio(metricValue: DashboardMetric) {
  return metricValue.goal > 0 ? metricValue.current / metricValue.goal : 0
}

function calculateCompletion(
  metrics: DailyDashboardData['metrics'],
  workout: DashboardWorkout | null,
) {
  const values = [
    ratio(metrics.steps),
    ratio(metrics.calories),
    ratio(metrics.protein),
    ratio(metrics.water),
    Math.min(metrics.activeMinutes / 30, 1),
  ]
  if (workout) values.push(workout.completed ? 1 : 0)
  return Math.round(values.reduce((sum, value) => sum + Math.min(value, 1), 0) / values.length * 100)
}

function getInsight(
  metrics: DailyDashboardData['metrics'],
  workout: DashboardWorkout | null,
  allGoalsCompleted: boolean,
) {
  if (allGoalsCompleted) return 'Metas concluÃ­das. Excelente consistÃªncia hoje â€” aproveite para recuperar bem.'
  const proteinMissing = Math.max(metrics.protein.goal - metrics.protein.current, 0)
  if (proteinMissing > 0 && ratio(metrics.protein) >= .7) {
    return `Faltam apenas ${Math.ceil(proteinMissing)} g de proteÃ­na para sua meta diÃ¡ria.`
  }
  if (ratio(metrics.water) < .55) return 'Sua hidrataÃ§Ã£o estÃ¡ abaixo do esperado. Que tal beber mais 250 ml agora?'
  if (ratio(metrics.steps) >= .75 && ratio(metrics.steps) < 1) {
    return `VocÃª estÃ¡ perto da meta: faltam ${Math.ceil(metrics.steps.goal - metrics.steps.current).toLocaleString('pt-BR')} passos.`
  }
  if (workout && !workout.completed) return 'Seu treino ainda estÃ¡ pendente. Um comeÃ§o curto jÃ¡ mantÃ©m a rotina em movimento.'
  return 'Pequenas escolhas consistentes fazem diferenÃ§a. Registre sua prÃ³xima atividade.'
}

function localDate() {
  const date = new Date()
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function round(value: number, digits: number) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

