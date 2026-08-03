import type { ChartPoint, DailyStats, Meal, Workout } from '../types'
import { supabase } from '../integrations/supabase'

// Contrato assíncrono pronto para ser substituído por queries do Supabase.
const dailyStats: DailyStats = {
  calories: { current: 1240, goal: 2200 },
  water: { current: 1.8, goal: 3 },
  steps: { current: 6842, goal: 10000 },
  workout: { minutes: 48, calories: 386 },
}

const workouts: Workout[] = [
  { id: 'w1', title: 'Peito & Tríceps', focus: 'Força e hipertrofia', duration: 52, exercises: 7 },
  { id: 'w2', title: 'Costas & Bíceps', focus: 'Volume moderado', duration: 45, exercises: 6 },
  { id: 'w3', title: 'Pernas completo', focus: 'Alta intensidade', duration: 58, exercises: 8 },
]

const meals: Meal[] = [
  { id: 'm1', name: 'Café da manhã', description: 'Ovos, pão integral e mamão', calories: 420, time: '07:30' },
  { id: 'm2', name: 'Almoço', description: 'Frango, arroz, feijão e salada', calories: 610, time: '12:40' },
  { id: 'm3', name: 'Lanche', description: 'Iogurte, whey e banana', calories: 210, time: '16:15' },
]

export const fitnessService = {
  async getDailyStats() {
    if (!supabase) return structuredClone(dailyStats)
    const { data } = await supabase.from('daily_stats').select('*').eq('date', today()).maybeSingle()
    if (!data) return structuredClone(dailyStats)
    return {
      calories: { current: data.calories_current, goal: data.calories_goal },
      water: { current: Number(data.water_current), goal: Number(data.water_goal) },
      steps: { current: data.steps_current, goal: data.steps_goal },
      workout: { minutes: data.workout_minutes, calories: data.workout_calories },
    }
  },
  async getWorkouts() {
    if (!supabase) return structuredClone(workouts)
    const { data } = await supabase.from('workouts').select('*').order('position')
    if (!data?.length) return structuredClone(workouts)
    return data.map((item): Workout => ({
      id: item.id, title: item.title, focus: item.focus,
      duration: item.duration, exercises: item.exercise_count, completed: item.completed,
    }))
  },
  async getMeals() {
    if (!supabase) return structuredClone(meals)
    const { data } = await supabase.from('meals').select('*').eq('date', today()).order('time')
    if (!data?.length) return structuredClone(meals)
    return data.map((item): Meal => ({
      id: item.id, name: item.name, description: item.description,
      calories: item.calories, time: item.time.slice(0, 5),
    }))
  },
  async getWeightHistory(): Promise<ChartPoint[]> {
    const fallback = [
      { label: 'Mar', value: 84.2 }, { label: 'Abr', value: 83.1 },
      { label: 'Mai', value: 82.5 }, { label: 'Jun', value: 81.4 },
      { label: 'Jul', value: 80.6 }, { label: 'Ago', value: 79.8 },
    ]
    if (!supabase) return fallback
    const { data } = await supabase.from('body_measurements').select('measured_at,weight').order('measured_at').limit(6)
    if (!data?.length) return fallback
    return data.map((item) => ({
      label: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(`${item.measured_at}T12:00:00`)).replace('.', ''),
      value: Number(item.weight),
    }))
  },
  async addWater(amount: number) {
    if (supabase) {
      const { data: current } = await supabase.from('daily_stats')
        .select('water_current,water_goal').eq('date', today()).maybeSingle()
      if (current) {
        const next = Math.min(Number(current.water_current) + amount, Number(current.water_goal))
        const { error } = await supabase.from('daily_stats').update({ water_current: next })
          .eq('date', today())
        if (!error) return { current: next, goal: Number(current.water_goal) }
      }
    }
    dailyStats.water.current = Math.min(dailyStats.water.current + amount, dailyStats.water.goal)
    return structuredClone(dailyStats.water)
  },
  async toggleWorkout(id: string) {
    const workout = workouts.find((item) => item.id === id)
    if (workout) workout.completed = !workout.completed
    if (supabase) {
      const { data: current } = await supabase.from('workouts').select('*').eq('id', id).maybeSingle()
      if (current) {
        const completed = !current.completed
        const { error } = await supabase.from('workouts').update({ completed }).eq('id', id)
        if (!error) return {
          id: current.id, title: current.title, focus: current.focus,
          duration: current.duration, exercises: current.exercise_count, completed,
        } satisfies Workout
      }
    }
    return workout ? structuredClone(workout) : null
  },
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
