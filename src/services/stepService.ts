import { supabase } from '../integrations/supabase'

export type StepSource = 'manual' | 'apple_health' | 'health_connect'

export interface StepRecord {
  id: string
  steps: number
  distanceKm: number
  durationMinutes: number
  calories: number
  occurredOn: string
  source: StepSource
}

export interface StepRecordInput {
  steps: number
  distanceKm: number
  durationMinutes: number
  calories: number
  occurredOn: string
}

export interface StepDay {
  date: string
  steps: number
  distanceKm: number
  durationMinutes: number
  calories: number
}

export interface StepData {
  records: StepRecord[]
  dailyGoal: number
  week: StepDay[]
  weeklyAverage: number
  bestDay: StepDay | null
  goalStreak: number
}

interface StepDataProvider {
  getData(userId: string): Promise<StepData>
  add(userId: string, input: StepRecordInput): Promise<void>
  update(userId: string, recordId: string, input: StepRecordInput): Promise<void>
  remove(userId: string, recordId: string): Promise<void>
  saveGoal(userId: string, dailyGoal: number): Promise<void>
}

let localRecords: StepRecord[] = []
let localGoal = 10000

const manualProvider: StepDataProvider = {
  async getData(userId) {
    if (!supabase) return summarize(localRecords, localGoal)
    const [recordsResult, settingsResult] = await Promise.all([
      supabase
        .from('step_records')
        .select('id,steps,distance_km,duration_minutes,calories,occurred_on,source')
        .eq('user_id', userId)
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('step_settings').select('daily_goal').eq('user_id', userId).maybeSingle(),
    ])
    if (recordsResult.error || settingsResult.error) throw new Error('Não foi possível carregar seu histórico de passos.')
    return summarize((recordsResult.data ?? []).map(mapRecord), Number(settingsResult.data?.daily_goal ?? 10000))
  },

  async add(userId, input) {
    validate(input)
    if (!supabase) {
      localRecords = [{ id: `steps-${Date.now()}`, ...input, source: 'manual' }, ...localRecords]
      return
    }
    const { error } = await supabase.from('step_records').insert(toRow(userId, input))
    if (error) throw new Error('Não foi possível registrar os passos.')
    await syncDailyStats(userId, input.occurredOn)
  },

  async update(userId, recordId, input) {
    validate(input)
    if (!supabase) {
      localRecords = localRecords.map((record) => record.id === recordId ? { ...record, ...input } : record)
      return
    }
    const { data: previous } = await supabase.from('step_records').select('occurred_on').eq('id', recordId).eq('user_id', userId).maybeSingle()
    const { error } = await supabase.from('step_records').update({
      steps: input.steps,
      distance_km: input.distanceKm,
      duration_minutes: input.durationMinutes,
      calories: input.calories,
      occurred_on: input.occurredOn,
      updated_at: new Date().toISOString(),
    }).eq('id', recordId).eq('user_id', userId).eq('source', 'manual')
    if (error) throw new Error('Não foi possível editar o registro.')
    if (previous?.occurred_on && previous.occurred_on !== input.occurredOn) await syncDailyStats(userId, previous.occurred_on)
    await syncDailyStats(userId, input.occurredOn)
  },

  async remove(userId, recordId) {
    if (!supabase) {
      localRecords = localRecords.filter((record) => record.id !== recordId)
      return
    }
    const { data: previous } = await supabase.from('step_records').select('occurred_on').eq('id', recordId).eq('user_id', userId).maybeSingle()
    const { error } = await supabase.from('step_records').delete().eq('id', recordId).eq('user_id', userId).eq('source', 'manual')
    if (error) throw new Error('Não foi possível remover o registro.')
    if (previous?.occurred_on) await syncDailyStats(userId, previous.occurred_on)
  },

  async saveGoal(userId, dailyGoal) {
    validateGoal(dailyGoal)
    if (!supabase) { localGoal = dailyGoal; return }
    const { error } = await supabase.from('step_settings').upsert({ user_id: userId, daily_goal: dailyGoal, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) throw new Error('Não foi possível salvar a meta diária.')
    await syncDailyStats(userId, localDate(), dailyGoal)
  },
}

// Novas origens implementarão o mesmo contrato e serão mescladas aqui sem alterar a tela.
export const stepService = manualProvider

async function syncDailyStats(userId: string, date: string, explicitGoal?: number) {
  if (!supabase) return
  const [{ data: records }, { data: settings }] = await Promise.all([
    supabase.from('step_records').select('steps').eq('user_id', userId).eq('occurred_on', date),
    supabase.from('step_settings').select('daily_goal').eq('user_id', userId).maybeSingle(),
  ])
  const total = (records ?? []).reduce((sum, row) => sum + Number(row.steps), 0)
  await supabase.from('daily_stats').upsert({
    user_id: userId,
    date,
    steps_current: total,
    steps_goal: explicitGoal ?? Number(settings?.daily_goal ?? 10000),
  }, { onConflict: 'user_id,date' })
}

function summarize(records: StepRecord[], dailyGoal: number): StepData {
  const byDate = new Map<string, StepDay>()
  for (const record of records) {
    const day = byDate.get(record.occurredOn) ?? emptyDay(record.occurredOn)
    day.steps += record.steps
    day.distanceKm += record.distanceKm
    day.durationMinutes += record.durationMinutes
    day.calories += record.calories
    byDate.set(record.occurredOn, day)
  }
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = localDate(daysAgo(6 - index))
    return byDate.get(date) ?? emptyDay(date)
  })
  const allDays = [...byDate.values()]
  const bestDay = allDays.reduce<StepDay | null>((best, day) => !best || day.steps > best.steps ? day : best, null)
  let goalStreak = 0
  const todayReached = (byDate.get(localDate())?.steps ?? 0) >= dailyGoal
  for (let offset = todayReached ? 0 : 1; ; offset += 1) {
    const day = byDate.get(localDate(daysAgo(offset)))
    if (!day || day.steps < dailyGoal) break
    goalStreak += 1
  }
  return {
    records,
    dailyGoal,
    week,
    weeklyAverage: Math.round(week.reduce((sum, day) => sum + day.steps, 0) / 7),
    bestDay,
    goalStreak,
  }
}

function mapRecord(row: Record<string, unknown>): StepRecord {
  return {
    id: String(row.id),
    steps: Number(row.steps),
    distanceKm: Number(row.distance_km),
    durationMinutes: Number(row.duration_minutes),
    calories: Number(row.calories),
    occurredOn: String(row.occurred_on),
    source: String(row.source) as StepSource,
  }
}

function toRow(userId: string, input: StepRecordInput) {
  return { user_id: userId, steps: input.steps, distance_km: input.distanceKm, duration_minutes: input.durationMinutes, calories: input.calories, occurred_on: input.occurredOn, source: 'manual' }
}

function validate(input: StepRecordInput) {
  if (!Number.isInteger(input.steps) || input.steps < 1 || input.steps > 200000) throw new Error('Informe entre 1 e 200.000 passos.')
  if (!Number.isFinite(input.distanceKm) || input.distanceKm < 0 || input.distanceKm > 300) throw new Error('Informe uma distância válida, entre 0 e 300 km.')
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 0 || input.durationMinutes > 1440) throw new Error('Informe um tempo válido, entre 0 e 1.440 minutos.')
  if (!Number.isFinite(input.calories) || input.calories < 0 || input.calories > 20000) throw new Error('Informe uma estimativa válida de calorias.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn) || input.occurredOn > localDate()) throw new Error('A data não pode estar no futuro.')
}

function validateGoal(goal: number) {
  if (!Number.isInteger(goal) || goal < 100 || goal > 100000) throw new Error('Defina uma meta entre 100 e 100.000 passos.')
}

function emptyDay(date: string): StepDay { return { date, steps: 0, distanceKm: 0, durationMinutes: 0, calories: 0 } }
function daysAgo(days: number) { const date = new Date(); date.setDate(date.getDate() - days); return date }
export function localDate(date = new Date()) { const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 10) }
