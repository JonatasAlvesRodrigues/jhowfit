import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BadgePercent, CheckCircle2, CircleAlert, CreditCard, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import { subscriptionService, type AvailablePlan, type CheckoutStatus, type PlanCode } from '../services/subscriptionService'
import '../checkout.css'

const paidPlans: PlanCode[] = ['PRO', 'PRO_PLUS']

export function CheckoutPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [plans, setPlans] = useState<AvailablePlan[]>([])
  const [coupon, setCoupon] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const planCode = getHashQuery('plan') as PlanCode
  const plan = useMemo(() => plans.find((item) => item.code === planCode), [plans, planCode])

  useEffect(() => { void subscriptionService.listPlans().then(setPlans).catch(() => setError('Não foi possível carregar os dados do checkout.')) }, [])
  async function continueToPayment() {
    if (!plan || !paidPlans.includes(plan.code)) return
    setBusy(true); setError('')
    try { const checkout = await subscriptionService.startMercadoPagoCheckout(plan.code as Exclude<PlanCode, 'FREE'>, coupon); window.location.assign(checkout.checkoutUrl) }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Não foi possível iniciar o pagamento.') }
    finally { setBusy(false) }
  }
  if (!plan && plans.length) return <section className="checkout-page"><div className="checkout-state"><CircleAlert /><h1>Plano não encontrado</h1><button onClick={() => onNavigate('/planos')}>Voltar aos planos</button></div></section>
  return <section className="checkout-page">
    <button className="checkout-back" onClick={() => onNavigate('/planos')}><ArrowLeft size={16} /> Voltar aos planos</button>
    <div className="checkout-layout">
      <div className="checkout-main"><span className="page-eyebrow">CHECKOUT SEGURO</span><h1>Quase lá. Vamos cuidar do seu ritmo.</h1><p>Você será redirecionado ao Mercado Pago para concluir a assinatura. Seus dados de pagamento não passam pelo MOVELYA.</p>
        <div className="checkout-steps"><span className="is-active">1. Revisar</span><i /><span>2. Pagamento seguro</span><i /><span>3. Confirmação</span></div>
        <label className="coupon-field"><span><BadgePercent size={16} /> Cupom de desconto</span><div><input value={coupon} onChange={(event) => setCoupon(event.target.value.toUpperCase())} maxLength={32} placeholder="Ex.: BEMVINDO10" /><small>Aplicado e validado com segurança no próximo passo.</small></div></label>
        {error && <p className="checkout-error" role="alert">{error}</p>}
      </div>
      <aside className="checkout-summary"><span>RESUMO DA ASSINATURA</span>{plan ? <><h2>MOVELYA {plan.name}</h2><p>{plan.description}</p><div className="checkout-price"><small>Cobrança mensal</small><strong>{formatPrice(plan.price_monthly_cents)}<em>/mês</em></strong></div><ul><li><CheckCircle2 size={16} /> Cobrança mensal recorrente</li><li><CheckCircle2 size={16} /> Cancele quando quiser</li><li><ShieldCheck size={16} /> Confirmação pelo servidor</li></ul><button onClick={() => void continueToPayment()} disabled={busy}>{busy ? <><LoaderCircle className="is-spinning" size={17} /> Preparando...</> : <><CreditCard size={17} /> Continuar para pagamento</>}</button><small className="checkout-provider">Pagamento protegido pelo Mercado Pago</small></> : <LoaderCircle className="is-spinning" />}</aside>
    </div>
  </section>
}

export function CheckoutConfirmationPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [checkout, setCheckout] = useState<CheckoutStatus | null>(null)
  const [error, setError] = useState('')
  const sessionId = getHashQuery('session_id')
  const load = () => { if (!sessionId) { setError('Não encontramos a referência desta compra.'); return } void subscriptionService.getCheckoutStatus(sessionId).then((value) => { setCheckout(value); if (!value) setError('Esta compra não pertence à sua conta.') }).catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Não foi possível confirmar a compra.')) }
  useEffect(load, [sessionId])
  const rejected = checkout?.last_payment_status === 'rejected' || checkout?.last_payment_status === 'failed'
  const confirmed = checkout?.status === 'authorized'
  return <section className="checkout-page"><div className="checkout-result">
    {confirmed ? <CheckCircle2 className="checkout-result__icon success" /> : rejected ? <CircleAlert className="checkout-result__icon danger" /> : <LoaderCircle className="checkout-result__icon is-spinning" />}
    <span className="page-eyebrow">{confirmed ? 'ASSINATURA CONFIRMADA' : rejected ? 'PAGAMENTO NÃO APROVADO' : 'CONFIRMANDO PAGAMENTO'}</span>
    <h1>{confirmed ? 'Tudo certo. Seu plano já está ativo.' : rejected ? 'Não foi possível concluir o pagamento.' : 'Estamos validando sua assinatura.'}</h1>
    <p>{confirmed ? 'Seu acesso foi atualizado com segurança. Aproveite os novos recursos do MOVELYA.' : rejected ? 'Seu cartão ou meio de pagamento não foi aprovado. Você pode tentar novamente com outro meio no Mercado Pago.' : 'O Mercado Pago pode levar alguns instantes para enviar a confirmação. Não é necessário pagar novamente.'}</p>
    {checkout?.coupon_code && <div className="checkout-result__trial"><BadgePercent size={16} /> Cupom {checkout.coupon_code} aplicado ao primeiro ciclo.</div>}
    {error && <p className="checkout-error">{error}</p>}
    <div className="checkout-result__actions">{!confirmed && <button className="secondary" onClick={load}><RefreshCw size={16} /> Atualizar status</button>}<button onClick={() => onNavigate(rejected ? `/checkout?plan=${checkout?.plan_code || 'PRO'}` : '/planos')}>{rejected ? 'Tentar novamente' : 'Ir para meus planos'}</button></div>
  </div></section>
}

function getHashQuery(name: string) { const query = window.location.hash.split('?')[1] || ''; return new URLSearchParams(query).get(name) || '' }
function formatPrice(cents: number) { return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` }
