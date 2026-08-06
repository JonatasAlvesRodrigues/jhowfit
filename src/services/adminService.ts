import { supabase } from '../integrations/supabase'

export type AppRole = 'user' | 'moderator' | 'admin'
export interface AdminSummary { users: number; active_users: number; suspended_users: number; exercises: number; foods: number; flags_open: number; feature_events_30d: number; audit_events_30d: number }
export interface AdminUser { user_id: string; full_name: string | null; created_at: string; updated_at: string; account_status: 'active' | 'suspended'; role: AppRole }

function requireClient() { if (!supabase) throw new Error('Supabase não configurado.') ; return supabase }

export const adminService = {
  async getRole(userId: string): Promise<AppRole> {
    const client = requireClient()
    const { data, error } = await client.from('app_roles').select('role').eq('user_id', userId).maybeSingle()
    if (error) return 'user'
    return (data?.role as AppRole) ?? 'user'
  },
  async summary() {
    const { data, error } = await requireClient().rpc('admin_dashboard_summary')
    if (error) throw error
    return data as AdminSummary
  },
  async users() {
    const { data, error } = await requireClient().rpc('admin_list_users')
    if (error) throw error
    return (data ?? []) as AdminUser[]
  },
  async setSuspension(userId: string, suspended: boolean) {
    const { error } = await requireClient().rpc('admin_set_user_suspension', { target_user_id: userId, suspended })
    if (error) throw error
  },
  async createBroadcast(title: string, body: string, audience: string) {
    const { error } = await requireClient().rpc('admin_create_broadcast', { input_title: title, input_body: body, input_audience: audience })
    if (error) throw error
  },
}
