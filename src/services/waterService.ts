import { supabase } from '../integrations/supabase'

export interface WaterLog { id: string; amountMl: number; occurredAt: string }
export interface WaterDay { date: string; totalMl: number }
export interface WaterSettings { dailyGoalMl: number; remindersEnabled: boolean; reminderTimes: string[] }
export interface WaterData { logs: WaterLog[]; settings: WaterSettings; week: WaterDay[] }

let localLogs: WaterLog[] = []
let localSettings: WaterSettings = { dailyGoalMl: 2500, remindersEnabled: false, reminderTimes: ['09:00', '12:00', '15:00', '18:00'] }

export const waterService = {
  async getData(userId: string): Promise<WaterData> {
    if (!supabase) return localData()
    const start = startOfLocalDay(daysAgo(6)).toISOString()
    const end = endOfLocalDay(new Date()).toISOString()
    const [logsResult, settingsResult, statsResult] = await Promise.all([
      supabase.from('water_intake_logs').select('id,amount_ml,occurred_at').eq('user_id', userId).gte('occurred_at', start).lte('occurred_at', end).order('occurred_at', { ascending: false }),
      supabase.from('water_settings').select('daily_goal_ml,reminders_enabled,reminder_times').eq('user_id', userId).maybeSingle(),
      supabase.from('daily_stats').select('water_goal').eq('user_id', userId).eq('date', localDate()).maybeSingle(),
    ])
    if (logsResult.error || settingsResult.error || statsResult.error) throw new Error('Não foi possível carregar seu controle de água.')
    const allLogs = (logsResult.data ?? []).map(mapLog)
    const settings: WaterSettings = settingsResult.data ? { dailyGoalMl: Number(settingsResult.data.daily_goal_ml), remindersEnabled: Boolean(settingsResult.data.reminders_enabled), reminderTimes: (settingsResult.data.reminder_times ?? []).map((time: string) => time.slice(0, 5)) } : { dailyGoalMl: Math.round(Number(statsResult.data?.water_goal ?? 2.5) * 1000), remindersEnabled: false, reminderTimes: ['09:00', '12:00', '15:00', '18:00'] }
    return { logs: allLogs.filter((log) => localDate(new Date(log.occurredAt)) === localDate()), settings, week: buildWeek(allLogs) }
  },

  async add(userId: string, amountMl: number, occurredAt = new Date().toISOString()) {
    validateAmount(amountMl)
    if (!supabase) { localLogs = [{ id: `water-${Date.now()}`, amountMl, occurredAt }, ...localLogs]; return }
    const { error } = await supabase.from('water_intake_logs').insert({ user_id: userId, amount_ml: amountMl, occurred_at: occurredAt })
    if (error) throw new Error('Não foi possível registrar a água.')
    await syncDay(userId, localDate(new Date(occurredAt)))
  },

  async update(userId: string, log: WaterLog, amountMl: number, occurredAt: string) {
    validateAmount(amountMl)
    const oldDate = localDate(new Date(log.occurredAt)); const nextDate = localDate(new Date(occurredAt))
    if (!supabase) { localLogs = localLogs.map((item) => item.id === log.id ? { ...item, amountMl, occurredAt } : item); return }
    const { error } = await supabase.from('water_intake_logs').update({ amount_ml: amountMl, occurred_at: occurredAt, updated_at: new Date().toISOString() }).eq('id', log.id).eq('user_id', userId)
    if (error) throw new Error('Não foi possível editar o registro.')
    await syncDay(userId, oldDate); if (nextDate !== oldDate) await syncDay(userId, nextDate)
  },

  async remove(userId: string, log: WaterLog) {
    if (!supabase) { localLogs = localLogs.filter((item) => item.id !== log.id); return }
    const { error } = await supabase.from('water_intake_logs').delete().eq('id', log.id).eq('user_id', userId)
    if (error) throw new Error('Não foi possível remover o registro.')
    await syncDay(userId, localDate(new Date(log.occurredAt)))
  },

  async saveSettings(userId: string, settings: WaterSettings) {
    if (settings.dailyGoalMl < 250 || settings.dailyGoalMl > 15000) throw new Error('Defina uma meta entre 250 ml e 15 litros.')
    const reminderTimes = Array.from(new Set(settings.reminderTimes)).sort()
    if (!supabase) { localSettings = { ...settings, reminderTimes }; return }
    const { error } = await supabase.from('water_settings').upsert({ user_id: userId, daily_goal_ml: settings.dailyGoalMl, reminders_enabled: settings.remindersEnabled, reminder_times: reminderTimes, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) throw new Error('Não foi possível salvar as preferências de água.')
    const { error: statsError } = await supabase.from('daily_stats').upsert({ user_id: userId, date: localDate(), water_goal: settings.dailyGoalMl / 1000 }, { onConflict: 'user_id,date' })
    if (statsError) throw new Error('Preferências salvas, mas não foi possível atualizar a meta do painel.')
  },
}

async function syncDay(userId: string, date: string) {
  if (!supabase) return
  const start = startOfLocalDay(new Date(`${date}T12:00:00`)).toISOString(); const end = endOfLocalDay(new Date(`${date}T12:00:00`)).toISOString()
  const [{ data, error }, settings] = await Promise.all([
    supabase.from('water_intake_logs').select('amount_ml').eq('user_id', userId).gte('occurred_at', start).lte('occurred_at', end),
    supabase.from('water_settings').select('daily_goal_ml').eq('user_id', userId).maybeSingle(),
  ])
  if (error) throw new Error('O registro foi salvo, mas o resumo não pôde ser atualizado.')
  const total = (data ?? []).reduce((sum, row) => sum + Number(row.amount_ml), 0)
  await supabase.from('daily_stats').upsert({ user_id: userId, date, water_current: total / 1000, water_goal: Number(settings.data?.daily_goal_ml ?? 2500) / 1000 }, { onConflict: 'user_id,date' })
}

function localData(): WaterData { const todayLogs = localLogs.filter((log) => localDate(new Date(log.occurredAt)) === localDate()); return { logs: todayLogs, settings: localSettings, week: buildWeek(localLogs) } }
function mapLog(row: Record<string, unknown>): WaterLog { return { id: String(row.id), amountMl: Number(row.amount_ml), occurredAt: String(row.occurred_at) } }
function buildWeek(logs: WaterLog[]) { return Array.from({ length: 7 }, (_, offset) => { const date = localDate(daysAgo(6 - offset)); return { date, totalMl: logs.filter((log) => localDate(new Date(log.occurredAt)) === date).reduce((sum, log) => sum + log.amountMl, 0) } }) }
function validateAmount(value: number) { if (!Number.isFinite(value) || value < 1 || value > 10000) throw new Error('Informe uma quantidade entre 1 ml e 10 litros.') }
function daysAgo(days: number) { const date = new Date(); date.setDate(date.getDate() - days); return date }
function startOfLocalDay(date: Date) { const result = new Date(date); result.setHours(0, 0, 0, 0); return result }
function endOfLocalDay(date: Date) { const result = new Date(date); result.setHours(23, 59, 59, 999); return result }
function localDate(date = new Date()) { const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 10) }
