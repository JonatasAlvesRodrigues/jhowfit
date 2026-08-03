export type PageId = 'inicio' | 'treinos' | 'nutricao' | 'progresso' | 'mais'

export interface DailyStats {
  calories: { current: number; goal: number }
  water: { current: number; goal: number }
  steps: { current: number; goal: number }
  workout: { minutes: number; calories: number }
}

export interface Workout {
  id: string
  title: string
  focus: string
  duration: number
  exercises: number
  completed?: boolean
}

export interface Meal {
  id: string
  name: string
  description: string
  calories: number
  time: string
}

export interface ChartPoint { label: string; value: number }
