import { useCallback, useEffect, useState } from 'react'
import { fitnessService } from '../services/fitnessService'
import type { ChartPoint, DailyStats, Meal, Workout } from '../types'

export function useFitnessData() {
  const [stats, setStats] = useState<DailyStats | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [weight, setWeight] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fitnessService.getDailyStats(), fitnessService.getWorkouts(),
      fitnessService.getMeals(), fitnessService.getWeightHistory(),
    ]).then(([nextStats, nextWorkouts, nextMeals, nextWeight]) => {
      setStats(nextStats); setWorkouts(nextWorkouts); setMeals(nextMeals); setWeight(nextWeight)
    }).catch(() => setError('Não foi possível carregar seus dados.'))
      .finally(() => setLoading(false))
  }, [])

  const addWater = useCallback(async () => {
    const water = await fitnessService.addWater(.25)
    setStats((current) => current ? { ...current, water } : current)
  }, [])

  const toggleWorkout = useCallback(async (id: string) => {
    const updated = await fitnessService.toggleWorkout(id)
    if (updated) setWorkouts((items) => items.map((item) => item.id === id ? updated : item))
  }, [])

  return { stats, workouts, meals, weight, loading, error, addWater, toggleWorkout }
}
