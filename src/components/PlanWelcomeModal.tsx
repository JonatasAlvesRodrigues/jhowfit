import { useEffect, useState } from 'react'
import { Check, Crown, LoaderCircle, Sparkles, Zap } from 'lucide-react'
import { subscriptionService, type AvailablePlan } from '../services/subscriptionService'
import '../plan-welcome-modal.css'

export function PlanWelcomeModal({ onChooseFree, onChoosePaid, mode = 'first-access' }: { onChooseFree: () => void; onChoosePaid: (planCode: Exclude<AvailablePlan['code'], 'FREE'>) => void; mode?: 'first-access' | 'quota-warning' }) {
  const [plans, setPlans] = useState<AvailablePlan[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    void subscriptionService.listPlans().then(setPlans).catch(() => setError('Não foi possível carregar os planos agora. Você pode começar no Free e alterar depois.'))
  }, [])

  return <div className="plan-welcome-modal" role="dialog" aria-modal="true" aria-labelledby="plan-welcome-title">
    <section className="plan-welcome-modal__card">
      <header>
        <span className="plan-welcome-modal__icon"><Sparkles size={22} /></span>
        <div><small>{mode === 'quota-warning' ? 'VOCÊ ESTÁ EVOLUINDO' : 'SEU PRÓXIMO PASSO'}</small><h1 id="plan-welcome-title">{mode === 'quota-warning' ? 'Sua cota Free está quase no limite' : 'Escolha como quer evoluir'}</h1><p>{mode === 'quota-warning' ? 'Você está aproveitando bastante os recursos inteligentes. Escolha o Pro para ter mais espaço para treinos, dietas e acompanhamento.' : 'Comece gratuitamente com o essencial ou escolha mais recursos e personalização para a sua jornada.'}</p></div>
      </header>
      {error && <p className="plan-welcome-modal__error">{error}</p>}
      {!plans.length && !error ? <div className="plan-welcome-modal__loading"><LoaderCircle className="is-spinning" size={22} /> Carregando planos...</div> : <div className="plan-welcome-modal__plans">
        {(plans.length ? plans : [{ code: 'FREE', name: 'Free', description: 'Recursos essenciais para começar.', price_monthly_cents: 0, features: ['Recursos essenciais', 'Cotas mensais reduzidas'] }]).map((plan) => {
          const isFree = plan.code === 'FREE'
          const featured = plan.code === 'PRO'
          return <article key={plan.code} className={featured ? 'is-featured' : ''}>
            {featured && <span className="plan-welcome-modal__popular"><Zap size={12} /> MAIS ESCOLHIDO</span>}
            <div className="plan-welcome-modal__plan-title"><h2>{plan.name}</h2><p>{plan.description}</p></div>
            <strong className="plan-welcome-modal__price">{isFree ? 'Grátis' : `R$ ${(plan.price_monthly_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}<small>{isFree ? '' : '/mês'}</small></strong>
            <ul>{plan.features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul>
            <button type="button" onClick={() => isFree ? onChooseFree() : onChoosePaid(plan.code as Exclude<AvailablePlan['code'], 'FREE'>)}>{isFree ? mode === 'quota-warning' ? 'Continuar no Free' : 'Começar com Free' : <><Crown size={15} /> Escolher {plan.name}</>}</button>
          </article>
        })}
      </div>}
      <p className="plan-welcome-modal__note">Você poderá mudar de plano quando quiser.</p>
    </section>
  </div>
}
