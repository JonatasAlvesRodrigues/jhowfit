export interface HistoryWeek {
  label: string
  count: number
}

export interface HistoryRank {
  name: string
  value: number
}

export interface ExerciseHistoryPoint {
  date: string
  label: string
  maxWeight: number
  repetitions: number
  volume: number
}

export interface ExerciseProgressHistory {
  name: string
  muscleGroup: string
  sessions: number
  bestWeight: number
  bestVolume: number
  lastWorkout: string
  monthlyDifference: number | null
  points: ExerciseHistoryPoint[]
  suggestion: {
    action: 'increase' | 'maintain' | 'repetitions' | 'reduce'
    title: string
    text: string
  }
}

export interface WorkoutHistorySession {
  id: string
  name: string
  completedAt: string
  durationSeconds: number
  volumeTotal: number
  completedSets: number
  personalRecords: number
  exercises: string[]
}

export interface WorkoutHistoryData {
  completedDates: string[]
  totalWorkouts: number
  totalDurationSeconds: number
  totalVolume: number
  completionRate: number
  weekly: HistoryWeek[]
  topExercises: HistoryRank[]
  muscleFrequency: HistoryRank[]
  exercises: ExerciseProgressHistory[]
  recentWorkouts: WorkoutHistorySession[]
}
