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

export interface MercadoPagoCheckout { checkoutUrl: string; sessionId: string }
export interface CheckoutStatus { id: string; plan_code: PlanCode; status: string; amount_cents: number; original_amount_cents: number; coupon_code: string | null; trial_ends_at: string | null; last_payment_status: string | null }
export interface PaymentRecord { id:string; status:string; amount_cents:number; currency:string; paid_at:string|null; created_at:string }
export interface CouponPreview { valid: boolean; reason?: string; code?: string; description?: string; original_amount_cents?: number; discounted_amount_cents?: number; discount_cents?: number }
export interface PaymentRecovery { checkout_url: string; plan_code: PlanCode; amount_cents: number; last_payment_status: string; updated_at: string }

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

  async startMercadoPagoCheckout(planCode: Exclude<PlanCode, 'FREE'>, couponCode = ''): Promise<MercadoPagoCheckout> {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
    const { data, error } = await supabase.functions.invoke('create-mercado-pago-subscription', { body: { planCode, couponCode } })
    if (error || !data?.checkoutUrl) throw new Error(data?.error || 'Não foi possível abrir o checkout do Mercado Pago.')
    return { checkoutUrl: String(data.checkoutUrl), sessionId: String(data.sessionId) }
  },

  async getCheckoutStatus(sessionId: string): Promise<CheckoutStatus | null> {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
    const { data, error } = await supabase.rpc('get_my_mercado_pago_checkout', { input_session_id: sessionId })
    if (error) throw new Error('Não foi possível consultar o estado da compra.')
    return data as CheckoutStatus | null
  },
  async paymentHistory(): Promise<PaymentRecord[]> { if(!supabase) throw new Error('A conexão com o Supabase não está configurada.'); const {data,error}=await supabase.from('payment_history').select('id,status,amount_cents,currency,paid_at,created_at').order('created_at',{ascending:false}).limit(6); if(error) throw new Error('Não foi possível carregar as cobranças.'); return (data??[]) as PaymentRecord[] },

  async getPaymentRecovery(): Promise<PaymentRecovery | null> {
    if (!supabase) return null
    const { data, error } = await supabase.rpc('get_my_payment_recovery')
    if (error) throw new Error('Não foi possível verificar a recuperação de pagamento.')
    return data as PaymentRecovery | null
  },

  async previewCoupon(planCode: Exclude<PlanCode, 'FREE'>, couponCode: string): Promise<CouponPreview> {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
    const { data, error } = await supabase.rpc('preview_subscription_coupon', { input_code: couponCode, input_plan_code: planCode })
    if (error || !data) throw new Error('Não foi possível validar o cupom agora.')
    return data as CouponPreview
  },

  async cancelMercadoPagoSubscription(reason: string): Promise<void> {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
    const { data, error } = await supabase.functions.invoke('cancel-mercado-pago-subscription', { body: { reason } })
    if (error || !data?.cancelled) throw new Error(data?.error || 'Não foi possível cancelar a assinatura agora.')
  },
}
