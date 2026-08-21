import { supabase } from '../integrations/supabase'
import { activityStreakService } from './activityStreakService'

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

    const [workoutResult, stepsResult, waterResult, goalsResult, profileResult, streakSummary] = await Promise.all([
      supabase.from('workout_sessions').select('started_at,ended_at,status,pr_count').eq('user_id', userId).eq('status', 'completed').order('started_at'),
      supabase.from('step_records').select('occurred_on,steps').eq('user_id', userId).order('occurred_on'),
      supabase.from('water_intake_logs').select('occurred_at,amount_ml').eq('user_id', userId).order('occurred_at'),
      supabase.from('personal_goals').select('status,frequency,updated_at').eq('user_id', userId).eq('frequency', 'weekly').order('updated_at'),
      supabase.from('profiles').select('created_at').eq('id', userId).maybeSingle(),
      activityStreakService.load(userId),
    ])
    const failed = [workoutResult, stepsResult, waterResult, goalsResult, profileResult].find((result) => result.error)
    if (failed?.error) throw failed.error

    return buildSummary(
      (workoutResult.data ?? []) as WorkoutRow[],
      (stepsResult.data ?? []) as StepRow[],
      (waterResult.data ?? []) as WaterRow[],
      (goalsResult.data ?? []) as GoalRow[],
      profileResult.data?.created_at ?? new Date().toISOString(),
      streakSummary.currentStreak,
    )
  },
}

function buildSummary(workouts: WorkoutRow[], steps: StepRow[], water: WaterRow[], goals: GoalRow[], createdAt: string, physicalActivityStreak: number): AchievementSummary {
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
  const waterDayDates = [...waterDays.keys()].sort()
  const lastWaterDate = waterDayDates.length ? waterDayDates[waterDayDates.length - 1] : null
  const totalSteps = [...stepDays.values()].reduce((sum, value) => sum + value, 0)
  const totalWaterLiters = [...waterDays.values()].reduce((sum, value) => sum + value, 0) / 1000
  const highestStepDay = Math.max(0, ...stepDays.values())
  const stepsDateAt = (target: number) => [...stepDays].find(([, total]) => total >= target)?.[0] ?? null
  const personalRecords = workouts.reduce((total, workout) => total + Math.max(0, Number(workout.pr_count) || 0), 0)
  const streak = physicalActivityStreak
  const bestWeek = calculateBestWeek(activeSorted)
  const completedGoals = goals.filter((goal) => goal.status === 'completed')
  const lastActiveDate = activeSorted.length ? activeSorted[activeSorted.length - 1] : null

  const definitions: Achievement[] = [
    achievement('first-workout', 'Primeiro movimento', 'Seu primeiro treino concluído.', 'spark', 100, workouts.length, 1, 'treino', workouts[0]?.ended_at ?? workouts[0]?.started_at),
    achievement('five-workouts', 'Ritmo encontrado', 'Cinco treinos concluídos no seu tempo.', 'five', 180, workouts.length, 5, 'treinos', workouts[4]?.ended_at ?? workouts[4]?.started_at),
    achievement('ten-k-steps', 'Dez mil passos', 'Um dia inteiro colocando o corpo em movimento.', 'steps', 150, tenKDate ? 10000 : Math.max(0, ...stepDays.values()), 10000, 'passos', tenKDate),
    achievement('water-week', 'Hidratação presente', 'Água registrada em sete dias — não precisam ser seguidos.', 'water', 160, waterDays.size, 7, 'dias', waterDate),
    achievement('first-pr', 'Nova marca', 'Seu primeiro recorde pessoal de carga.', 'record', 220, firstPr ? 1 : 0, 1, 'recorde', firstPr?.ended_at ?? firstPr?.started_at),
    achievement('active-month', 'Um mês em movimento', 'Trinta dias ativos acumulados, com pausas respeitadas.', 'month', 300, active.size, 30, 'dias ativos', activeSorted[29] ?? null),
    achievement('weekly-goal', 'Semana cumprida', 'Uma meta semanal concluída.', 'goal', 200, weeklyGoal ? 1 : 0, 1, 'meta', weeklyGoal?.updated_at),
    achievement('ten-workouts', 'Dez na conta', 'Conclua dez treinos e consolide o seu ritmo.', 'five', 240, workouts.length, 10, 'treinos', workouts[9]?.ended_at ?? workouts[9]?.started_at),
    achievement('twenty-five-workouts', 'Rotina de verdade', 'Complete 25 treinos no seu próprio ritmo.', 'five', 380, workouts.length, 25, 'treinos', workouts[24]?.ended_at ?? workouts[24]?.started_at),
    achievement('fifty-workouts', 'Força da constância', 'Complete 50 treinos.', 'five', 600, workouts.length, 50, 'treinos', workouts[49]?.ended_at ?? workouts[49]?.started_at),
    achievement('hundred-workouts', 'Centenário do movimento', 'Chegue a 100 treinos concluídos.', 'month', 1000, workouts.length, 100, 'treinos', workouts[99]?.ended_at ?? workouts[99]?.started_at),
    achievement('five-k-steps', 'Primeiros 5 mil', 'Alcance 5.000 passos em um dia.', 'steps', 90, highestStepDay, 5000, 'passos', stepsDateAt(5000)),
    achievement('twenty-k-steps', 'Dia gigante', 'Alcance 20.000 passos em um único dia.', 'steps', 300, highestStepDay, 20000, 'passos', stepsDateAt(20000)),
    achievement('fifty-k-total-steps', 'Caminho aberto', 'Some 50 mil passos registrados.', 'steps', 150, totalSteps, 50000, 'passos', stepsDateAt(1)),
    achievement('two-hundred-fifty-k-steps', 'Horizonte em movimento', 'Some 250 mil passos registrados.', 'steps', 420, totalSteps, 250000, 'passos', stepsDateAt(1)),
    achievement('million-steps', 'Um milhão de passos', 'Some um milhão de passos na sua jornada.', 'month', 1200, totalSteps, 1000000, 'passos', stepsDateAt(1)),
    achievement('water-fortnight', 'Hidratação constante', 'Registre água em 14 dias diferentes.', 'water', 260, waterDays.size, 14, 'dias', waterDayDates[13] ?? null),
    achievement('water-month', 'Mês bem hidratado', 'Registre água em 30 dias diferentes.', 'water', 520, waterDays.size, 30, 'dias', waterDayDates[29] ?? null),
    achievement('twenty-five-liters', '25 litros de cuidado', 'Acumule 25 litros de água registrados.', 'water', 220, totalWaterLiters, 25, 'litros', lastWaterDate),
    achievement('hundred-liters', '100 litros de cuidado', 'Acumule 100 litros de água registrados.', 'water', 650, totalWaterLiters, 100, 'litros', lastWaterDate),
    achievement('seven-active-days', 'Semana ativa', 'Some sete dias ativos.', 'spark', 170, active.size, 7, 'dias ativos', activeSorted[6] ?? null),
    achievement('sixty-active-days', 'Dois meses em movimento', 'Some 60 dias ativos.', 'month', 700, active.size, 60, 'dias ativos', activeSorted[59] ?? null),
    achievement('three-day-streak', 'Três dias de ritmo', 'Mantenha três dias ativos seguidos.', 'spark', 190, streak, 3, 'dias seguidos', lastActiveDate),
    achievement('seven-day-streak', 'Uma semana inteira', 'Mantenha sete dias ativos seguidos.', 'month', 480, streak, 7, 'dias seguidos', lastActiveDate),
    achievement('five-day-week', 'Semana produtiva', 'Tenha cinco dias ativos em uma semana.', 'goal', 280, bestWeek, 5, 'dias na semana', lastActiveDate),
    achievement('five-personal-records', 'Colecionador de recordes', 'Registre cinco recordes pessoais de carga.', 'record', 500, personalRecords, 5, 'recordes', workouts.find((row) => Number(row.pr_count) > 0)?.ended_at ?? null),
    achievement('three-weekly-goals', 'Metas em sequência', 'Conclua três metas semanais.', 'goal', 450, completedGoals.length, 3, 'metas', completedGoals[2]?.updated_at ?? null),
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
    streak,
    bestWeek,
    evolution: previousActiveDays ? Math.round(((activeDays - previousActiveDays) / previousActiveDays) * 100) : activeDays ? 100 : 0,
    totals: {
      workouts: workouts.length,
      steps: totalSteps,
      waterLiters: totalWaterLiters,
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
    achievement('ten-workouts', 'Dez na conta', 'Conclua dez treinos e consolide o seu ritmo.', 'five', 240, 18, 10, 'treinos', now),
    achievement('twenty-five-workouts', 'Rotina de verdade', 'Complete 25 treinos no seu próprio ritmo.', 'five', 380, 18, 25, 'treinos'),
    achievement('fifty-workouts', 'Força da constância', 'Complete 50 treinos.', 'five', 600, 18, 50, 'treinos'),
    achievement('hundred-workouts', 'Centenário do movimento', 'Chegue a 100 treinos concluídos.', 'month', 1000, 18, 100, 'treinos'),
    achievement('five-k-steps', 'Primeiros 5 mil', 'Alcance 5.000 passos em um dia.', 'steps', 90, 10000, 5000, 'passos', now),
    achievement('twenty-k-steps', 'Dia gigante', 'Alcance 20.000 passos em um único dia.', 'steps', 300, 10000, 20000, 'passos'),
    achievement('fifty-k-total-steps', 'Caminho aberto', 'Some 50 mil passos registrados.', 'steps', 150, 184320, 50000, 'passos', now),
    achievement('two-hundred-fifty-k-steps', 'Horizonte em movimento', 'Some 250 mil passos registrados.', 'steps', 420, 184320, 250000, 'passos'),
    achievement('million-steps', 'Um milhão de passos', 'Some um milhão de passos na sua jornada.', 'month', 1200, 184320, 1000000, 'passos'),
    achievement('water-fortnight', 'Hidratação constante', 'Registre água em 14 dias diferentes.', 'water', 260, 21, 14, 'dias', now),
    achievement('water-month', 'Mês bem hidratado', 'Registre água em 30 dias diferentes.', 'water', 520, 21, 30, 'dias'),
    achievement('twenty-five-liters', '25 litros de cuidado', 'Acumule 25 litros de água registrados.', 'water', 220, 62.4, 25, 'litros', now),
    achievement('hundred-liters', '100 litros de cuidado', 'Acumule 100 litros de água registrados.', 'water', 650, 62.4, 100, 'litros'),
    achievement('seven-active-days', 'Semana ativa', 'Some sete dias ativos.', 'spark', 170, 21, 7, 'dias ativos', now),
    achievement('sixty-active-days', 'Dois meses em movimento', 'Some 60 dias ativos.', 'month', 700, 21, 60, 'dias ativos'),
    achievement('three-day-streak', 'Três dias de ritmo', 'Mantenha três dias ativos seguidos.', 'spark', 190, 6, 3, 'dias seguidos', now),
    achievement('seven-day-streak', 'Uma semana inteira', 'Mantenha sete dias ativos seguidos.', 'month', 480, 6, 7, 'dias seguidos'),
    achievement('five-day-week', 'Semana produtiva', 'Tenha cinco dias ativos em uma semana.', 'goal', 280, 6, 5, 'dias na semana', now),
    achievement('five-personal-records', 'Colecionador de recordes', 'Registre cinco recordes pessoais de carga.', 'record', 500, 3, 5, 'recordes'),
    achievement('three-weekly-goals', 'Metas em sequência', 'Conclua três metas semanais.', 'goal', 450, 1, 3, 'metas'),
  ]
  const xp = achievements.filter((item) => item.unlocked).reduce((total, item) => total + item.xp, 0)
  const level = Math.min(5, Math.floor(xp / 400) + 1)
  const levels = ['Começo', 'Em movimento', 'Constante', 'Inspirador', 'Imparável']
  return { achievements, xp, level, levelName: levels[level - 1], currentLevelXp: xp - (level - 1) * 400, nextLevelXp: 400, activeDays: 21, consistency: 70, streak: 6, bestWeek: 6, evolution: 24, totals: { workouts: 18, steps: 184320, waterLiters: 62.4 } }
}
