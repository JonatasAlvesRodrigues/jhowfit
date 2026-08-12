import { useEffect, useState } from 'react'
import { CalendarDays, Check, Crown, LoaderCircle, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { subscriptionService, type AvailablePlan, type PlanOverview } from '../services/subscriptionService'
import '../plans.css'

const quotaLabels: Record<string, string> = {
  chat_message: 'Mensagens com o assistente',
  workout_adjustment: 'Ajustes de treino',
  workout_generation: 'Treinos personalizados',
  food_photo_analysis: 'Análises de refeição por foto',
  diet_generation: 'Sugestões alimentares completas',
  smart_report: 'Relatórios inteligentes',
  full_replanning: 'Replanejamentos completos',
}

export function PlansPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [overview, setOverview] = useState<PlanOverview | null>(null)
  const [plans, setPlans] = useState<AvailablePlan[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyPlan, setBusyPlan] = useState<AvailablePlan['code'] | 'cancel' | null>(null)

  useEffect(() => {
    Promise.all([subscriptionService.getOverview(), subscriptionService.listPlans()])
      .then(([current, available]) => { setOverview(current); setPlans(available) })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar os planos.'))
  }, [])

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('checkout') === 'mercado-pago') setNotice('Recebemos seu retorno do Mercado Pago. A confirmação do pagamento pode levar alguns instantes; atualize esta página em breve.')
  }, [])

  function startCheckout(planCode: Exclude<AvailablePlan['code'], 'FREE'>) { onNavigate(`/checkout?plan=${planCode}`) }

  async function cancelSubscription() {
    if (!window.confirm('Deseja cancelar sua assinatura do Mercado Pago?')) return
    setNotice(''); setBusyPlan('cancel')
    try { await subscriptionService.cancelMercadoPagoSubscription(); setNotice('Assinatura cancelada. Seus recursos pagos permanecerão disponíveis até o fim do ciclo confirmado.'); window.setTimeout(() => window.location.reload(), 900) }
    catch (cancelError) { setNotice(cancelError instanceof Error ? cancelError.message : 'Não foi possível cancelar a assinatura.') }
    finally { setBusyPlan(null) }
  }

  if (error) return <section className="plans-page"><div className="plan-state"><ShieldCheck /><h1>Seu plano continua protegido</h1><p>{error}</p><button onClick={() => window.location.reload()}>Tentar novamente</button></div></section>
  if (!overview) return <section className="plans-page"><div className="plan-state"><LoaderCircle className="is-spinning" /><p>Preparando os detalhes do seu plano...</p></div></section>

  return <section className="plans-page">
    <header className="plans-hero">
      <div><span className="page-eyebrow">ASSINATURA MOVELYA</span><h1>Seu ritmo, seu plano</h1><p>Escolha o nível de acompanhamento que combina com sua rotina. Seus recursos essenciais continuam disponíveis no Free.</p></div>
      <div className="plans-hero__icon"><Crown /></div>
    </header>

    <article className="current-plan-card">
      <div className="current-plan-card__main"><span><Sparkles size={17} /> PLANO ATUAL</span><h2>{overview.name}</h2><p>{overview.description}</p></div>
      <div className="current-plan-card__renewal"><CalendarDays size={18} /><div><small>PRÓXIMA RENOVAÇÃO</small><strong>{formatDate(overview.renews_at)}</strong></div></div>
    </article>
    {overview.code !== 'FREE' && <div className="plans-manage"><span>{overview.cancel_at_period_end ? 'Sua assinatura está marcada para cancelamento.' : 'Assinatura recorrente gerenciada pelo Mercado Pago.'}</span>{!overview.cancel_at_period_end && <button onClick={() => void cancelSubscription()} disabled={busyPlan === 'cancel'}>{busyPlan === 'cancel' ? 'Cancelando...' : 'Cancelar assinatura'}</button>}</div>}
    {notice && <p className="plans-notice" role="status">{notice}</p>}

    <section className="plan-usage-panel">
      <div className="plan-section-heading"><div><span>USO NESTE MÊS</span><h2>Seus recursos inteligentes</h2></div><p>As cotas são renovadas automaticamente a cada ciclo.</p></div>
      <div className="plan-quota-grid">{overview.quotas.map((quota) => {
        const percentage = Math.min(100, Math.round((quota.used / quota.monthly_limit) * 100))
        return <article key={quota.action_type} className={percentage >= 100 ? 'is-exhausted' : ''}>
          <div><strong>{quotaLabels[quota.action_type] ?? quota.action_type}</strong><span>{quota.used} de {quota.monthly_limit}</span></div>
          <div className="plan-quota-track" aria-label={`${percentage}% utilizado`}><i style={{ width: `${percentage}%` }} /></div>
          <small>{percentage >= 100 ? 'Cota mensal utilizada' : `${quota.monthly_limit - quota.used} disponíveis neste ciclo`}</small>
        </article>
      })}</div>
    </section>

    <section className="plan-comparison">
      <div className="plan-section-heading"><div><span>PLANOS</span><h2>Mais possibilidades para evoluir</h2></div></div>
      <div className="plan-cards">{plans.map((plan) => {
        const current = plan.code === overview.code
        const featured = plan.code === 'PRO'
        return <article key={plan.code} className={`${featured ? 'is-featured' : ''} ${current ? 'is-current' : ''}`}>
          {featured && <span className="plan-popular"><Zap size={13} /> MAIS ESCOLHIDO</span>}
          <div className="plan-card__title"><h3>{plan.name}</h3><p>{plan.description}</p></div>
          <div className="plan-price">{plan.price_monthly_cents === 0 ? <strong>Grátis</strong> : <><small>R$</small><strong>{formatPrice(plan.price_monthly_cents)}</strong><span>/mês</span></>}</div>
          <ul>{plan.features.map((feature) => <li key={feature}><Check size={16} />{feature}</li>)}</ul>
          <button disabled={current || plan.code === 'FREE' || busyPlan === plan.code} onClick={() => plan.code !== 'FREE' && startCheckout(plan.code)}>{current ? 'Seu plano atual' : plan.code === 'FREE' ? 'Plano gratuito' : 'Assinar com Mercado Pago'}</button>
        </article>
      })}</div>
      <p className="plans-payment-note"><ShieldCheck size={16} /> Pagamentos recorrentes processados com segurança pelo Mercado Pago. A confirmação do plano é feita pelo servidor.</p>
    </section>
  </section>
}

function formatPrice(cents: number) { return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }
function formatDate(value: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value)) }
