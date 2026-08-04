import { useCallback, useEffect, useMemo, useState } from 'react'
import { exerciseLibraryService } from '../services/exerciseLibraryService'
import type { ExerciseFilters, ExerciseLibraryData, ExerciseLibraryItem } from '../types/exerciseLibrary'

const initialFilters: ExerciseFilters = {
  search: '',
  muscle: '',
  equipment: '',
  level: '',
  location: '',
  favoritesOnly: false,
}

export function useExerciseLibrary(userId: string) {
  const [data, setData] = useState<ExerciseLibraryData | null>(null)
  const [filters, setFilters] = useState<ExerciseFilters>(initialFilters)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await exerciseLibraryService.getLibrary(userId))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar a biblioteca.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const favoriteSet = useMemo(() => new Set(data?.favoriteIds ?? []), [data?.favoriteIds])
  const filteredExercises = useMemo(() => {
    if (!data) return []
    const search = normalize(filters.search)
    return data.exercises.filter((exercise) => {
      const searchable = normalize([
        exercise.name,
        exercise.primaryMuscle,
        exercise.secondaryMuscles.join(' '),
        exercise.equipment,
      ].join(' '))
      return (!search || searchable.includes(search))
        && (!filters.muscle || exercise.primaryMuscle === filters.muscle)
        && (!filters.equipment || exercise.equipment === filters.equipment)
        && (!filters.level || exercise.level === filters.level)
        && (!filters.location || exercise.locations.includes(filters.location))
        && (!filters.favoritesOnly || favoriteSet.has(exercise.id))
    })
  }, [data, filters, favoriteSet])

  const recentExercises = useMemo(() => {
    if (!data) return []
    return data.recentIds
      .map((id) => data.exercises.find((exercise) => exercise.id === id))
      .filter((exercise): exercise is ExerciseLibraryItem => Boolean(exercise))
  }, [data])

  const options = useMemo(() => ({
    muscles: Array.from(new Set(data?.exercises.map((exercise) => exercise.primaryMuscle) ?? [])).sort(),
    equipment: Array.from(new Set(data?.exercises.map((exercise) => exercise.equipment) ?? [])).sort(),
  }), [data?.exercises])

  const toggleFavorite = useCallback(async (exerciseId: string) => {
    const isFavorite = favoriteSet.has(exerciseId)
    await exerciseLibraryService.setFavorite(userId, exerciseId, !isFavorite)
    setData((current) => current ? {
      ...current,
      favoriteIds: isFavorite
        ? current.favoriteIds.filter((id) => id !== exerciseId)
        : [...current.favoriteIds, exerciseId],
    } : current)
  }, [favoriteSet, userId])

  const addToWorkout = useCallback(async (workoutId: string, exercise: ExerciseLibraryItem) => {
    await exerciseLibraryService.addToWorkout(userId, workoutId, exercise)
    setData(await exerciseLibraryService.getLibrary(userId))
  }, [userId])

  const clearFilters = useCallback(() => setFilters(initialFilters), [])

  return {
    data,
    filters,
    setFilters,
    filteredExercises,
    recentExercises,
    favoriteSet,
    options,
    loading,
    error,
    retry: load,
    toggleFavorite,
    addToWorkout,
    clearFilters,
  }
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}
