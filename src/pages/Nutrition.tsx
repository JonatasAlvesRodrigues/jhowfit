import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  BarChart3,
  Barcode,
  BookHeart,
  CalendarClock,
  Check,
  ChevronRight,
  Copy,
  CreditCard,
  Drumstick,
  Flame,
  Heart,
  History,
  ListPlus,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { Button, Card, Field, Modal, Progress } from '../components/ui'
import type {
  FoodCatalogItem,
  Meal,
  MealCombinationItem,
  MealSection,
  MealSourceType,
} from '../types'
import { nutritionService, type DiarySection, type NutritionDiaryData } from '../services/nutritionService'

const mealSections: MealSection[] = [
  'Café da manhã',
  'Lanche da manhã',
  'Almoço',
  'Lanche da tarde',
  'Jantar',
  'Ceia',
  'Outras refeições',
]

const foodTabs: Array<{ id: FoodViewMode; label: string; icon: typeof Search }> = [
  { id: 'search', label: 'Pesquisa', icon: Search },
  { id: 'favorites', label: 'Favoritos', icon: Heart },
  { id: 'recent', label: 'Recentes', icon: History },
  { id: 'custom', label: 'Personalizados', icon: BookHeart },
]

type FoodViewMode = 'search' | 'favorites' | 'recent' | 'custom'

interface NutritionPageProps {
  userId: string
  onNavigate: (path: string) => void
}

interface EntryDraft {
  mealSection: MealSection
  name: string
  quantity: string
  unit: string
  calories: string
  protein: string
  carbs: string
  fat: string
  fiber: string
  sodium: string
  time: string
  notes: string
  sourceType: MealSourceType
  foodCatalogId: string | null
}

interface CustomFoodDraft {
  name: string
  category: string
  quantity: string
  unit: string
  calories: string
  protein: string
  carbs: string
  fat: string
  fiber: string
  sodium: string
}

export function NutritionPage({ userId, onNavigate }: NutritionPageProps) {
  const [data, setData] = useState<NutritionDiaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<FoodViewMode>('search')
  const [selectedSection, setSelectedSection] = useState<MealSection>('Almoço')
  const [entryDraft, setEntryDraft] = useState<EntryDraft>(emptyEntryDraft('Almoço'))
  const [editingMealId, setEditingMealId] = useState<string | null>(null)
  const [selectedFood, setSelectedFood] = useState<FoodCatalogItem | null>(null)
  const [customDraft, setCustomDraft] = useState<CustomFoodDraft>(emptyCustomDraft())
  const [customOpen, setCustomOpen] = useState(false)
  const [copySection, setCopySection] = useState<MealSection | null>(null)
  const [copyTargetSection, setCopyTargetSection] = useState<MealSection>('Almoço')
  const [repeatSection, setRepeatSection] = useState<MealSection | null>(null)
  const [comboSection, setComboSection] = useState<MealSection | null>(null)
  const [comboName, setComboName] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    void loadDiary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(timer)
  }, [toast])

  async function loadDiary() {
    setLoading(true)
    setError('')
    try {
      const next = await nutritionService.getDiary(userId)
      setData(next)
      setSelectedSection((current) => next.sections.some((section) => section.section === current) ? current : 'Almoço')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar o diário alimentar.')
    } finally {
      setLoading(false)
    }
  }

  const filteredFoods = useMemo(() => {
    const source = view === 'search'
      ? data?.foods.all ?? []
      : view === 'favorites'
        ? data?.foods.favorites ?? []
        : view === 'recent'
          ? data?.foods.recent ?? []
          : data?.foods.custom ?? []

    return source.filter((food) => {
      const haystack = `${food.name} ${food.category}`.toLowerCase()
      return haystack.includes(search.toLowerCase())
    })
  }, [data, search, view])

  const summary = data?.summary
  const sections = data?.sections ?? buildEmptySections()
  const currentSection = sections.find((section) => section.section === selectedSection) ?? sections[0]
  const previousSections = data?.previousDaySections ?? []
  const history = data?.history ?? []

  async function handleSaveEntry(event: FormEvent) {
    event.preventDefault()
    try {
      const payload = parseEntryDraft(entryDraft)
      if (editingMealId) {
        await nutritionService.updateMealEntry(userId, editingMealId, payload)
        setToast('Alimento atualizado.')
      } else {
        await nutritionService.addMealEntry(userId, payload)
        setToast('Alimento adicionado ao diário.')
      }
      setSelectedFood(null)
      setEditingMealId(null)
      setEntryDraft(emptyEntryDraft(payload.mealSection))
      await loadDiary()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar o alimento.')
    }
  }

  async function handleDeleteMeal(meal: Meal) {
    try {
      await nutritionService.removeMealEntry(userId, meal.id, meal.date)
      setToast(`${meal.name} removido.`)
      await loadDiary()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível remover o alimento.')
    }
  }

  async function handleToggleFavorite(food: FoodCatalogItem) {
    try {
      await nutritionService.toggleFavoriteFood(userId, food.id, !food.isFavorite)
      setToast(food.isFavorite ? 'Removido dos favoritos.' : 'Adicionado aos favoritos.')
      await loadDiary()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível atualizar os favoritos.')
    }
  }

  async function handleSaveCustomFood(event: FormEvent) {
    event.preventDefault()
    try {
      const payload = {
        name: customDraft.name.trim(),
        category: customDraft.category.trim() || 'Personalizado',
        quantity: Number(customDraft.quantity || 1),
        unit: customDraft.unit.trim() || 'porção',
        calories: Number(customDraft.calories || 0),
        protein: Number(customDraft.protein || 0),
        carbs: Number(customDraft.carbs || 0),
        fat: Number(customDraft.fat || 0),
        fiber: Number(customDraft.fiber || 0),
        sodium: Number(customDraft.sodium || 0),
        sourceType: 'custom' as const,
      }
      const created = await nutritionService.createCustomFood(userId, payload)
      if (created) {
        setView('custom')
        setSearch(created.name)
        setToast('Alimento personalizado salvo.')
        await loadDiary()
      }
      setCustomDraft(emptyCustomDraft())
      setCustomOpen(false)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar o alimento personalizado.')
    }
  }

  async function handleSaveCombination(event: FormEvent) {
    event.preventDefault()
    if (!currentSection) return
    try {
      const items = currentSection.meals.map((meal): MealCombinationItem => ({
        name: meal.name,
        quantity: meal.quantity ?? 1,
        unit: meal.unit ?? 'porção',
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        fiber: meal.fiber,
        sodium: meal.sodium,
      }))
      await nutritionService.saveCombination(userId, {
        name: comboName.trim() || `Combinação · ${currentSection.section}`,
        items,
      })
      setComboSection(null)
      setToast('Combinação salva como favorita.')
      await loadDiary()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar a combinação.')
    }
  }

  async function handleCopySection() {
    if (!copySection) return
    try {
      await nutritionService.copyMealSection(userId, data?.date ?? today(), copySection, copyTargetSection)
      setCopySection(null)
      setToast(`Refeição copiada para ${copySection.toLowerCase()}.`)
      await loadDiary()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível copiar a refeição.')
    }
  }

  async function handleRepeatSection(section: MealSection) {
    try {
      await nutritionService.repeatMealFromDate(userId, previousDate(data?.date ?? today()), section)
      setRepeatSection(null)
      setToast(`Refeição de ${section.toLowerCase()} repetida.`)
      await loadDiary()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível repetir a refeição.')
    }
  }

  function openFood(food: FoodCatalogItem, section = selectedSection) {
    setEditingMealId(null)
    setSelectedFood(food)
    setEntryDraft({
      mealSection: section,
      name: food.name,
      quantity: String(food.servingQuantity),
      unit: food.servingUnit,
      calories: String(food.calories),
      protein: String(food.protein),
      carbs: String(food.carbs),
      fat: String(food.fat),
      fiber: String(food.fiber),
      sodium: String(food.sodium),
      time: currentTime(),
      notes: '',
      sourceType: food.sourceType,
      foodCatalogId: food.id,
    })
  }

  function openMeal(meal: Meal) {
    setSelectedFood(null)
    setEditingMealId(meal.id)
    setSelectedSection(meal.mealSection ?? 'Almoço')
    setEntryDraft({
      mealSection: meal.mealSection ?? 'Almoço',
      name: meal.name,
      quantity: String(meal.quantity ?? 1),
      unit: meal.unit ?? 'porção',
      calories: String(meal.calories),
      protein: String(meal.protein),
      carbs: String(meal.carbs),
      fat: String(meal.fat),
      fiber: String(meal.fiber),
      sodium: String(meal.sodium),
      time: meal.time ?? currentTime(),
      notes: meal.notes ?? '',
      sourceType: meal.sourceType ?? 'recent',
      foodCatalogId: meal.foodCatalogId ?? null,
    })
  }

  if (loading) return <DiaryLoading />

  return (
    <section className="nutrition-page">
      <div className="page-heading nutrition-hero">
        <div>
          <p>DIÁRIO ALIMENTAR</p>
          <h1>Alimente seu progresso.</h1>
          <span>Busque, favorite, reutilize e personalize suas refeições em um fluxo rápido.</span>
        </div>
        <div className="nutrition-hero__actions">
          <Button variant="secondary" onClick={() => onNavigate('/inicio')}><ArrowRight size={17} /> Ver início</Button>
          <Button onClick={() => { setCustomDraft(emptyCustomDraft()); setCustomOpen(true) }}><Plus size={17} /> Novo alimento</Button>
        </div>
      </div>

      {error && <div className="nutrition-alert" role="alert"><ShieldAlert size={17} /> {error}</div>}
      {toast && <div className="nutrition-toast"><Check size={16} /> {toast}</div>}

      <div className="nutrition-summary-grid">
        <Card className="nutrition-summary-card nutrition-summary-card--progress">
          <div className="nutrition-summary-card__heading">
            <div>
              <small>CALORIAS</small>
              <h2>{Math.round(summary?.calories ?? 0)} <span>/ {Math.round(summary?.caloriesGoal ?? 2200)} kcal</span></h2>
            </div>
            <span className="nutrition-pill"><Flame size={15} /> Meta diária</span>
          </div>
          <div className="nutrition-ring">
            <strong>{summary?.completion ?? 0}%</strong>
            <small>concluído</small>
          </div>
          <Progress value={summary?.completion ?? 0} />
          <p>Foco do dia: mantenha a alimentação alinhada com sua rotina e sua meta.</p>
        </Card>

        <MacroCard label="Proteína" value={summary?.protein ?? 0} goal={summary?.goals.protein ?? 0} unit="g" color="green" />
        <MacroCard label="Carboidratos" value={summary?.carbs ?? 0} goal={summary?.goals.carbs ?? 0} unit="g" color="orange" />
        <MacroCard label="Gorduras" value={summary?.fat ?? 0} goal={summary?.goals.fat ?? 0} unit="g" color="blue" />
        <MacroCard label="Fibras" value={summary?.fiber ?? 0} goal={summary?.goals.fiber ?? 0} unit="g" color="green" />
      </div>

      <div className="nutrition-layout">
        <div className="nutrition-main-column">
          <Card className="nutrition-toolbar">
            <div className="nutrition-toolbar__search">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Pesquisar alimentos, categorias ou favoritos"
              />
              <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca"><X size={15} /></button>
            </div>
            <div className="nutrition-toolbar__actions">
              {foodTabs.map(({ id, label, icon: Icon }) => (
                <button key={id} className={view === id ? 'is-active' : ''} onClick={() => setView(id)}>
                  <Icon size={15} /> {label}
                </button>
              ))}
              <button className="is-disabled" disabled title="Leitura de código de barras em breve">
                <Barcode size={15} /> Código de barras
              </button>
            </div>
          </Card>

          <div className="nutrition-sections">
            {sections.map((section) => (
              <MealSectionCard
                key={section.section}
                section={section}
                onAdd={(food) => openFood(food, section.section)}
                onEdit={openMeal}
                onDelete={handleDeleteMeal}
                onCopy={() => { setCopySection(section.section); setCopyTargetSection(section.section) }}
                onSaveCombo={() => {
                  setComboSection(section.section)
                  setComboName(`Combinação · ${section.section}`)
                }}
                onRepeat={() => setRepeatSection(section.section)}
              />
            ))}
          </div>
        </div>

        <div className="nutrition-side-column">
          <Card className="nutrition-panel">
            <div className="nutrition-panel__heading">
              <div>
                <small>ALIMENTOS</small>
                <h3>{viewLabel(view)}</h3>
              </div>
              <button onClick={() => { setCustomDraft(emptyCustomDraft()); setCustomOpen(true) }}>
                <ListPlus size={15} /> Criar alimento
              </button>
            </div>
            <div className="nutrition-food-grid">
              {filteredFoods.map((food) => (
                <FoodCard key={food.id} food={food} onAdd={() => openFood(food)} onFavorite={() => handleToggleFavorite(food)} />
              ))}
              {!filteredFoods.length && (
                <div className="nutrition-empty">
                  <span><UtensilsCrossed size={22} /></span>
                  <strong>Nenhum alimento encontrado</strong>
                  <p>Teste outro termo de busca ou troque a categoria selecionada.</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="nutrition-panel">
            <div className="nutrition-panel__heading">
              <div>
                <small>GRÁFICO</small>
                <h3>Calorias da semana</h3>
              </div>
              <span className="nutrition-mini-tag"><BarChart3 size={14} /> Ajuste visual</span>
            </div>
            <div className="nutrition-chart">
              {history.map((point) => (
                <div key={point.label} className="nutrition-chart__bar">
                  <span style={{ height: `${Math.max(Math.min(point.value / 25, 100), 12)}%` }} />
                  <small>{point.label}</small>
                  <strong>{Math.round(point.value)}</strong>
                </div>
              ))}
            </div>
          </Card>

          <Card className="nutrition-panel">
            <div className="nutrition-panel__heading">
              <div>
                <small>REPETIÇÕES</small>
                <h3>Refeições recentes</h3>
              </div>
              <button onClick={() => setRepeatSection('Almoço')}>
                <RotateCcw size={15} /> Repetir
              </button>
            </div>
            <div className="nutrition-repeat-list">
              {previousSections.map((section) => (
                <button key={section.section} onClick={() => setRepeatSection(section.section)}>
                  <span>{section.section}</span>
                  <b>{section.meals.length} itens</b>
                  <ChevronRight size={14} />
                </button>
              ))}
              {!previousSections.length && <p className="nutrition-muted">Nenhuma refeição anterior disponível para repetir.</p>}
            </div>
          </Card>
        </div>
      </div>

      <Card className="nutrition-footer-card">
        <div>
          <small>ATALHOS</small>
          <h3>Fluxos rápidos para o dia a dia</h3>
          <p>Adicione alimentos, crie itens personalizados e salve combinações para repetir depois.</p>
        </div>
        <div className="nutrition-footer-card__actions">
          <Button variant="secondary" onClick={() => { setCustomDraft(emptyCustomDraft()); setCustomOpen(true) }}><CreditCard size={17} /> Personalizado</Button>
          <Button variant="secondary" onClick={() => setComboSection(currentSection.section)}><Copy size={17} /> Salvar combinação</Button>
          <Button onClick={() => onNavigate('/relatorios')}><Sparkles size={17} /> Ver análise</Button>
        </div>
      </Card>

      <div className="nutrition-notice">
        <ShieldAlert size={18} />
        <p>O diário alimentar organiza seus registros, mas não substitui acompanhamento médico, nutricional ou profissional.</p>
      </div>

      {selectedFood && (
        <Modal title={editingMealId ? 'Editar alimento' : 'Adicionar alimento'} onClose={() => { setSelectedFood(null); setEditingMealId(null) }}>
          <form className="nutrition-modal-form" onSubmit={handleSaveEntry}>
            <div className="nutrition-modal-form__top">
              <span><Drumstick size={18} /></span>
              <div>
                <strong>{selectedFood.name}</strong>
                <small>{selectedFood.category} · {selectedFood.servingQuantity} {selectedFood.servingUnit}</small>
              </div>
            </div>
            <div className="nutrition-modal-grid">
              <label><span>Refeição</span><select value={entryDraft.mealSection} onChange={(event) => setEntryDraft((current) => ({ ...current, mealSection: event.target.value as MealSection }))}>{mealSections.map((section) => <option key={section} value={section}>{section}</option>)}</select></label>
              <Field label="Quantidade" type="number" min="0.01" step="0.01" value={entryDraft.quantity} onChange={(event) => setEntryDraft((current) => ({ ...current, quantity: event.target.value }))} />
              <label><span>Unidade</span><input value={entryDraft.unit} onChange={(event) => setEntryDraft((current) => ({ ...current, unit: event.target.value }))} /></label>
              <Field label="Horário" type="time" value={entryDraft.time} onChange={(event) => setEntryDraft((current) => ({ ...current, time: event.target.value }))} />
              <Field label="Calorias" type="number" min="0" step="1" value={entryDraft.calories} onChange={(event) => setEntryDraft((current) => ({ ...current, calories: event.target.value }))} />
              <Field label="Proteínas" type="number" min="0" step="0.1" value={entryDraft.protein} onChange={(event) => setEntryDraft((current) => ({ ...current, protein: event.target.value }))} />
              <Field label="Carboidratos" type="number" min="0" step="0.1" value={entryDraft.carbs} onChange={(event) => setEntryDraft((current) => ({ ...current, carbs: event.target.value }))} />
              <Field label="Gorduras" type="number" min="0" step="0.1" value={entryDraft.fat} onChange={(event) => setEntryDraft((current) => ({ ...current, fat: event.target.value }))} />
              <Field label="Fibras" type="number" min="0" step="0.1" value={entryDraft.fiber} onChange={(event) => setEntryDraft((current) => ({ ...current, fiber: event.target.value }))} />
              <Field label="Sódio" type="number" min="0" step="0.1" value={entryDraft.sodium} onChange={(event) => setEntryDraft((current) => ({ ...current, sodium: event.target.value }))} />
            </div>
            <label className="nutrition-textarea">
              <span>Observações</span>
              <textarea value={entryDraft.notes} onChange={(event) => setEntryDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Ex.: sem açúcar, grelhado, porção menor..." />
            </label>
            <div className="nutrition-modal-actions">
              <Button variant="secondary" type="button" onClick={() => { setSelectedFood(null); setEditingMealId(null) }}>
                Cancelar
              </Button>
              <Button type="submit">{editingMealId ? 'Salvar alterações' : 'Adicionar alimento'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {comboSection && (
        <Modal title="Salvar combinação favorita" onClose={() => setComboSection(null)}>
          <form className="nutrition-modal-form" onSubmit={handleSaveCombination}>
            <p className="nutrition-modal-note">A combinação será salva para reutilizar depois, sem envio automático de dados adicionais.</p>
            <Field label="Nome da combinação" value={comboName} onChange={(event) => setComboName(event.target.value)} placeholder="Ex.: Café rápido" />
            <div className="nutrition-modal-preview">
              {(currentSection?.meals ?? []).map((meal) => (
                <div key={meal.id}>
                  <strong>{meal.name}</strong>
                  <small>{meal.quantity ?? 1} {meal.unit ?? 'porção'}</small>
                </div>
              ))}
            </div>
            <div className="nutrition-modal-actions">
              <Button variant="secondary" type="button" onClick={() => setComboSection(null)}>Cancelar</Button>
              <Button type="submit">Salvar combinação</Button>
            </div>
          </form>
        </Modal>
      )}

      {copySection && (
        <Modal title="Copiar refeição" onClose={() => setCopySection(null)}>
          <div className="nutrition-modal-form">
            <p className="nutrition-modal-note">Escolha uma refeição para copiar para o dia atual.</p>
            <label className="nutrition-select-field">
              <span>Refeição de destino</span>
              <select value={copyTargetSection} onChange={(event) => setCopyTargetSection(event.target.value as MealSection)}>
                {mealSections.map((section) => <option key={section} value={section}>{section}</option>)}
              </select>
            </label>
            <div className="nutrition-modal-actions">
              <Button variant="secondary" type="button" onClick={() => setCopySection(null)}>Cancelar</Button>
              <Button type="button" onClick={() => void handleCopySection()}>Copiar agora</Button>
            </div>
          </div>
        </Modal>
      )}

      {repeatSection && (
        <Modal title="Repetir refeição de outro dia" onClose={() => setRepeatSection(null)}>
          <div className="nutrition-modal-form">
            <p className="nutrition-modal-note">Toque em uma refeição anterior para repetir o conteúdo no dia atual.</p>
            <div className="nutrition-repeat-modal-list">
              {previousSections.map((section) => (
                <button key={section.section} onClick={() => void handleRepeatSection(section.section)}>
                  <div>
                    <strong>{section.section}</strong>
                    <small>{section.meals.length} alimentos · {Math.round(section.calories)} kcal</small>
                  </div>
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
            <div className="nutrition-modal-actions">
              <Button variant="secondary" type="button" onClick={() => setRepeatSection(null)}>Fechar</Button>
            </div>
          </div>
        </Modal>
      )}

      <CustomFoodModal
        open={customOpen}
        draft={customDraft}
        onClose={() => setCustomOpen(false)}
        onChange={setCustomDraft}
        onSubmit={handleSaveCustomFood}
      />
    </section>
  )
}

function MealSectionCard({
  section,
  onAdd,
  onEdit,
  onDelete,
  onCopy,
  onSaveCombo,
  onRepeat,
}: {
  section: DiarySection
  onAdd: (food: FoodCatalogItem) => void
  onEdit: (meal: Meal) => void
  onDelete: (meal: Meal) => void
  onCopy: () => void
  onSaveCombo: () => void
  onRepeat: () => void
}) {
  return (
    <Card className="nutrition-section-card">
      <div className="nutrition-section-card__heading">
        <div>
          <small>{section.section.toUpperCase()}</small>
          <h3>{section.meals.length ? `${section.meals.length} alimento(s)` : 'Nenhum item registrado'}</h3>
        </div>
        <div className="nutrition-section-card__actions">
          <button type="button" onClick={onCopy}><Copy size={14} /> Copiar refeição</button>
          <button type="button" onClick={onRepeat}><RotateCcw size={14} /> Repetir do dia anterior</button>
          <button type="button" onClick={onSaveCombo}><Heart size={14} /> Salvar combinação</button>
        </div>
      </div>
      <div className="nutrition-section-card__progress">
        <Progress value={Math.min((section.calories / 800) * 100, 100)} />
        <small>{Math.round(section.calories)} kcal · {Math.round(section.protein)} g proteína · {Math.round(section.carbs)} g carboidratos</small>
      </div>
      <div className="nutrition-meal-list">
        {section.meals.map((meal) => (
          <article key={meal.id} className="nutrition-meal-row">
            <div className="nutrition-meal-row__meta">
              <span>{meal.time ?? '—'}</span>
              <strong>{meal.name}</strong>
              <p>{meal.quantity ?? 1} {meal.unit ?? 'porção'} · {meal.sourceType === 'custom' ? 'Personalizado' : meal.sourceType === 'favorite' ? 'Favorito' : 'Baseado em catálogo'}</p>
            </div>
            <div className="nutrition-meal-row__stats">
              <b>{Math.round(meal.calories)} <small>kcal</small></b>
              <small>P {Math.round(meal.protein)} · C {Math.round(meal.carbs)} · G {Math.round(meal.fat)}</small>
            </div>
            <div className="nutrition-meal-row__actions">
              <button onClick={() => onEdit(meal)} aria-label={`Editar ${meal.name}`}><Pencil size={15} /></button>
              <button onClick={() => onDelete(meal)} aria-label={`Remover ${meal.name}`}><Trash2 size={15} /></button>
            </div>
          </article>
        ))}
      </div>
      {!section.meals.length && (
        <button type="button" className="nutrition-section-card__empty" onClick={() => onAdd(fallbackFoodForSection(section.section))}>
          <Plus size={16} /> Adicionar alimento nesta refeição
        </button>
      )}
    </Card>
  )
}

function FoodCard({
  food,
  onAdd,
  onFavorite,
}: {
  food: FoodCatalogItem
  onAdd: () => void
  onFavorite: () => void
}) {
  return (
    <button type="button" className="nutrition-food-card" onClick={onAdd}>
      <div className="nutrition-food-card__top">
        <span>{food.category}</span>
        <button type="button" className={food.isFavorite ? 'is-active' : ''} onClick={(event) => { event.stopPropagation(); onFavorite() }}>
          <Heart size={14} />
        </button>
      </div>
      <strong>{food.name}</strong>
      <small>{food.servingQuantity} {food.servingUnit} · {Math.round(food.calories)} kcal</small>
      <div className="nutrition-food-card__macros">
        <span>P {Math.round(food.protein)}</span>
        <span>C {Math.round(food.carbs)}</span>
        <span>G {Math.round(food.fat)}</span>
      </div>
      <div className="nutrition-food-card__footer">
        <span>{food.sourceType === 'custom' ? 'Personalizado' : food.sourceType === 'favorite' ? 'Favorito' : 'Catálogo'}</span>
        <ChevronRight size={15} />
      </div>
    </button>
  )
}

function MacroCard({
  label,
  value,
  goal,
  unit,
  color,
}: {
  label: string
  value: number
  goal: number
  unit: string
  color: 'green' | 'orange' | 'blue'
}) {
  const progress = goal > 0 ? Math.min((value / goal) * 100, 100) : 0
  return (
    <Card className={`nutrition-macro-card nutrition-macro-card--${color}`}>
      <small>{label}</small>
      <strong>{Math.round(value)}<span>/{Math.round(goal)} {unit}</span></strong>
      <Progress value={progress} color={color} />
      <p>{progress >= 100 ? 'Meta atingida' : `${Math.max(Math.round(goal - value), 0)} ${unit} restantes`}</p>
    </Card>
  )
}

function CustomFoodModal({
  open,
  draft,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean
  draft: CustomFoodDraft
  onChange: (draft: CustomFoodDraft) => void
  onClose: () => void
  onSubmit: (event: FormEvent) => void
}) {
  if (!open) return null

  return (
    <Modal title="Criar alimento personalizado" onClose={onClose}>
      <form className="nutrition-modal-form" onSubmit={onSubmit}>
        <div className="nutrition-modal-form__top">
          <span><ListPlus size={18} /></span>
          <div>
            <strong>Novo alimento</strong>
            <small>Salve uma base reutilizável para o seu diário.</small>
          </div>
        </div>
        <div className="nutrition-modal-grid">
          <Field label="Nome" value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} />
          <Field label="Categoria" value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value })} />
          <Field label="Quantidade" type="number" step="0.01" min="0.01" value={draft.quantity} onChange={(event) => onChange({ ...draft, quantity: event.target.value })} />
          <Field label="Unidade" value={draft.unit} onChange={(event) => onChange({ ...draft, unit: event.target.value })} />
          <Field label="Calorias" type="number" step="1" min="0" value={draft.calories} onChange={(event) => onChange({ ...draft, calories: event.target.value })} />
          <Field label="Proteínas" type="number" step="0.1" min="0" value={draft.protein} onChange={(event) => onChange({ ...draft, protein: event.target.value })} />
          <Field label="Carboidratos" type="number" step="0.1" min="0" value={draft.carbs} onChange={(event) => onChange({ ...draft, carbs: event.target.value })} />
          <Field label="Gorduras" type="number" step="0.1" min="0" value={draft.fat} onChange={(event) => onChange({ ...draft, fat: event.target.value })} />
          <Field label="Fibras" type="number" step="0.1" min="0" value={draft.fiber} onChange={(event) => onChange({ ...draft, fiber: event.target.value })} />
          <Field label="Sódio" type="number" step="0.1" min="0" value={draft.sodium} onChange={(event) => onChange({ ...draft, sodium: event.target.value })} />
        </div>
        <div className="nutrition-modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Salvar alimento</Button>
        </div>
      </form>
    </Modal>
  )
}

function DiaryLoading() {
  return (
    <section className="nutrition-page">
      <div className="nutrition-loading nutrition-loading--hero" />
      <div className="nutrition-summary-grid">
        {Array.from({ length: 5 }, (_, index) => <div className="nutrition-loading" key={index} />)}
      </div>
      <div className="nutrition-layout">
        <div className="nutrition-main-column">
          <div className="nutrition-loading nutrition-loading--toolbar" />
          <div className="nutrition-loading nutrition-loading--section" />
          <div className="nutrition-loading nutrition-loading--section" />
        </div>
        <div className="nutrition-side-column">
          <div className="nutrition-loading nutrition-loading--panel" />
          <div className="nutrition-loading nutrition-loading--panel" />
          <div className="nutrition-loading nutrition-loading--panel" />
        </div>
      </div>
    </section>
  )
}

function emptyEntryDraft(section: MealSection): EntryDraft {
  return {
    mealSection: section,
    name: '',
    quantity: '1',
    unit: 'porção',
    calories: '0',
    protein: '0',
    carbs: '0',
    fat: '0',
    fiber: '0',
    sodium: '0',
    time: currentTime(),
    notes: '',
    sourceType: 'search',
    foodCatalogId: null,
  }
}

function emptyCustomDraft(): CustomFoodDraft {
  return {
    name: '',
    category: 'Personalizado',
    quantity: '1',
    unit: 'porção',
    calories: '0',
    protein: '0',
    carbs: '0',
    fat: '0',
    fiber: '0',
    sodium: '0',
  }
}

function parseEntryDraft(draft: EntryDraft) {
  return {
    mealSection: draft.mealSection,
    name: draft.name.trim(),
    quantity: Number(draft.quantity || 1),
    unit: draft.unit.trim() || 'porção',
    calories: Number(draft.calories || 0),
    protein: Number(draft.protein || 0),
    carbs: Number(draft.carbs || 0),
    fat: Number(draft.fat || 0),
    fiber: Number(draft.fiber || 0),
    sodium: Number(draft.sodium || 0),
    time: draft.time,
    notes: draft.notes.trim(),
    sourceType: draft.sourceType,
    foodCatalogId: draft.foodCatalogId,
    date: today(),
  }
}

function buildEmptySections(): DiarySection[] {
  return mealSections.map((section) => ({
    section,
    meals: [],
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  }))
}

function currentTime() {
  return new Date().toTimeString().slice(0, 5)
}

function today() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function previousDate(date: string) {
  const next = new Date(`${date}T12:00:00`)
  next.setDate(next.getDate() - 1)
  return next.toISOString().slice(0, 10)
}

function viewLabel(view: FoodViewMode) {
  if (view === 'search') return 'Busca e catálogo'
  if (view === 'favorites') return 'Favoritos do usuário'
  if (view === 'recent') return 'Refeições recentes'
  return 'Alimentos personalizados'
}

function fallbackFoodForSection(section: MealSection): FoodCatalogItem {
  const bySection: Record<MealSection, string> = {
    'Café da manhã': 'Aveia em flocos',
    'Lanche da manhã': 'Banana',
    'Almoço': 'Peito de frango grelhado',
    'Lanche da tarde': 'Iogurte natural',
    'Jantar': 'Arroz integral cozido',
    'Ceia': 'Iogurte natural',
    'Outras refeições': 'Banana',
  }
  return {
    id: `fallback-${section}`,
    name: bySection[section],
    category: 'Sugestão',
    servingQuantity: 1,
    servingUnit: 'porção',
    calories: 100,
    protein: 5,
    carbs: 12,
    fat: 3,
    fiber: 2,
    sodium: 60,
    isPublic: true,
    isFavorite: false,
    sourceType: 'search',
  }
}
