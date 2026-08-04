import { useCallback, useEffect, useState } from 'react'
import { trainingPlanService } from '../services/trainingPlanService'
import type { GeneratedPlan, TrainingHubData, WorkoutDraft, WorkoutSummary } from '../types/trainingPlan'

export function useTrainingHub(userId: string) {
  const [data, setData] = useState<TrainingHubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await trainingPlanService.getHub(userId))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar seus treinos.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const saveWorkout = useCallback(async (draft: WorkoutDraft) => {
    await trainingPlanService.saveWorkout(userId, draft)
    await load()
  }, [load, userId])

  const duplicateWorkout = useCallback(async (workout: WorkoutSummary) => {
    await trainingPlanService.duplicateWorkout(userId, workout)
    await load()
  }, [load, userId])

  const deleteWorkout = useCallback(async (id: string) => {
    await trainingPlanService.deleteWorkout(userId, id)
    await load()
  }, [load, userId])

  const setActive = useCallback(async (id: string, active: boolean) => {
    await trainingPlanService.setWorkoutActive(userId, id, active)
    await load()
  }, [load, userId])

  const saveGenerated = useCallback(async (plan: GeneratedPlan) => {
    await trainingPlanService.saveGeneratedPlan(userId, plan)
    await load()
  }, [load, userId])

  return { data, loading, error, retry: load, saveWorkout, duplicateWorkout, deleteWorkout, setActive, saveGenerated }
}
