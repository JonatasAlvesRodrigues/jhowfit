import { supabase } from '../integrations/supabase'

export type AchievementIcon = 'spark' | 'five' | 'steps' | 'water' | 'record' | 'month' | 'goal'

export interface Achievement {
  id: string
  title: string
  description: string
  icon: AchievementIcon
  xp: number
  unlocked: boolean
  unlockedAt: string | null
  progress: number
  target: number
  unit: string
}

export interface AchievementSummary {
  achievements: Achievement[]
  xp: number
  level: number
  levelName: string
  currentLevelXp: number
  nextLevelXp: number
  activeDays: number
  consistency: number
  streak: number
  bestWeek: number
  evolution: number
  totals: { workouts: number; steps: number; waterLiters: number }
}

type WorkoutRow = { started_at: string; ended_at: string | null; status: string; pr_count: number | null }
type StepRow = { occurred_on: string; steps: number }
type WaterRow = { occurred_at: string; amount_ml: number }
type GoalRow = { status: string; frequency: string; updated_at: string }

const dayKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const achievementService = {
  async load(userId: string): Promise<AchievementSummary> {
    if (!supabase || userId === 'development-preview') return demoSummary()

    const [workoutResult, stepsResult, waterResult, goalsResult, profileResult] = await Promise.all([
      supabase.from('workout_sessions').select('started_at,ended_at,status,pr_count').eq('user_id', userId).eq('status', 'completed').order('started_at'),
      supabase.from('step_records').select('occurred_on,steps').eq('user_id', userId).order('occurred_on'),
      supabase.from('water_intake_logs').select('occurred_at,amount_ml').eq('user_id', userId).order('occurred_at'),
      supabase.from('personal_goals').select('status,frequency,updated_at').eq('user_id', userId).eq('frequency', 'weekly').order('updated_at'),
      supabase.from('profiles').select('created_at').eq('id', userId).maybeSingle(),
    ])
    const failed = [workoutResult, stepsResult, waterResult, goalsResult, profileResult].find((result) => result.error)
    if (failed?.error) throw failed.error

    return buildSummary(
      (workoutResult.data ?? []) as WorkoutRow[],
      (stepsResult.data ?? []) as StepRow[],
      (waterResult.data ?? []) as WaterRow[],
      (goalsResult.data ?? []) as GoalRow[],
      profileResult.data?.created_at ?? new Date().toISOString(),
    )
  },
}

function buildSummary(workouts: WorkoutRow[], steps: StepRow[], water: WaterRow[], goals: GoalRow[], createdAt: string): AchievementSummary {
  const stepDays = sumByDay(steps.map((row) => ({ date: row.occurred_on, value: Number(row.steps) })))
  const waterDays = sumByDay(water.map((row) => ({ date: row.occurred_at, value: Number(row.amount_ml) })))
  const workoutDates = workouts.map((row) => dayKey(row.ended_at ?? row.started_at))
  const active = new Set([...workoutDates, ...stepDays.keys(), ...waterDays.keys()])
  const activeSorted = [...active].sort()
  const last30Start = new Date(); last30Start.setDate(last30Start.getDate() - 29)
  const previous30Start = new Date(); previous30Start.setDate(previous30Start.getDate() - 59)
  const activeDays = activeSorted.filter((date) => date >= dayKey(last30Start)).length
  const previousActiveDays = activeSorted.filter((date) => date >= dayKey(previous30Start) && date < dayKey(last30Start)).length
  const accountDays = Math.max(1, Math.min(30, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000) + 1))
  const firstPr = workouts.find((row) => Number(row.pr_count) > 0)
  const tenKDate = [...stepDays].find(([, total]) => total >= 10000)?.[0] ?? null
  const waterDate = [...waterDays.keys()].sort()[6] ?? null
  const weeklyGoal = goals.find((goal) => goal.status === 'completed')

  const definitions: Achievement[] = [
    achievement('first-workout', 'Primeiro movimento', 'Seu primeiro treino concluído.', 'spark', 100, workouts.length, 1, 'treino', workouts[0]?.ended_at ?? workouts[0]?.started_at),
    achievement('five-workouts', 'Ritmo encontrado', 'Cinco treinos concluídos no seu tempo.', 'five', 180, workouts.length, 5, 'treinos', workouts[4]?.ended_at ?? workouts[4]?.started_at),
    achievement('ten-k-steps', 'Dez mil passos', 'Um dia inteiro colocando o corpo em movimento.', 'steps', 150, tenKDate ? 10000 : Math.max(0, ...stepDays.values()), 10000, 'passos', tenKDate),
    achievement('water-week', 'Hidratação presente', 'Água registrada em sete dias — não precisam ser seguidos.', 'water', 160, waterDays.size, 7, 'dias', waterDate),
    achievement('first-pr', 'Nova marca', 'Seu primeiro recorde pessoal de carga.', 'record', 220, firstPr ? 1 : 0, 1, 'recorde', firstPr?.ended_at ?? firstPr?.started_at),
    achievement('active-month', 'Um mês em movimento', 'Trinta dias ativos acumulados, com pausas respeitadas.', 'month', 300, active.size, 30, 'dias ativos', activeSorted[29] ?? null),
    achievement('weekly-goal', 'Semana cumprida', 'Uma meta semanal concluída.', 'goal', 200, weeklyGoal ? 1 : 0, 1, 'meta', weeklyGoal?.updated_at),
  ]
  const xp = definitions.filter((item) => item.unlocked).reduce((total, item) => total + item.xp, 0)
  const levels = ['Começo', 'Em movimento', 'Constante', 'Inspirador', 'Imparável']
  const level = Math.min(5, Math.floor(xp / 400) + 1)
  const levelFloor = (level - 1) * 400
  return {
    achievements: definitions,
    xp,
    level,
    levelName: levels[level - 1],
    currentLevelXp: xp - levelFloor,
    nextLevelXp: level === 5 ? 400 : 400,
    activeDays,
    consistency: Math.min(100, Math.round((activeDays / accountDays) * 100)),
    streak: calculateStreak(active),
    bestWeek: calculateBestWeek(activeSorted),
    evolution: previousActiveDays ? Math.round(((activeDays - previousActiveDays) / previousActiveDays) * 100) : activeDays ? 100 : 0,
    totals: {
      workouts: workouts.length,
      steps: [...stepDays.values()].reduce((sum, value) => sum + value, 0),
      waterLiters: [...waterDays.values()].reduce((sum, value) => sum + value, 0) / 1000,
    },
  }
}

function achievement(id: string, title: string, description: string, icon: AchievementIcon, xp: number, progress: number, target: number, unit: string, date?: string | null): Achievement {
  const unlocked = progress >= target
  return { id, title, description, icon, xp, unlocked, unlockedAt: unlocked && date ? date : null, progress: Math.min(progress, target), target, unit }
}

function sumByDay(rows: Array<{ date: string; value: number }>) {
  const map = new Map<string, number>()
  rows.forEach(({ date, value }) => { const key = dayKey(date); map.set(key, (map.get(key) ?? 0) + value) })
  return map
}

function calculateStreak(active: Set<string>) {
  const cursor = new Date()
  if (!active.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (active.has(dayKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1) }
  return streak
}

function calculateBestWeek(dates: string[]) {
  const weeks = new Map<string, number>()
  dates.forEach((value) => {
    const date = new Date(`${value}T12:00:00`)
    const monday = new Date(date)
    monday.setDate(date.getDate() - ((date.getDay() + 6) % 7))
    const key = dayKey(monday)
    weeks.set(key, (weeks.get(key) ?? 0) + 1)
  })
  return Math.max(0, ...weeks.values())
}

function demoSummary(): AchievementSummary {
  const now = new Date().toISOString()
  const achievements: Achievement[] = [
    achievement('first-workout', 'Primeiro movimento', 'Seu primeiro treino concluído.', 'spark', 100, 1, 1, 'treino', '2026-07-04'),
    achievement('five-workouts', 'Ritmo encontrado', 'Cinco treinos concluídos no seu tempo.', 'five', 180, 5, 5, 'treinos', '2026-07-18'),
    achievement('ten-k-steps', 'Dez mil passos', 'Um dia inteiro colocando o corpo em movimento.', 'steps', 150, 10000, 10000, 'passos', '2026-07-22'),
    achievement('water-week', 'Hidratação presente', 'Água registrada em sete dias — não precisam ser seguidos.', 'water', 160, 7, 7, 'dias', now),
    achievement('first-pr', 'Nova marca', 'Seu primeiro recorde pessoal de carga.', 'record', 220, 1, 1, 'recorde', '2026-07-28'),
    achievement('active-month', 'Um mês em movimento', 'Trinta dias ativos acumulados, com pausas respeitadas.', 'month', 300, 24, 30, 'dias ativos'),
    achievement('weekly-goal', 'Semana cumprida', 'Uma meta semanal concluída.', 'goal', 200, 0, 1, 'meta'),
  ]
  return { achievements, xp: 810, level: 3, levelName: 'Constante', currentLevelXp: 10, nextLevelXp: 400, activeDays: 21, consistency: 70, streak: 6, bestWeek: 6, evolution: 24, totals: { workouts: 18, steps: 184320, waterLiters: 62.4 } }
}
