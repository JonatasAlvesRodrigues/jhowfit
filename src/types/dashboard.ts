export interface DashboardMetric {
  current: number
  goal: number
}

export interface DashboardWorkout {
  id: string
  title: string
  muscleGroups: string[]
  focus: string
  duration: number
  level: string
  exerciseCount: number
  completed: boolean
}

export interface WeightPoint {
  date: string
  value: number
}

export interface DailyDashboardData {
  profile: {
    name: string
    avatarUrl: string | null
  }
  metrics: {
    steps: DashboardMetric
    calories: DashboardMetric
    protein: DashboardMetric
    water: DashboardMetric
    activeMinutes: number
    meals: number
  }
  workout: DashboardWorkout | null
  weight: {
    current: number | null
    difference: number | null
    history: WeightPoint[]
  }
  completion: number
  activeStreak: number
  insight: string
  hasAnyData: boolean
  allGoalsCompleted: boolean
}
