export type HealthProvider = 'apple_health' | 'health_connect'
export type HealthPermission = 'steps' | 'distance' | 'workout' | 'active_calories' | 'weight'

export interface HealthPermissionState {
  steps: boolean
  distance: boolean
  workout: boolean
  active_calories: boolean
  weight: boolean
}

export interface HealthConnection {
  provider: HealthProvider
  status: 'connected' | 'disconnected' | 'error'
  permissions: HealthPermissionState
  deviceLabel: string
  lastSyncAt: string | null
  lastError: string
}

export interface NativeHealthRecord {
  dataType: HealthPermission
  externalId: string
  startedAt: string
  endedAt: string
  value: number
  unit: 'count' | 'km' | 'kcal' | 'kg' | 'seconds'
  sourceName?: string
  sourceUpdatedAt?: string
}

export interface NativeHealthAvailability {
  available: boolean
  provider: HealthProvider | null
  platform: 'ios' | 'android' | 'web'
  deviceLabel?: string
  reason?: string
}

export interface NativeHealthBridge {
  getAvailability(): Promise<NativeHealthAvailability>
  requestPermissions(input: { provider: HealthProvider; permissions: HealthPermission[] }): Promise<{ granted: HealthPermission[] }>
  readRecords(input: { provider: HealthProvider; permissions: HealthPermission[]; since: string | null }): Promise<{ records: NativeHealthRecord[] }>
  disconnect(input: { provider: HealthProvider }): Promise<void>
}

declare global {
  interface Window {
    MovelyaHealthBridge?: NativeHealthBridge
  }
}

export const defaultHealthPermissions: HealthPermissionState = {
  steps: true,
  distance: true,
  workout: true,
  active_calories: true,
  weight: false,
}

