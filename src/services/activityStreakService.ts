import { supabase } from '../integrations/supabase'

export interface ActivityStreakSummary {
  currentStreak: number
  longestStreak: number
  activeToday: boolean
  timezone: string
}

export const activityStreakService = {
  async load(userId: string): Promise<ActivityStreakSummary> {
    if (!supabase || userId === 'development-preview') return { currentStreak: 0, longestStreak: 0, activeToday: false, timezone: 'America/Sao_Paulo' }
    const { data, error } = await supabase.rpc('my_activity_streak_summary')
    if (error || !data) throw error ?? new Error('Não foi possível calcular sua sequência.')
    const summary = data as any
    return {
      currentStreak: Number(summary.current_streak ?? 0),
      longestStreak: Number(summary.longest_streak ?? 0),
      activeToday: Boolean(summary.active_today),
      timezone: String(summary.timezone ?? 'America/Sao_Paulo'),
    }
  },
}
