import type { ChartPoint, DailyStats, Meal, Workout } from '../types'

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
  async getDailyStats() { return structuredClone(dailyStats) },
  async getWorkouts() { return structuredClone(workouts) },
  async getMeals() { return structuredClone(meals) },
  async getWeightHistory(): Promise<ChartPoint[]> {
    return [
      { label: 'Mar', value: 84.2 }, { label: 'Abr', value: 83.1 },
      { label: 'Mai', value: 82.5 }, { label: 'Jun', value: 81.4 },
      { label: 'Jul', value: 80.6 }, { label: 'Ago', value: 79.8 },
    ]
  },
  async addWater(amount: number) {
    dailyStats.water.current = Math.min(dailyStats.water.current + amount, dailyStats.water.goal)
    return structuredClone(dailyStats.water)
  },
  async toggleWorkout(id: string) {
    const workout = workouts.find((item) => item.id === id)
    if (workout) workout.completed = !workout.completed
    return workout ? structuredClone(workout) : null
  },
}
