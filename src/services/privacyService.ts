import { supabase } from '../integrations/supabase'

export type PrivacyCategory = 'profile' | 'nutrition' | 'workouts' | 'weight' | 'measurements' | 'photos' | 'activities'
export type PrivacyPermissions = Record<PrivacyCategory, boolean>
export type ConsentType = 'privacy_policy' | 'terms_of_use' | 'ai_data_processing' | 'health_integration'

export const defaultPrivacyPermissions: PrivacyPermissions = {
  profile: false, nutrition: false, workouts: false, weight: false, measurements: false, photos: false, activities: false,
}

export interface ConsentRecord { id: string; type: ConsentType; version: string; granted: boolean; grantedAt: string; revokedAt: string | null }
export interface AuditLog { id: string; action: string; metadata: Record<string, unknown>; createdAt: string }

export const privacyService = {
  async load(userId: string) {
    requireClient()
    const [permissions, consents, audits] = await Promise.all([
      supabase!.from('ai_data_permissions').select('profile,nutrition,workouts,weight,measurements,photos,activities').eq('user_id', userId).maybeSingle(),
      supabase!.from('privacy_consent_history').select('id,consent_type,version,granted,granted_at,revoked_at').eq('user_id', userId).order('granted_at', { ascending: false }).limit(40),
      supabase!.from('privacy_audit_logs').select('id,action,metadata,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    ])
    const failure = [permissions, consents, audits].find((result) => result.error)
    if (failure?.error) throw new Error('Não foi possível carregar suas preferências de privacidade.')
    return {
      permissions: { ...defaultPrivacyPermissions, ...(permissions.data ?? {}) } as PrivacyPermissions,
      consents: (consents.data ?? []).map(mapConsent),
      audits: (audits.data ?? []).map(mapAudit),
    }
  },

  async savePermissions(userId: string, permissions: PrivacyPermissions) {
    requireClient()
    const { error } = await supabase!.from('ai_data_permissions').upsert({ user_id: userId, ...permissions, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) throw new Error('Não foi possível salvar os controles de acesso da IA.')
    await this.log('ai_permissions_updated', { categories: Object.keys(permissions).filter((key) => permissions[key as PrivacyCategory]) })
  },

  async saveConsent(userId: string, type: ConsentType, granted: boolean) {
    requireClient()
    const { error } = await supabase!.from('privacy_consent_history').insert({ user_id: userId, consent_type: type, version: '1.0', granted, revoked_at: granted ? null : new Date().toISOString() })
    if (error) throw new Error('Não foi possível registrar este consentimento.')
    await this.log(granted ? 'consent_granted' : 'consent_revoked', { consentType: type, version: '1.0' })
  },

  async log(action: string, metadata: Record<string, unknown> = {}) {
    requireClient()
    const { error } = await supabase!.rpc('log_privacy_action', { action_name: action, action_metadata: metadata })
    if (error) throw new Error('Não foi possível registrar a ação de segurança.')
  },

  async deleteAccount() {
    requireClient()
    const { error } = await supabase!.rpc('delete_current_account', { confirmation: 'EXCLUIR MINHA CONTA' })
    if (error) throw new Error('Não foi possível excluir a conta. Nenhum dado foi removido.')
  },

  async exportData(userId: string) {
    requireClient()
    const tables = ['profiles', 'ai_data_permissions', 'privacy_consent_history', 'ai_conversations', 'ai_messages', 'personal_goals', 'goal_progress_logs', 'body_progress_entries', 'progress_photo_sets', 'health_connections', 'health_sync_records', 'workouts', 'workout_sessions', 'step_records', 'water_intake_logs', 'meals']
    const results = await Promise.all(tables.map(async (table) => {
      const result = table === 'profiles'
        ? await supabase!.from(table).select('*').eq('id', userId)
        : await supabase!.from(table).select('*').eq('user_id', userId)
      return [table, result.error ? { unavailable: true } : result.data ?? []] as const
    }))
    const payload = { exportedAt: new Date().toISOString(), userId, note: 'Fotos privadas não são incluídas no arquivo; os caminhos permanecem protegidos pelo bucket privado.', data: Object.fromEntries(results) }
    await this.log('data_exported', { tables: tables.length })
    return payload
  },
}

function requireClient() { if (!supabase) throw new Error('A conexão com o Supabase não está configurada.') }
function mapConsent(row: Record<string, unknown>): ConsentRecord { return { id: String(row.id), type: String(row.consent_type) as ConsentType, version: String(row.version), granted: Boolean(row.granted), grantedAt: String(row.granted_at), revokedAt: row.revoked_at ? String(row.revoked_at) : null } }
function mapAudit(row: Record<string, unknown>): AuditLog { return { id: String(row.id), action: String(row.action), metadata: (row.metadata as Record<string, unknown>) ?? {}, createdAt: String(row.created_at) } }
