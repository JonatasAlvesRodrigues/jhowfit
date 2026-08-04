import type { ExerciseLibraryItem } from './exerciseLibrary'

export const weekDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'] as const
export type WeekDay = typeof weekDays[number]

export interface TrainingExercise {
  id?: string
  clientId: string
  libraryExerciseId: string | null
  name: string
  sets: number
  repetitions: string
  initialWeight: number | null
  restSeconds: number
  notes: string
  optional: boolean
  advancedTechnique: string
  substitutions: string[]
}

export interface WorkoutDraft {
  id?: string
  planId?: string
  name: string
  days: WeekDay[]
  notes: string
  active: boolean
  source: 'manual' | 'ai' | 'template'
  durationMinutes: number
  focus: string
  exercises: TrainingExercise[]
}

export interface WorkoutSummary extends WorkoutDraft {
  id: string
  updatedAt: string
}

export interface WorkoutTemplate {
  id: string
  slug: string
  name: string
  description: string
  suggestedDays: WeekDay[]
  exercises: Array<{
    name: string
    sets: number
    repetitions: string
    rest: number
  }>
}

export interface AIProfileSummary {
  objective: string
  age: number | null
  heightCm: number | null
  weightKg: number | null
  level: string
  availableDays: string[]
  daysPerWeek: number | null
  durationMinutes: number | null
  locations: string[]
  equipment: string[]
  priorityMuscles: string[]
  injuries: string
  physicalLimitations: string
  pain: string
  dislikedExercises: string[]
}

export interface GeneratedWorkout {
  name: string
  days: WeekDay[]
  focus: string
  durationMinutes: number
  notes: string
  exercises: Array<{
    name: string
    sets: number
    repetitions: string
    restSeconds: number
    initialWeight: number | null
    notes: string
    optional: boolean
    advancedTechnique: string
    substitutions: string[]
  }>
}

export interface GeneratedPlan {
  planName: string
  weeklySplit: Array<{ day: string; workout: string }>
  workouts: GeneratedWorkout[]
  rationale: string
  safetyNotice: string
}

export interface TrainingHubData {
  workouts: WorkoutSummary[]
  templates: WorkoutTemplate[]
  library: ExerciseLibraryItem[]
  profile: AIProfileSummary
}
