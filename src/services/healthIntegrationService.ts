import { supabase } from '../integrations/supabase'
import {
  defaultHealthPermissions,
  type HealthConnection,
  type HealthPermission,
  type HealthPermissionState,
  type HealthProvider,
  type NativeHealthAvailability,
  type NativeHealthRecord,
} from '../types/healthIntegration'

const permissionKeys: HealthPermission[] = ['steps', 'distance', 'workout', 'active_calories', 'weight']

export const healthIntegrationService = {
  async availability(): Promise<NativeHealthAvailability> {
    if (typeof window !== 'undefined' && window.MovelyaHealthBridge) return window.MovelyaHealthBridge.getAvailability()
    const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent
    const platform = /iPhone|iPad|iPod/i.test(agent) ? 'ios' : /Android/i.test(agent) ? 'android' : 'web'
    return {
      available: false,
      provider: platform === 'ios' ? 'apple_health' : platform === 'android' ? 'health_connect' : null,
      platform,
      reason: 'O navegador e o PWA não recebem acesso direto aos dados de saúde do sistema.',
    }
  },

  async getConnection(userId: string, provider: HealthProvider): Promise<HealthConnection | null> {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('health_connections')
      .select('provider,status,permissions,device_label,last_sync_at,last_error')
      .eq('user_id', userId)
      .eq('provider', provider)
      .maybeSingle()
    if (error) throw new Error('Não foi possível carregar o estado da integração.')
    return data ? mapConnection(data) : null
  },

  async connect(userId: string, provider: HealthProvider, requested: HealthPermissionState): Promise<HealthConnection> {
    const bridge = requireBridge()
    const availability = await bridge.getAvailability()
    if (!availability.available || availability.provider !== provider) throw new Error(availability.reason || 'Serviço de saúde indisponível neste dispositivo.')
    const requestedKeys = enabledPermissions(requested)
    const authorization = await bridge.requestPermissions({ provider, permissions: requestedKeys })
    const permissions = permissionState(authorization.granted)
    if (!authorization.granted.length) throw new Error('Nenhuma permissão foi autorizada no sistema.')
    if (!supabase) return { provider, status: 'connected', permissions, deviceLabel: availability.deviceLabel ?? '', lastSyncAt: null, lastError: '' }
    const { data, error } = await supabase.from('health_connections').upsert({
      user_id: userId,
      provider,
      status: 'connected',
      permissions,
      device_label: availability.deviceLabel ?? '',
      last_error: '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' }).select('provider,status,permissions,device_label,last_sync_at,last_error').single()
    if (error || !data) throw new Error('Não foi possível salvar a conexão com segurança.')
    return mapConnection(data)
  },

  async updatePermissions(userId: string, provider: HealthProvider, requested: HealthPermissionState): Promise<HealthConnection> {
    const bridge = requireBridge()
    const authorization = await bridge.requestPermissions({ provider, permissions: enabledPermissions(requested) })
    const granted = new Set(authorization.granted)
    const permissions = permissionKeys.reduce((state, key) => ({ ...state, [key]: requested[key] && granted.has(key) }), defaultHealthPermissionsFromFalse())
    if (!supabase) return { provider, status: 'connected', permissions, deviceLabel: '', lastSyncAt: null, lastError: '' }
    const { data, error } = await supabase.from('health_connections').update({ permissions, updated_at: new Date().toISOString() }).eq('user_id', userId).eq('provider', provider).select('provider,status,permissions,device_label,last_sync_at,last_error').single()
    if (error || !data) throw new Error('Não foi possível atualizar as permissões selecionadas.')
    return mapConnection(data)
  },

  async sync(userId: string, connection: HealthConnection): Promise<{ imported: number; updated: number }> {
    const bridge = requireBridge()
    if (!supabase) throw new Error('A sincronização exige uma conta conectada ao MOVELYA.')
    const permissions = enabledPermissions(connection.permissions)
    if (!permissions.length) throw new Error('Ative ao menos uma categoria para sincronizar.')
    const since = connection.lastSyncAt ? new Date(new Date(connection.lastSyncAt).getTime() - 48 * 60 * 60 * 1000).toISOString() : null
    try {
      const response = await bridge.readRecords({ provider: connection.provider, permissions, since })
      const records = response.records.filter((record) => permissions.includes(record.dataType)).map((record) => validateRecord(record))
      const uniqueRecords = deduplicate(records)
      if (uniqueRecords.length) {
        const rows = uniqueRecords.map((record) => ({
          user_id: userId,
          provider: connection.provider,
          data_type: record.dataType,
          external_id: record.externalId,
          started_at: record.startedAt,
          ended_at: record.endedAt,
          value: record.value,
          unit: record.unit,
          source_name: record.sourceName?.slice(0, 160) ?? '',
          source_updated_at: record.sourceUpdatedAt ?? null,
          imported_at: new Date().toISOString(),
        }))
        for (let index = 0; index < rows.length; index += 200) {
          const { error } = await supabase.from('health_sync_records').upsert(rows.slice(index, index + 200), { onConflict: 'user_id,provider,data_type,external_id' })
          if (error) throw error
        }
        if (connection.permissions.weight) await materializeWeight(userId, uniqueRecords)
      }
      const syncedAt = new Date().toISOString()
      const { error } = await supabase.from('health_connections').update({ status: 'connected', last_sync_at: syncedAt, last_error: '', updated_at: syncedAt }).eq('user_id', userId).eq('provider', connection.provider)
      if (error) throw error
      return { imported: uniqueRecords.length, updated: uniqueRecords.length }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha inesperada na sincronização.'
      await supabase.from('health_connections').update({ status: 'error', last_error: message.slice(0, 500), updated_at: new Date().toISOString() }).eq('user_id', userId).eq('provider', connection.provider)
      throw new Error(message)
    }
  },

  async disconnect(userId: string, provider: HealthProvider): Promise<void> {
    const bridge = typeof window === 'undefined' ? undefined : window.MovelyaHealthBridge
    if (bridge) await bridge.disconnect({ provider })
    if (!supabase) return
    const { error } = await supabase.from('health_connections').update({ status: 'disconnected', updated_at: new Date().toISOString() }).eq('user_id', userId).eq('provider', provider)
    if (error) throw new Error('Não foi possível desconectar o serviço.')
  },
}

function requireBridge() {
  if (typeof window === 'undefined' || !window.MovelyaHealthBridge) throw new Error('Abra o MOVELYA no aplicativo nativo para conectar dados de saúde.')
  return window.MovelyaHealthBridge
}

function enabledPermissions(state: HealthPermissionState) { return permissionKeys.filter((key) => state[key]) }
function defaultHealthPermissionsFromFalse(): HealthPermissionState { return { steps: false, distance: false, workout: false, active_calories: false, weight: false } }
function permissionState(granted: HealthPermission[]) { const set = new Set(granted); return permissionKeys.reduce((state, key) => ({ ...state, [key]: set.has(key) }), defaultHealthPermissionsFromFalse()) }

function mapConnection(row: Record<string, unknown>): HealthConnection {
  const raw = row.permissions && typeof row.permissions === 'object' ? row.permissions as Partial<HealthPermissionState> : {}
  return {
    provider: String(row.provider) as HealthProvider,
    status: String(row.status) as HealthConnection['status'],
    permissions: permissionKeys.reduce((state, key) => ({ ...state, [key]: Boolean(raw[key]) }), defaultHealthPermissionsFromFalse()),
    deviceLabel: String(row.device_label ?? ''),
    lastSyncAt: row.last_sync_at ? String(row.last_sync_at) : null,
    lastError: String(row.last_error ?? ''),
  }
}

function validateRecord(record: NativeHealthRecord): NativeHealthRecord {
  if (!permissionKeys.includes(record.dataType)) throw new Error('O aplicativo nativo retornou um tipo de dado inválido.')
  if (!record.externalId || record.externalId.length > 300) throw new Error('Um registro de saúde retornou sem identificador externo válido.')
  const start = new Date(record.startedAt); const end = new Date(record.endedAt)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) throw new Error('Um registro de saúde retornou um período inválido.')
  if (!Number.isFinite(record.value) || record.value < 0) throw new Error('Um registro de saúde retornou um valor inválido.')
  return record
}

function deduplicate(records: NativeHealthRecord[]) {
  const map = new Map<string, NativeHealthRecord>()
  for (const record of records) map.set(`${record.dataType}:${record.externalId}`, record)
  return [...map.values()]
}

async function materializeWeight(userId: string, records: NativeHealthRecord[]) {
  if (!supabase) return
  const latestByDay = new Map<string, NativeHealthRecord>()
  for (const record of records.filter((item) => item.dataType === 'weight')) {
    const day = record.startedAt.slice(0, 10)
    const current = latestByDay.get(day)
    if (!current || record.startedAt > current.startedAt) latestByDay.set(day, record)
  }
  if (!latestByDay.size) return
  const rows = [...latestByDay].map(([measuredAt, record]) => ({ user_id: userId, measured_at: measuredAt, weight: record.value }))
  const { error } = await supabase.from('body_measurements').upsert(rows, { onConflict: 'user_id,measured_at' })
  if (error) throw error
  const latest = rows.sort((a, b) => b.measured_at.localeCompare(a.measured_at))[0]
  await supabase.from('profiles').update({ current_weight: latest.weight, updated_at: new Date().toISOString() }).eq('id', userId)
}

