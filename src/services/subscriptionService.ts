import { supabase } from '../integrations/supabase'

export type PlanCode = 'FREE' | 'PRO' | 'PRO_PLUS'

export interface PlanQuota {
  action_type: string
  monthly_limit: number
  used: number
}

export interface PlanOverview {
  code: PlanCode
  name: string
  description: string
  price_monthly_cents: number
  features: string[]
  renews_at: string
  subscription_status: string
  cancel_at_period_end: boolean
  quotas: PlanQuota[]
}

export interface AvailablePlan {
  code: PlanCode
  name: string
  description: string
  price_monthly_cents: number
  features: string[]
}

export const subscriptionService = {
  async getOverview(): Promise<PlanOverview> {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
    const { data, error } = await supabase.rpc('get_my_plan_overview')
    if (error || !data) throw new Error('Não foi possível carregar seu plano.')
    return data as PlanOverview
  },

  async listPlans(): Promise<AvailablePlan[]> {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
    const { data, error } = await supabase.rpc('list_available_plans')
    if (error) throw new Error('Não foi possível carregar os planos.')
    return (data ?? []) as AvailablePlan[]
  },
}
