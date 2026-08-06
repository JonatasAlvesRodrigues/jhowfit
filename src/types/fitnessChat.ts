export type FitnessPermission = 'profile' | 'objective' | 'workouts' | 'history' | 'nutrition' | 'steps' | 'water' | 'weight' | 'goals'
export type FitnessPermissions = Record<FitnessPermission, boolean>
export type FitnessActionType = 'exercise_substitution' | 'workout_change' | 'new_meal' | 'goal_adjustment' | 'weekly_summary'

export interface FitnessAction {
  type: FitnessActionType
  title: string
  summary: string
  details: Array<{ label: string; value: string }>
  payload: Record<string, unknown>
}

export interface AiConversation {
  id: string
  title: string
  permissions: FitnessPermissions
  createdAt: string
  updatedAt: string
}

export interface AiMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  action: FitnessAction | null
  actionStatus: 'pending' | 'confirmed' | 'dismissed' | null
  createdAt: string
}

export const emptyFitnessPermissions: FitnessPermissions = {
  profile: false, objective: false, workouts: false, history: false, nutrition: false,
  steps: false, water: false, weight: false, goals: false,
}
