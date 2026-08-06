export type NotificationType = 'workout' | 'water' | 'meal' | 'walk' | 'weigh_in' | 'goal_near' | 'weekly_summary'

export interface NotificationPreference {
  type: NotificationType
  enabled: boolean
  time: string
  days: number[]
  intervalMinutes: number | null
}

export interface NotificationSettings {
  pausedUntil: string | null
  quietStart: string
  quietEnd: string
  preferences: NotificationPreference[]
}

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  createdAt: string
  readAt: string | null
  actionPath: string
  actionLabel: string
}

