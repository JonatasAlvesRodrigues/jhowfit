export type ExerciseLevel = 'Iniciante' | 'Intermediário' | 'Avançado'
export type ExerciseLocation = 'Academia' | 'Casa'

export interface ExerciseLibraryItem {
  id: string
  slug: string
  name: string
  primaryMuscle: string
  secondaryMuscles: string[]
  equipment: string
  level: ExerciseLevel
  instructions: string[]
  commonMistakes: string[]
  safetyTips: string[]
  substitutions: string[]
  locations: ExerciseLocation[]
  imageUrl: string | null
}

export interface ExerciseFilters {
  search: string
  muscle: string
  equipment: string
  level: string
  location: '' | ExerciseLocation
  favoritesOnly: boolean
}

export interface WorkoutOption {
  id: string
  title: string
  exerciseCount: number
}

export interface ExerciseLibraryData {
  exercises: ExerciseLibraryItem[]
  favoriteIds: string[]
  recentIds: string[]
  workouts: WorkoutOption[]
}
