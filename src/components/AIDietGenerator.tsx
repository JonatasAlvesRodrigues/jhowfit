import { useState, type FormEvent } from 'react'
import { Ban, CheckCircle2, Clock3, Coins, CookingPot, Home, LoaderCircle, RefreshCw, Save, ShieldAlert, Sparkles, Utensils } from 'lucide-react'
import { Button, Field, Modal } from './ui'
import { nutritionService, type DietGenerationInput, type GeneratedDietPlan } from '../services/nutritionService'
import '../aiDiet.css'

interface AIDietGeneratorProps { open: boolean; userId: string; onClose: () => void; onCreated: () => void }
type AdjustmentType = NonNullable<DietGenerationInput['adjustment']>['type']

export function AIDietGenerator({ open, userId, onClose, onCreated }: AIDietGeneratorProps) {
  const [preferences, setPreferences] = useState('')
  const [restrictions, setRestrictions] = useState('')
  const [allergies, setAllergies] = useState('')
  const [dislikedFoods, setDislikedFoods] = useState('')
  const [availableIngredients, setAvailableIngredients] = useState('')
  const [budget, setBudget] = useState('')
  const [cookingTime, setCookingTime] = useState('30 minutos')
  const [meals, setMeals] = useState('4')
  const [hasSevereAllergy, setHasSevereAllergy] = useState(false)
  const [hasEatingDisorder, setHasEatingDisorder] = useState(false)
  const [hasOtherRisk, setHasOtherRisk] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState<GeneratedDietPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [adjustment, setAdjustment] = useState<AdjustmentType | null>(null)
  const [adjustmentDetail, setAdjustmentDetail] = useState('')
  const [mealName, setMealName] = useState('')

  if (!open) return null

  function requestBody(extra?: DietGenerationInput['adjustment']): DietGenerationInput {
    return { userId, preferences, restrictions, allergies, dislikedFoods, availableIngredients, budget, cookingTime, mealsPerDay: Number(meals) || 4, hasSevereAllergy, hasEatingDisorder, hasOtherRisk, adjustment: extra, currentPlan: extra ? plan ?? undefined : undefined }
  }

  async function generate(event: FormEvent) {
    event.preventDefault()
    if (hasSevereAllergy || hasEatingDisorder || hasOtherRisk) {
      setError('Por segurança, não geramos um plano automático nesta situação. Procure um nutricionista ou profissional de saúde para receber orientação individualizada.')
      return
    }
    await runGeneration(requestBody())
  }

  async function runGeneration(input: DietGenerationInput) {
    setLoading(true); setError('')
    try { const response = await nutritionService.generateDietWithAI(input); setPlan(response.plan); setSaved(false); setAdjustment(null); setAdjustmentDetail('') }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Não foi possível gerar sugestões agora.') }
    finally { setLoading(false) }
  }

  async function applyAdjustment() {
    if (!adjustment || !plan) return
    const detailsRequired = ['swap', 'ingredients', 'exclude'].includes(adjustment)
    if (detailsRequired && !adjustmentDetail.trim()) { setError('Informe o que deve ser alterado.'); return }
    if (adjustment === 'meal-count') {
      const count = Number(adjustmentDetail)
      if (count < 2 || count > 7) { setError('Escolha entre 2 e 7 refeições.'); return }
      setMeals(String(count))
    }
    await runGeneration(requestBody({ type: adjustment, mealName: mealName || undefined, detail: adjustmentDetail.trim() }))
  }

  async function savePlan() {
    if (!plan) return
    setSaving(true); setError('')
    try { await nutritionService.saveGeneratedDiet(userId, plan); setSaved(true); onCreated() }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar a sugestão.') }
    finally { setSaving(false) }
  }

  return <Modal title={plan ? 'Sugestões alimentares com IA' : 'Criar sugestões com IA'} onClose={onClose}>
    {!plan ? <form className="nutrition-modal-form ai-diet-form" onSubmit={generate}>
      <div className="ai-diet-intro"><span><Sparkles size={21} /></span><div><strong>Refeições pensadas para a sua rotina</strong><p>Objetivo, peso, altura, idade, rotina e treinos vêm do seu perfil. Complete abaixo o contexto desta sugestão.</p></div></div>
      <div className="nutrition-modal-grid"><Field label="Preferências" value={preferences} onChange={(event) => setPreferences(event.target.value)} placeholder="Ex.: comida brasileira, frutas" /><Field label="Restrições alimentares" value={restrictions} onChange={(event) => setRestrictions(event.target.value)} placeholder="Ex.: vegetariana, sem lactose" /><Field label="Alergias" value={allergies} onChange={(event) => setAllergies(event.target.value)} placeholder="Informe todas as alergias" /><Field label="Alimentos de que não gosta" value={dislikedFoods} onChange={(event) => setDislikedFoods(event.target.value)} placeholder="Ex.: peixe, beterraba" /><Field label="Orçamento semanal (R$)" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Ex.: 180" /><label className="nutrition-select-field"><span>Tempo para cozinhar</span><select value={cookingTime} onChange={(event) => setCookingTime(event.target.value)}><option>Até 10 minutos</option><option>20 minutos</option><option>30 minutos</option><option>Até 1 hora</option><option>Preparo no fim de semana</option></select></label><Field label="Número de refeições" type="number" min="2" max="7" value={meals} onChange={(event) => setMeals(event.target.value)} /><Field label="Ingredientes disponíveis em casa" value={availableIngredients} onChange={(event) => setAvailableIngredients(event.target.value)} placeholder="Ex.: arroz, ovos, banana" /></div>
      <div className="ai-risk-screen"><strong>Confirmação de segurança</strong><p>Marque qualquer situação que se aplique.</p><label><input type="checkbox" checked={hasSevereAllergy} onChange={(event) => setHasSevereAllergy(event.target.checked)} /> Alergia alimentar grave ou risco de anafilaxia</label><label><input type="checkbox" checked={hasEatingDisorder} onChange={(event) => setHasEatingDisorder(event.target.checked)} /> Transtorno alimentar atual ou em tratamento</label><label><input type="checkbox" checked={hasOtherRisk} onChange={(event) => setHasOtherRisk(event.target.checked)} /> Outra situação de risco que exige acompanhamento</label></div>
      <div className="ai-diet-safety"><ShieldAlert size={16} /><span>Esta ferramenta sugere opções de refeições — não realiza diagnóstico nem prescrição. Condições de saúde e gravidez identificadas no perfil impedem a geração automática e direcionam para orientação profissional.</span></div>
      {error && <p className="ai-diet-error">{error}</p>}
      <div className="nutrition-modal-actions"><Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? <><LoaderCircle className="is-spinning" size={16} /> Gerando...</> : <><Sparkles size={16} /> Gerar sugestões</>}</Button></div>
    </form> : <div className="nutrition-modal-form ai-diet-result">
      <div className="ai-diet-result__heading"><span><CheckCircle2 size={21} /></span><div><small>SUGESTÕES PERSONALIZADAS</small><h3>{plan.name}</h3><p>{plan.summary}</p></div></div>
      <div className="ai-estimate-notice"><ShieldAlert size={16} /><strong>Valores estimados</strong><span>{plan.estimatesNotice || 'Calorias e macronutrientes são aproximações e podem variar conforme marcas, porções e preparo.'}</span></div>
      <div className="ai-diet-goals"><span>≈ {Math.round(plan.dailyCalories)} kcal/dia</span><span>≈ {Math.round(plan.protein)} g proteína</span><span>≈ R$ {plan.estimatedWeeklyCost}/semana</span></div>
      <div className="ai-diet-meals">{plan.meals.map((meal) => <article key={meal.name}><div><strong>{meal.name}</strong><small>≈ {meal.calories} kcal · P {meal.protein}g · C {meal.carbs ?? 0}g · G {meal.fat ?? 0}g</small></div><ul>{meal.foods.map((food) => <li key={food}>{food}</li>)}</ul><div className="ai-preparation"><CookingPot size={14} /><span><b>Preparo simples:</b> {meal.preparation || meal.notes}</span></div>{meal.notes && <em>{meal.notes}</em>}<div className="ai-diet-alternatives"><small>SUBSTITUIÇÕES</small>{meal.alternatives.map((alternative, index) => <div key={`${meal.name}-${alternative.name}`}><b>{alternative.name}</b><span>{alternative.foods.join(' · ')}</span><em>{alternative.notes}</em></div>)}</div></article>)}</div>
      <div className="ai-adjustments"><div><strong>Ajustar sugestões</strong><p>Peça uma nova versão mantendo o restante do contexto.</p></div><div className="ai-adjustment-grid"><Adjustment icon={RefreshCw} label="Trocar refeição" active={adjustment === 'swap'} onClick={() => setAdjustment('swap')} /><Adjustment icon={Home} label="Usar o que tenho" active={adjustment === 'ingredients'} onClick={() => setAdjustment('ingredients')} /><Adjustment icon={Coins} label="Mais barata" active={adjustment === 'cheaper'} onClick={() => setAdjustment('cheaper')} /><Adjustment icon={Clock3} label="Mais rápida" active={adjustment === 'quick'} onClick={() => setAdjustment('quick')} /><Adjustment icon={Ban} label="Sem alimento" active={adjustment === 'exclude'} onClick={() => setAdjustment('exclude')} /><Adjustment icon={Utensils} label="Nº de refeições" active={adjustment === 'meal-count'} onClick={() => setAdjustment('meal-count')} /></div>{adjustment && <div className="ai-adjustment-form">{adjustment === 'swap' && <label className="nutrition-select-field"><span>Refeição para trocar</span><select value={mealName} onChange={(event) => setMealName(event.target.value)}><option value="">Selecione</option>{plan.meals.map((meal) => <option key={meal.name}>{meal.name}</option>)}</select></label>}<Field label={adjustmentLabel(adjustment)} type={adjustment === 'meal-count' ? 'number' : 'text'} min={adjustment === 'meal-count' ? 2 : undefined} max={adjustment === 'meal-count' ? 7 : undefined} value={adjustmentDetail} onChange={(event) => setAdjustmentDetail(event.target.value)} placeholder={adjustmentPlaceholder(adjustment)} /><Button onClick={() => void applyAdjustment()} disabled={loading}>{loading ? <LoaderCircle className="is-spinning" size={15} /> : <Sparkles size={15} />} Aplicar ajuste</Button></div>}</div>
      <div className="ai-diet-safety"><ShieldAlert size={16} /> {plan.safetyNotice}</div>{error && <p className="ai-diet-error">{error}</p>}
      <div className="nutrition-modal-actions"><Button variant="secondary" onClick={() => setPlan(null)}>Novo contexto</Button><Button onClick={() => void savePlan()} disabled={saving || saved}>{saving ? <><LoaderCircle className="is-spinning" size={16} /> Salvando...</> : saved ? <><CheckCircle2 size={16} /> Sugestão salva</> : <><Save size={16} /> Salvar sugestão</>}</Button></div>
    </div>}
  </Modal>
}

function Adjustment({ icon: Icon, label, active, onClick }: { icon: typeof RefreshCw; label: string; active: boolean; onClick: () => void }) { return <button type="button" className={active ? 'is-active' : ''} onClick={onClick}><Icon size={15} />{label}</button> }
function adjustmentLabel(type: AdjustmentType) { if (type === 'ingredients') return 'Ingredientes disponíveis'; if (type === 'exclude') return 'Alimento a retirar'; if (type === 'meal-count') return 'Novo número de refeições'; if (type === 'swap') return 'Preferência para a nova opção'; return 'Observação adicional (opcional)' }
function adjustmentPlaceholder(type: AdjustmentType) { if (type === 'ingredients') return 'Ex.: ovos, arroz, frango e tomate'; if (type === 'exclude') return 'Ex.: retirar atum'; if (type === 'meal-count') return 'De 2 a 7'; if (type === 'swap') return 'Ex.: quero algo salgado'; return 'Ex.: reduzir ainda mais custo ou preparo' }
