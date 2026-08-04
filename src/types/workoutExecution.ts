import type { ExerciseLibraryItem } from './exerciseLibrary'
import type { WorkoutSummary } from './trainingPlan'

export interface ExecutionSet {
  id: string
  setNumber: number
  plannedRepetitions: string
  weight: number | null
  repetitions: number | null
  completed: boolean
  personalRecord: boolean
}

export interface ExecutionExercise {
  id: string
  sourceExerciseId: string | null
  libraryExerciseId: string | null
  name: string
  position: number
  plannedSets: number
  plannedRepetitions: string
  recommendedWeight: number | null
  previousWeight: number | null
  restSeconds: number
  notes: string
  imageUrl: string | null
  skipped: boolean
  sets: ExecutionSet[]
}

export interface WorkoutExecutionSession {
  id: string
  workoutId: string | null
  workoutName: string
  status: 'active' | 'paused'
  startedAt: string
  pausedAt: string | null
  totalPausedSeconds: number
  currentExerciseIndex: number
  exercises: ExecutionExercise[]
}

export interface WorkoutFinishSummary {
  durationSeconds: number
  exercisesCompleted: number
  volumeTotal: number
  completedSets: number
  personalRecords: number
  volumeDifference: number | null
  durationDifference: number | null
}

export interface WorkoutExecutionProps {
  userId: string
  workout?: WorkoutSummary
  recoverySessionId?: string
  library: ExerciseLibraryItem[]
  onExit: () => void
}
