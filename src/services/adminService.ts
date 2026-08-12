import { supabase } from '../integrations/supabase'

export type AppRole = 'user' | 'moderator' | 'admin'
export interface AdminSummary { users: number; active_users: number; suspended_users: number; exercises: number; foods: number; flags_open: number; feature_events_30d: number; audit_events_30d: number }
export interface AdminUser { user_id: string; full_name: string | null; created_at: string; updated_at: string; account_status: 'active' | 'suspended'; role: AppRole }
export interface AdminSubscriptionSummary { active_total: number; monthly_revenue_cents: number; cancelled_30d: number; pending_payments: number; plans: Array<{ code: 'FREE' | 'PRO' | 'PRO_PLUS'; name: string; price_monthly_cents: number; active_subscriptions: number }> }
export interface AdminSubscription { user_id: string; full_name: string | null; plan_code: 'FREE' | 'PRO' | 'PRO_PLUS'; subscription_status: string; current_period_end: string; cancel_at_period_end: boolean; provider: string | null }
export interface AdminPlanLimit { plan_code: 'FREE' | 'PRO' | 'PRO_PLUS'; action_type: string; monthly_limit: number }
export interface AdminCouponSummary { active_coupons: number; redemptions_total: number; discount_total_cents: number; net_revenue_cents: number }
export interface AdminCoupon { code: string; description: string; discount_type: 'percent' | 'fixed_cents'; discount_value: number; applies_to: Array<'PRO' | 'PRO_PLUS'>; first_purchase_only: boolean; max_redemptions: number | null; redemptions_count: number; active: boolean; archived_at: string | null; expires_at: string | null; discount_total_cents: number; net_revenue_cents: number; created_at: string }
export interface AdminAuditEvent { created_at:string; action:string; actor_name:string|null; target_user_id:string|null; metadata:Record<string,unknown> }
export interface AdminInternalAlert { id:string; category:string; severity:'info'|'warning'|'critical'; title:string; details:Record<string,unknown>; status:string; created_at:string }

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
  async subscriptionSummary() {
    const { data, error } = await requireClient().rpc('admin_subscription_summary')
    if (error) throw error
    return data as AdminSubscriptionSummary
  },
  async subscriptions() {
    const { data, error } = await requireClient().rpc('admin_list_subscriptions')
    if (error) throw error
    return (data ?? []) as AdminSubscription[]
  },
  async planLimits() {
    const { data, error } = await requireClient().rpc('admin_list_plan_limits')
    if (error) throw error
    return (data ?? []) as AdminPlanLimit[]
  },
  async couponSummary(days = 0) { const { data, error } = await requireClient().rpc('admin_coupon_summary', { input_days: days }); if (error) throw error; return data as AdminCouponSummary },
  async coupons(days = 0) { const { data, error } = await requireClient().rpc('admin_list_coupons', { input_days: days }); if (error) throw error; return (data ?? []) as AdminCoupon[] },
  async createCoupon(input: { code: string; description: string; discountType: 'percent' | 'fixed_cents'; discountValue: number; appliesTo: Array<'PRO' | 'PRO_PLUS'>; maxRedemptions: number | null }) {
    const { error } = await requireClient().rpc('admin_create_coupon', { input_code: input.code, input_description: input.description, input_discount_type: input.discountType, input_discount_value: input.discountValue, input_applies_to: input.appliesTo, input_max_redemptions: input.maxRedemptions, input_expires_at: null }); if (error) throw error
  },
  async setCouponStatus(code: string, action: 'activate' | 'pause' | 'archive') { const { error } = await requireClient().rpc('admin_set_coupon_status', { input_code: code, input_action: action }); if (error) throw error },
  async auditHistory(days=30, action='') { const {data,error}=await requireClient().rpc('admin_list_audit_history',{input_days:days,input_action:action||null}); if(error)throw error; return (data??[]) as AdminAuditEvent[] },
  async internalAlerts() { const {data,error}=await requireClient().rpc('admin_list_internal_alerts'); if(error)throw error; return (data??[]) as AdminInternalAlert[] },
  async updateSubscriptionPlan(planCode: 'FREE' | 'PRO' | 'PRO_PLUS', priceMonthlyCents: number) {
    const { error } = await requireClient().rpc('admin_update_subscription_plan', { input_plan_code: planCode, input_price_cents: priceMonthlyCents, input_features: null })
    if (error) throw error
  },
  async updatePlanActionLimit(planCode: 'FREE' | 'PRO' | 'PRO_PLUS', actionType: string, monthlyLimit: number) {
    const { error } = await requireClient().rpc('admin_update_plan_action_limit', { input_plan_code: planCode, input_action_type: actionType, input_monthly_limit: monthlyLimit })
    if (error) throw error
  },
  async assignSubscription(userId: string, planCode: 'FREE' | 'PRO' | 'PRO_PLUS', periodDays = 30) {
    const { error } = await requireClient().rpc('admin_assign_subscription', { target_user_id: userId, input_plan_code: planCode, input_period_days: periodDays })
    if (error) throw error
  },
  async setSuspension(userId: string, suspended: boolean) {
    const { error } = await requireClient().rpc('admin_set_user_suspension', { target_user_id: userId, suspended })
    if (error) throw error
  },
  async createBroadcast(title: string, body: string, audience: string) {
    const { error } = await requireClient().rpc('admin_create_broadcast', { input_title: title, input_body: body, input_audience: audience })
    if (error) throw error
  },
  async syncExercises(query = '', limit = 50) {
    const { data, error } = await requireClient().functions.invoke('sync-exercises', { body: { query, limit } })
    if (error) throw new Error('Não foi possível sincronizar a biblioteca agora.')
    if (data?.error) throw new Error(String(data.error))
    return Number(data?.synced ?? 0)
  },
}
