import { useState, type FormEvent } from 'react'
import { BrainCircuit, CheckCircle2, LoaderCircle, ShieldAlert, Sparkles } from 'lucide-react'
import { Button, Field, Modal } from './ui'
import { nutritionService, type GeneratedDietPlan } from '../services/nutritionService'

interface AIDietGeneratorProps {
  open: boolean
  userId: string
  onClose: () => void
  onCreated: () => void
}

export function AIDietGenerator({ open, userId, onClose, onCreated }: AIDietGeneratorProps) {
  const [preferences, setPreferences] = useState('')
  const [avoids, setAvoids] = useState('')
  const [budget, setBudget] = useState('')
  const [meals, setMeals] = useState('4')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState<GeneratedDietPlan | null>(null)

  if (!open) return null

  async function generate(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await nutritionService.generateDietWithAI({
        userId,
        preferences,
        avoids,
        budget,
        mealsPerDay: Number(meals) || 4,
      })
      setPlan(response.plan)
      onCreated()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível gerar a dieta agora.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={plan ? 'Sua dieta sugerida' : 'Criar dieta com IA'} onClose={onClose}>
      {!plan ? (
        <form className="nutrition-modal-form ai-diet-form" onSubmit={generate}>
          <div className="ai-diet-intro"><span><BrainCircuit size={21} /></span><div><strong>Plano alimentar adaptado a você</strong><p>A IA considera suas preferências, alimentos evitados e limite de gastos. Revise a sugestão antes de usar.</p></div></div>
          <Field label="O que você gosta ou prefere comer" value={preferences} onChange={(event) => setPreferences(event.target.value)} placeholder="Ex.: frango, arroz, frutas, comida simples" />
          <Field label="O que não consome ou quer evitar" value={avoids} onChange={(event) => setAvoids(event.target.value)} placeholder="Ex.: lactose, peixe, amendoim, carne vermelha" />
          <div className="nutrition-modal-grid">
            <Field label="Quanto pode gastar por semana (R$)" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Ex.: 180" />
            <Field label="Refeições por dia" type="number" min="2" max="7" value={meals} onChange={(event) => setMeals(event.target.value)} />
          </div>
          <div className="ai-diet-safety"><ShieldAlert size={16} /> A sugestão não substitui nutricionista, especialmente em caso de alergias, condições de saúde ou gestação.</div>
          {error && <p className="ai-diet-error">{error}</p>}
          <div className="nutrition-modal-actions"><Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? <><LoaderCircle className="is-spinning" size={16} /> Criando...</> : <><Sparkles size={16} /> Gerar sugestão</>}</Button></div>
        </form>
      ) : (
        <div className="nutrition-modal-form ai-diet-result">
          <div className="ai-diet-result__heading"><span><CheckCircle2 size={21} /></span><div><small>REVISÃO OBRIGATÓRIA</small><h3>{plan.name}</h3><p>{plan.summary}</p></div></div>
          <div className="ai-diet-goals"><span>{Math.round(plan.dailyCalories)} kcal/dia</span><span>{Math.round(plan.protein)} g proteína</span><span>~R$ {plan.estimatedWeeklyCost}/semana</span></div>
          <div className="ai-diet-meals">{plan.meals.map((meal) => <article key={meal.name}><div><strong>{meal.name}</strong><small>{meal.calories} kcal · P {meal.protein}g</small></div><p>{meal.foods.join(' · ')}</p><em>{meal.notes}</em></article>)}</div>
          <div className="ai-diet-safety"><ShieldAlert size={16} /> {plan.safetyNotice}</div>
          <div className="nutrition-modal-actions"><Button variant="secondary" onClick={() => setPlan(null)}>Ajustar preferências</Button><Button onClick={onClose}>Entendi, revisar depois</Button></div>
        </div>
      )}
    </Modal>
  )
}
