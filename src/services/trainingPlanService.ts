import { supabase } from '../integrations/supabase'
import type { ExerciseLibraryItem, ExerciseLevel, ExerciseLocation } from '../types/exerciseLibrary'
import type {
  AIProfileSummary,
  GeneratedPlan,
  TrainingExercise,
  TrainingHubData,
  WeekDay,
  WorkoutDraft,
  WorkoutSummary,
  WorkoutTemplate,
} from '../types/trainingPlan'

export const trainingPlanService = {
  async getHub(userId: string): Promise<TrainingHubData> {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
    const [workoutsResult, exercisesResult, templatesResult, libraryResult, profileResult] = await Promise.all([
      supabase
        .from('workouts')
        .select('id,plan_id,title,focus,duration,scheduled_days,notes,is_active,source,updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('exercises')
        .select('id,workout_id,library_exercise_id,name,position,sets_count,repetitions_text,initial_weight,rest_seconds,notes,is_optional,advanced_technique,substitutions')
        .eq('user_id', userId)
        .order('position'),
      supabase.from('workout_templates').select('*').order('name'),
      supabase.from('exercise_library').select('*').order('name'),
      supabase
        .from('profiles')
        .select('birth_date,height_cm,current_weight,goal,experience_level,available_days,training_days_per_week,average_duration_minutes,training_locations,equipment,has_injuries,injuries_details,has_physical_limitations,physical_limitations_details,has_pain,pain_details')
        .eq('id', userId)
        .maybeSingle(),
    ])
    const firstError = [workoutsResult.error, exercisesResult.error, templatesResult.error, libraryResult.error, profileResult.error].find(Boolean)
    if (firstError) throw new Error('Não foi possível carregar suas fichas de treino.')

    const exercisesByWorkout = new Map<string, TrainingExercise[]>()
    for (const row of exercisesResult.data ?? []) {
      const workoutId = String(row.workout_id)
      const items = exercisesByWorkout.get(workoutId) ?? []
      items.push(mapTrainingExercise(row))
      exercisesByWorkout.set(workoutId, items)
    }

    return {
      workouts: (workoutsResult.data ?? []).map((row): WorkoutSummary => ({
        id: row.id,
        planId: row.plan_id ?? undefined,
        name: row.title,
        days: array(row.scheduled_days) as WeekDay[],
        notes: row.notes ?? '',
        active: Boolean(row.is_active),
        source: row.source ?? 'manual',
        durationMinutes: Number(row.duration ?? 0),
        focus: row.focus ?? '',
        exercises: exercisesByWorkout.get(row.id) ?? [],
        updatedAt: row.updated_at,
      })),
      templates: (templatesResult.data ?? []).map(mapTemplate),
      library: (libraryResult.data ?? []).map(mapLibraryExercise),
      profile: mapProfile(profileResult.data),
    }
  },

  async saveWorkout(userId: string, draft: WorkoutDraft) {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
    const workoutPayload = {
      user_id: userId,
      title: draft.name.trim(),
      focus: draft.focus.trim(),
      duration: draft.durationMinutes,
      exercise_count: draft.exercises.length,
      scheduled_days: draft.days,
      scheduled_date: draft.days.includes(todayWeekDay()) ? localDate() : null,
      notes: draft.notes.trim() || null,
      is_active: draft.active,
      source: draft.source,
      plan_id: draft.planId ?? null,
      updated_at: new Date().toISOString(),
    }
    let workoutId = draft.id
    if (workoutId) {
      const { error } = await supabase.from('workouts').update(workoutPayload).eq('id', workoutId).eq('user_id', userId)
      if (error) throw new Error('Não foi possível atualizar o treino.')
      const { error: deleteError } = await supabase.from('exercises').delete().eq('workout_id', workoutId).eq('user_id', userId)
      if (deleteError) throw new Error('Não foi possível atualizar os exercícios.')
    } else {
      const { data, error } = await supabase.from('workouts').insert(workoutPayload).select('id').single()
      if (error || !data) throw new Error('Não foi possível criar o treino.')
      workoutId = data.id
    }

    if (draft.exercises.length) {
      const { error } = await supabase.from('exercises').insert(
        draft.exercises.map((exercise, position) => exercisePayload(userId, workoutId!, exercise, position)),
      )
      if (error) throw new Error('O treino foi salvo, mas não foi possível salvar os exercícios.')
    }
    return workoutId
  },

  async duplicateWorkout(userId: string, workout: WorkoutSummary) {
    return this.saveWorkout(userId, {
      ...workout,
      id: undefined,
      name: `${workout.name} — cópia`,
      source: 'manual',
      exercises: workout.exercises.map((exercise) => ({ ...exercise, id: undefined, clientId: crypto.randomUUID() })),
    })
  },

  async deleteWorkout(userId: string, workoutId: string) {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
    const { error } = await supabase.from('workouts').delete().eq('id', workoutId).eq('user_id', userId)
    if (error) throw new Error('Não foi possível excluir o treino.')
  },

  async setWorkoutActive(userId: string, workoutId: string, active: boolean) {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
    const { error } = await supabase
      .from('workouts')
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .eq('id', workoutId)
      .eq('user_id', userId)
    if (error) throw new Error('Não foi possível alterar o estado do treino.')
  },

  async generateWithAI(priorityMuscles: string[], dislikedExercises: string[]) {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
    const { data, error } = await supabase.functions.invoke('generate-workout-plan', {
      body: { priorityMuscles, dislikedExercises },
    })
    if (error) {
      const context = (error as { context?: Response }).context
      if (context) {
        const response = await context.clone().json().catch(() => null)
        if (response?.error) throw new Error(response.error)
      }
      throw new Error('Não foi possível acessar o gerador de treino.')
    }
    if (data?.error) throw new Error(data.error)
    if (!data?.plan) throw new Error('A IA não retornou um plano válido.')
    return data as { profileSummary: AIProfileSummary; plan: GeneratedPlan }
  },

  async saveGeneratedPlan(userId: string, plan: GeneratedPlan) {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
    const { data: libraryRows, error: libraryError } = await supabase
      .from('exercise_library')
      .select('id,name')
    if (libraryError) throw new Error('Não foi possível consultar a biblioteca de exercícios.')
    const libraryByName = new Map(
      (libraryRows ?? []).map((item) => [normalizeExerciseName(item.name), item.id]),
    )

    const { data: planRow, error: planError } = await supabase.from('training_plans').insert({
      user_id: userId,
      name: plan.planName.trim(),
      source: 'ai',
      rationale: plan.rationale,
    }).select('id').single()
    if (planError || !planRow) throw new Error('Não foi possível iniciar o salvamento do plano.')

    try {
      for (const workout of plan.workouts) {
        await this.saveWorkout(userId, {
          name: workout.name,
          days: workout.days,
          focus: workout.focus,
          durationMinutes: workout.durationMinutes,
          notes: workout.notes,
          active: true,
          source: 'ai',
          planId: planRow.id,
          exercises: workout.exercises.map((exercise) => ({
            ...exercise,
            clientId: crypto.randomUUID(),
            libraryExerciseId: libraryByName.get(normalizeExerciseName(exercise.name)) ?? null,
          })),
        })
      }
    } catch (error) {
      await supabase.from('training_plans').delete().eq('id', planRow.id).eq('user_id', userId)
      throw error
    }
  },

  async submitNotLiked(userId: string, plan: GeneratedPlan) {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
    const { error } = await supabase.from('ai_workout_feedback').insert({
      user_id: userId,
      feedback: 'not_liked',
      suggestion: plan,
    })
    if (error) throw new Error('Não foi possível registrar seu feedback.')
  },
}

function exercisePayload(userId: string, workoutId: string, exercise: TrainingExercise, position: number) {
  return {
    workout_id: workoutId,
    user_id: userId,
    library_exercise_id: exercise.libraryExerciseId,
    name: exercise.name,
    position,
    sets_count: exercise.sets,
    repetitions_text: exercise.repetitions,
    initial_weight: exercise.initialWeight,
    rest_seconds: exercise.restSeconds,
    notes: exercise.notes.trim() || null,
    is_optional: exercise.optional,
    advanced_technique: exercise.advancedTechnique.trim() || null,
    substitutions: exercise.substitutions,
    updated_at: new Date().toISOString(),
  }
}

function mapTrainingExercise(row: Record<string, unknown>): TrainingExercise {
  return {
    id: String(row.id),
    clientId: String(row.id),
    libraryExerciseId: row.library_exercise_id ? String(row.library_exercise_id) : null,
    name: String(row.name),
    sets: Number(row.sets_count ?? 3),
    repetitions: String(row.repetitions_text ?? '10'),
    initialWeight: row.initial_weight === null ? null : Number(row.initial_weight),
    restSeconds: Number(row.rest_seconds ?? 60),
    notes: String(row.notes ?? ''),
    optional: Boolean(row.is_optional),
    advancedTechnique: String(row.advanced_technique ?? ''),
    substitutions: array(row.substitutions),
  }
}

function mapTemplate(row: Record<string, unknown>): WorkoutTemplate {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: String(row.description ?? ''),
    suggestedDays: array(row.suggested_days) as WeekDay[],
    exercises: Array.isArray(row.exercises) ? row.exercises.map((item: Record<string, unknown>) => ({
      name: String(item.name),
      sets: Number(item.sets ?? 3),
      repetitions: String(item.repetitions ?? '10'),
      rest: Number(item.rest ?? 60),
    })) : [],
  }
}

function mapLibraryExercise(row: Record<string, unknown>): ExerciseLibraryItem {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    primaryMuscle: String(row.primary_muscle),
    secondaryMuscles: array(row.secondary_muscles),
    equipment: String(row.equipment),
    level: String(row.level) as ExerciseLevel,
    instructions: array(row.instructions),
    commonMistakes: array(row.common_mistakes),
    safetyTips: array(row.safety_tips),
    substitutions: array(row.substitutions),
    locations: array(row.locations) as ExerciseLocation[],
    imageUrl: row.image_url ? String(row.image_url) : null,
  }
}

function mapProfile(row: Record<string, unknown> | null): AIProfileSummary {
  return {
    objective: String(row?.goal ?? 'Não informado'),
    age: row?.birth_date ? calculateAge(String(row.birth_date)) : null,
    heightCm: row?.height_cm ? Number(row.height_cm) : null,
    weightKg: row?.current_weight ? Number(row.current_weight) : null,
    level: String(row?.experience_level ?? 'Não informado'),
    availableDays: array(row?.available_days),
    daysPerWeek: row?.training_days_per_week ? Number(row.training_days_per_week) : null,
    durationMinutes: row?.average_duration_minutes ? Number(row.average_duration_minutes) : null,
    locations: array(row?.training_locations),
    equipment: array(row?.equipment),
    priorityMuscles: [],
    injuries: row?.has_injuries ? String(row.injuries_details || 'Informada sem detalhes') : 'Não informadas',
    physicalLimitations: row?.has_physical_limitations ? String(row.physical_limitations_details || 'Informadas sem detalhes') : 'Não informadas',
    pain: row?.has_pain ? String(row.pain_details || 'Informada sem detalhes') : 'Não informada',
    dislikedExercises: [],
  }
}

function calculateAge(birthDate: string) {
  const birth = new Date(`${birthDate}T12:00:00`)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1
  return age
}

function array(value: unknown) {
  return Array.isArray(value) ? value.map(String) : []
}

function localDate() {
  const date = new Date()
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function todayWeekDay(): WeekDay {
  const index = new Date().getDay()
  return (['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as WeekDay[])[index]
}

function normalizeExerciseName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}
