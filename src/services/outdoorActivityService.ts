import { supabase } from '../integrations/supabase'

export type ActivityType = 'walk' | 'run' | 'treadmill' | 'bike' | 'other'
export type GpsStatus = 'not_required' | 'searching' | 'active' | 'disabled' | 'denied' | 'unavailable'

export interface RoutePoint {
  latitude: number
  longitude: number
  accuracy: number
  recordedAt: number
}

export interface ActivityInput {
  type: ActivityType
  startedAt: string
  endedAt: string
  durationSeconds: number
  distanceKm: number
  calories: number
  observation: string
  difficulty: number
  route: RoutePoint[]
  gpsStatus: GpsStatus
  interrupted: boolean
}

export interface ActivityRecord extends ActivityInput {
  id: string
  averagePaceSeconds: number | null
  averageSpeedKmh: number
}

const localActivities: ActivityRecord[] = []

export const outdoorActivityService = {
  async list(userId: string): Promise<ActivityRecord[]> {
    if (!supabase) return [...localActivities]
    const { data, error } = await supabase
      .from('outdoor_activities')
      .select('id,type,started_at,ended_at,duration_seconds,distance_km,average_pace_seconds,average_speed_kmh,calories,observation,difficulty,route,gps_status,interrupted')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(50)
    if (error) throw new Error('Não foi possível carregar suas atividades recentes.')
    return (data ?? []).map(mapActivity)
  },

  async save(userId: string, input: ActivityInput): Promise<ActivityRecord> {
    validate(input)
    const pace = input.distanceKm > 0 ? Math.round(input.durationSeconds / input.distanceKm) : null
    const speed = input.durationSeconds > 0 ? round(input.distanceKm / (input.durationSeconds / 3600), 2) : 0
    if (!supabase) {
      const activity = { id: `activity-${Date.now()}`, ...input, averagePaceSeconds: pace, averageSpeedKmh: speed }
      localActivities.unshift(activity)
      return activity
    }
    const { data, error } = await supabase.from('outdoor_activities').insert({
      user_id: userId,
      type: input.type,
      started_at: input.startedAt,
      ended_at: input.endedAt,
      duration_seconds: input.durationSeconds,
      distance_km: input.distanceKm,
      average_pace_seconds: pace,
      average_speed_kmh: speed,
      calories: input.calories,
      observation: input.observation.trim(),
      difficulty: input.difficulty,
      route: input.route,
      gps_status: input.gpsStatus,
      interrupted: input.interrupted,
    }).select('id,type,started_at,ended_at,duration_seconds,distance_km,average_pace_seconds,average_speed_kmh,calories,observation,difficulty,route,gps_status,interrupted').single()
    if (error || !data) throw new Error(typeof navigator === 'undefined' || navigator.onLine ? 'Não foi possível salvar a atividade.' : 'Sem conexão. Sua atividade continua guardada neste dispositivo para você tentar novamente.')
    return mapActivity(data)
  },
}

function mapActivity(row: Record<string, unknown>): ActivityRecord {
  return {
    id: String(row.id),
    type: String(row.type) as ActivityType,
    startedAt: String(row.started_at),
    endedAt: String(row.ended_at),
    durationSeconds: Number(row.duration_seconds),
    distanceKm: Number(row.distance_km),
    averagePaceSeconds: row.average_pace_seconds === null ? null : Number(row.average_pace_seconds),
    averageSpeedKmh: Number(row.average_speed_kmh),
    calories: Number(row.calories),
    observation: String(row.observation ?? ''),
    difficulty: Number(row.difficulty),
    route: Array.isArray(row.route) ? row.route.map((point) => ({
      latitude: Number((point as Record<string, unknown>).latitude),
      longitude: Number((point as Record<string, unknown>).longitude),
      accuracy: Number((point as Record<string, unknown>).accuracy),
      recordedAt: Number((point as Record<string, unknown>).recordedAt),
    })) : [],
    gpsStatus: String(row.gps_status) as GpsStatus,
    interrupted: Boolean(row.interrupted),
  }
}

function validate(input: ActivityInput) {
  if (!['walk', 'run', 'treadmill', 'bike', 'other'].includes(input.type)) throw new Error('Selecione um tipo de atividade válido.')
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 1 || input.durationSeconds > 172800) throw new Error('A duração da atividade é inválida.')
  if (!Number.isFinite(input.distanceKm) || input.distanceKm < 0 || input.distanceKm > 1000) throw new Error('A distância informada é inválida.')
  if (!Number.isFinite(input.calories) || input.calories < 0 || input.calories > 50000) throw new Error('A estimativa de calorias é inválida.')
  if (!Number.isInteger(input.difficulty) || input.difficulty < 1 || input.difficulty > 5) throw new Error('Avalie a dificuldade de 1 a 5.')
  if (input.observation.length > 1000) throw new Error('A observação deve ter até 1.000 caracteres.')
}

function round(value: number, digits: number) { const factor = 10 ** digits; return Math.round(value * factor) / factor }
