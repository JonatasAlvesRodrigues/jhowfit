import { supabase } from '../integrations/supabase'
import type { ExerciseLibraryData, ExerciseLibraryItem, ExerciseLevel, ExerciseLocation, WorkoutOption } from '../types/exerciseLibrary'
import { createExerciseProvider, normalizeProviderExercise } from './exerciseProvider'

export const exerciseLibraryService = {
  async getLibrary(userId: string): Promise<ExerciseLibraryData> {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')

    const [libraryResult, favoritesResult, recentResult, workoutsResult] = await Promise.all([
      supabase.from('exercise_library').select('*').order('primary_muscle').order('name'),
      supabase.from('exercise_favorites').select('exercise_id').eq('user_id', userId),
      supabase
        .from('exercises')
        .select('library_exercise_id,created_at')
        .eq('user_id', userId)
        .not('library_exercise_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(12),
      supabase
        .from('workouts')
        .select('id,title,exercise_count')
        .eq('user_id', userId)
        .order('position'),
    ])

    const firstError = [libraryResult.error, favoritesResult.error, recentResult.error, workoutsResult.error].find(Boolean)
    if (firstError) throw new Error('Não foi possível carregar a biblioteca de exercícios.')

    const recentIds = Array.from(new Set(
      (recentResult.data ?? []).map((item) => String(item.library_exercise_id)).filter(Boolean),
    )).slice(0, 6)

    return {
      exercises: (libraryResult.data ?? []).map(mapExercise),
      favoriteIds: (favoritesResult.data ?? []).map((item) => String(item.exercise_id)),
      recentIds,
      workouts: (workoutsResult.data ?? []).map((item): WorkoutOption => ({
        id: item.id,
        title: item.title,
        exerciseCount: Number(item.exercise_count ?? 0),
      })),
    }
  },

  async setFavorite(userId: string, exerciseId: string, favorite: boolean) {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
    if (favorite) {
      const { error } = await supabase.from('exercise_favorites').upsert({
        user_id: userId,
        exercise_id: exerciseId,
      }, { onConflict: 'user_id,exercise_id' })
      if (error) throw new Error('Não foi possível favoritar este exercício.')
      return
    }
    const { error } = await supabase
      .from('exercise_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('exercise_id', exerciseId)
    if (error) throw new Error('Não foi possível remover o exercício dos favoritos.')
  },

  async addToWorkout(userId: string, workoutId: string, exercise: ExerciseLibraryItem) {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
    const { data: last, error: positionError } = await supabase
      .from('exercises')
      .select('position')
      .eq('user_id', userId)
      .eq('workout_id', workoutId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (positionError) throw new Error('Não foi possível preparar o treino.')

    const { error } = await supabase.from('exercises').insert({
      workout_id: workoutId,
      user_id: userId,
      library_exercise_id: exercise.id,
      name: exercise.name,
      position: Number(last?.position ?? -1) + 1,
    })
    if (error) throw new Error('Não foi possível adicionar o exercício ao treino.')

    const { error: countError } = await supabase
      .from('workouts')
      .update({ exercise_count: await getExerciseCount(workoutId, userId) })
      .eq('id', workoutId)
      .eq('user_id', userId)
    if (countError) console.warn('Exercício adicionado, mas a contagem do treino não foi atualizada.')
  },
}

async function getExerciseCount(workoutId: string, userId: string) {
  if (!supabase) return 0
  const { count } = await supabase
    .from('exercises')
    .select('id', { count: 'exact', head: true })
    .eq('workout_id', workoutId)
    .eq('user_id', userId)
  return count ?? 0
}

// Optional adapter used by an admin/synchronization flow. User-facing screens
// continue to consume the local Supabase library only.
export async function searchExerciseProvider(query: string) {
  const provider = createExerciseProvider()
  if (!provider || !query.trim()) return []
  return provider.search(query.trim())
}

export function normalizeExerciseProviderRow(row: Record<string, unknown>) {
  return normalizeProviderExercise(row)
}

function mapExercise(row: Record<string, unknown>): ExerciseLibraryItem {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    primaryMuscle: String(row.primary_muscle),
    secondaryMuscles: arrayOfStrings(row.secondary_muscles),
    equipment: String(row.equipment),
    level: String(row.level) as ExerciseLevel,
    instructions: arrayOfStrings(row.instructions),
    commonMistakes: arrayOfStrings(row.common_mistakes),
    safetyTips: arrayOfStrings(row.safety_tips),
    substitutions: arrayOfStrings(row.substitutions),
    locations: arrayOfStrings(row.locations) as ExerciseLocation[],
    imageUrl: row.image_url ? String(row.image_url) : null,
    gifUrl: row.gif_url ? String(row.gif_url) : null,
    videoUrl: row.video_url ? String(row.video_url) : null,
    thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
    source: row.source ? String(row.source) : null,
    sourceUrl: row.source_url ? String(row.source_url) : null,
    externalId: row.external_id ? String(row.external_id) : null,
  }
}

function arrayOfStrings(value: unknown) {
  return Array.isArray(value) ? value.map(String) : []
}
