import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { AlertTriangle, BookOpenCheck, ChevronRight, Filter, Heart, Library, Pencil, Plus, Search, ShieldCheck } from 'lucide-react'
import { Button, Card, Field, Modal } from '../components/ui'
import { FOOD_CATEGORIES, foodDatabaseService, type FoodInput } from '../services/foodDatabaseService'
import type { FoodCatalogItem } from '../types'
import '../foodDatabase.css'

type Scope = 'all' | 'favorites' | 'mine'
const emptyDraft = (): FoodInput => ({ name: '', brand: '', category: FOOD_CATEGORIES[0], servingQuantity: 100, servingUnit: 'g', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, sugar: 0, informationSource: '' })

export function FoodDatabasePage({ userId }: { userId: string }) {
  const [foods, setFoods] = useState<FoodCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todas')
  const [scope, setScope] = useState<Scope>('all')
  const [selected, setSelected] = useState<FoodCatalogItem | null>(null)
  const [editing, setEditing] = useState<FoodCatalogItem | null>(null)
  const [draft, setDraft] = useState<FoodInput>(emptyDraft())
  const [formOpen, setFormOpen] = useState(false)
  const [reporting, setReporting] = useState<FoodCatalogItem | null>(null)
  const [reportReason, setReportReason] = useState('Informação nutricional incorreta')
  const [suggestion, setSuggestion] = useState('')

  async function load() {
    setLoading(true); setError('')
    try { setFoods(await foodDatabaseService.list(userId)) }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar os alimentos.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [userId])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3000); return () => clearTimeout(timer) }, [toast])

  const filtered = useMemo(() => foods.filter((food) => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    const matchesSearch = !query || `${food.name} ${food.brand ?? ''} ${food.category}`.toLocaleLowerCase('pt-BR').includes(query)
    const matchesCategory = category === 'Todas' || food.category === category
    const matchesScope = scope === 'all' || (scope === 'favorites' ? food.isFavorite : food.ownerId === userId && !food.isPublic)
    return matchesSearch && matchesCategory && matchesScope
  }), [foods, search, category, scope, userId])

  function openCreate() { setEditing(null); setDraft(emptyDraft()); setFormOpen(true) }
  function openEdit(food: FoodCatalogItem) {
    if (food.isPublic || food.ownerId !== userId) return
    setSelected(null); setEditing(food)
    setDraft({ name: food.name, brand: food.brand ?? '', category: food.category, servingQuantity: food.servingQuantity, servingUnit: food.servingUnit, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, fiber: food.fiber, sodium: food.sodium, sugar: food.sugar ?? 0, informationSource: food.informationSource ?? '' })
    setFormOpen(true)
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setError('')
    try {
      if (editing) { await foodDatabaseService.update(userId, editing.id, draft); setToast('Alimento atualizado com sucesso.') }
      else { await foodDatabaseService.create(userId, draft); setToast('Alimento cadastrado com sucesso.') }
      setFormOpen(false); setEditing(null); await load()
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar o alimento.') }
  }

  async function favorite(food: FoodCatalogItem) {
    try { await foodDatabaseService.toggleFavorite(userId, food.id, !food.isFavorite); setFoods((current) => current.map((item) => item.id === food.id ? { ...item, isFavorite: !item.isFavorite } : item)); setSelected((current) => current?.id === food.id ? { ...current, isFavorite: !current.isFavorite } : current) }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Não foi possível favoritar.') }
  }

  async function submitReport(event: FormEvent) {
    event.preventDefault(); if (!reporting) return
    try { await foodDatabaseService.report(userId, { foodId: reporting.id, reason: reportReason, suggestedCorrection: suggestion.trim() }); setReporting(null); setSuggestion(''); setToast('Solicitação enviada para análise.') }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Não foi possível enviar a solicitação.') }
  }

  return <section className="food-db-page">
    <div className="page-heading food-db-hero">
      <div><p>BANCO DE ALIMENTOS</p><h1>Informação para escolhas melhores.</h1><span>Consulte nutrientes, salve favoritos e mantenha seu catálogo pessoal organizado.</span></div>
      <Button onClick={openCreate}><Plus size={17} /> Cadastrar alimento</Button>
    </div>

    {error && <div className="nutrition-alert" role="alert"><AlertTriangle size={17} /> {error}</div>}
    {toast && <div className="nutrition-toast"><BookOpenCheck size={17} /> {toast}</div>}

    <Card className="food-db-toolbar">
      <label className="food-db-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por alimento, marca ou categoria..." /></label>
      <label className="food-db-select"><Filter size={16} /><select value={category} onChange={(event) => setCategory(event.target.value)}><option>Todas</option>{FOOD_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
    </Card>

    <div className="food-db-tabs" role="tablist">
      <button className={scope === 'all' ? 'is-active' : ''} onClick={() => setScope('all')}>Todos <span>{foods.length}</span></button>
      <button className={scope === 'favorites' ? 'is-active' : ''} onClick={() => setScope('favorites')}><Heart size={14} /> Favoritos <span>{foods.filter((food) => food.isFavorite).length}</span></button>
      <button className={scope === 'mine' ? 'is-active' : ''} onClick={() => setScope('mine')}>Meus alimentos <span>{foods.filter((food) => food.ownerId === userId && !food.isPublic).length}</span></button>
    </div>

    <div className="food-db-results-heading"><div><small>CATÁLOGO</small><h2>{filtered.length} alimento{filtered.length === 1 ? '' : 's'} encontrado{filtered.length === 1 ? '' : 's'}</h2></div><span><ShieldCheck size={14} /> Oficiais são protegidos</span></div>

    {loading ? <div className="food-db-grid">{Array.from({ length: 6 }, (_, index) => <div className="nutrition-loading" key={index} />)}</div> : filtered.length ? (
      <div className="food-db-grid">{filtered.map((food) => <FoodCard key={food.id} food={food} onOpen={() => setSelected(food)} onFavorite={() => void favorite(food)} />)}</div>
    ) : <Card className="food-db-empty"><Library size={34} /><h2>Nenhum alimento encontrado</h2><p>Tente outros filtros ou cadastre um alimento no seu catálogo.</p><Button onClick={openCreate}><Plus size={16} /> Cadastrar alimento</Button></Card>}

    {selected && <FoodDetails food={selected} canEdit={!selected.isPublic && selected.ownerId === userId} onClose={() => setSelected(null)} onEdit={() => openEdit(selected)} onFavorite={() => void favorite(selected)} onReport={() => { setReporting(selected); setSelected(null) }} />}
    {formOpen && <FoodForm draft={draft} editing={Boolean(editing)} onChange={setDraft} onClose={() => setFormOpen(false)} onSubmit={save} />}
    {reporting && <Modal title="Sugerir correção" onClose={() => setReporting(null)}><form className="nutrition-modal-form" onSubmit={submitReport}><p className="nutrition-modal-note">A informação oficial não será alterada diretamente. Sua solicitação para <strong>{reporting.name}</strong> será revisada pela equipe.</p><label className="nutrition-select-field"><span>Motivo</span><select value={reportReason} onChange={(event) => setReportReason(event.target.value)}><option>Informação nutricional incorreta</option><option>Porção ou unidade incorreta</option><option>Marca ou categoria incorreta</option><option>Alimento duplicado</option><option>Outro</option></select></label><label className="nutrition-textarea"><span>Qual é a correção sugerida?</span><textarea required minLength={10} value={suggestion} onChange={(event) => setSuggestion(event.target.value)} placeholder="Descreva a informação correta e, se possível, indique a fonte." /></label><div className="nutrition-modal-actions"><Button variant="secondary" type="button" onClick={() => setReporting(null)}>Cancelar</Button><Button type="submit">Enviar para análise</Button></div></form></Modal>}
  </section>
}

function FoodCard({ food, onOpen, onFavorite }: { food: FoodCatalogItem; onOpen: () => void; onFavorite: () => void }) {
  return <Card className="food-db-card"><div className="food-db-card__top"><span className={food.isPublic ? 'is-official' : 'is-personal'}>{food.isPublic ? <><ShieldCheck size={12} /> Oficial</> : 'Meu alimento'}</span><button className={food.isFavorite ? 'is-active' : ''} onClick={onFavorite} aria-label="Favoritar"><Heart size={17} fill={food.isFavorite ? 'currentColor' : 'none'} /></button></div><button className="food-db-card__body" onClick={onOpen}><small>{food.category}</small><h3>{food.name}</h3><p>{food.brand || 'Sem marca'} · {food.servingQuantity} {food.servingUnit}</p><strong>{Math.round(food.calories)} <span>kcal</span></strong><div className="food-db-macros"><span><b>{food.protein}g</b> Proteínas</span><span><b>{food.carbs}g</b> Carboidratos</span><span><b>{food.fat}g</b> Gorduras</span></div><footer>Ver informações completas <ChevronRight size={15} /></footer></button></Card>
}

function FoodDetails({ food, canEdit, onClose, onEdit, onFavorite, onReport }: { food: FoodCatalogItem; canEdit: boolean; onClose: () => void; onEdit: () => void; onFavorite: () => void; onReport: () => void }) {
  const nutrients = [['Calorias', `${food.calories} kcal`], ['Proteínas', `${food.protein} g`], ['Carboidratos', `${food.carbs} g`], ['Gorduras', `${food.fat} g`], ['Fibras', `${food.fiber} g`], ['Sódio', `${food.sodium} mg`], ['Açúcar', `${food.sugar ?? 0} g`]]
  return <Modal title="Informações do alimento" onClose={onClose}><div className="food-details"><div className="food-details__heading"><span className={food.isPublic ? 'is-official' : 'is-personal'}>{food.isPublic ? 'Alimento oficial' : 'Seu alimento'}</span><h2>{food.name}</h2><p>{food.brand || 'Sem marca'} · {food.category}</p><strong>Porção padrão: {food.servingQuantity} {food.servingUnit}</strong></div><div className="food-details__grid">{nutrients.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div><div className="food-details__source"><BookOpenCheck size={18} /><div><small>FONTE DAS INFORMAÇÕES</small><p>{food.informationSource || 'Não informada'}</p></div></div>{food.isPublic && <div className="food-details__notice"><ShieldCheck size={18} /><p>Este alimento faz parte da base oficial e não pode ser alterado diretamente. Encontrou algo incorreto? Envie uma sugestão.</p></div>}<div className="nutrition-modal-actions"><Button variant="secondary" onClick={onFavorite}><Heart size={15} /> {food.isFavorite ? 'Desfavoritar' : 'Favoritar'}</Button>{canEdit ? <Button onClick={onEdit}><Pencil size={15} /> Editar</Button> : <Button variant="secondary" onClick={onReport}><AlertTriangle size={15} /> Sugerir correção</Button>}</div></div></Modal>
}

function FoodForm({ draft, editing, onChange, onClose, onSubmit }: { draft: FoodInput; editing: boolean; onChange: (draft: FoodInput) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  const number = (key: keyof FoodInput) => (event: ChangeEvent<HTMLInputElement>) => onChange({ ...draft, [key]: Number(event.target.value) })
  return <Modal title={editing ? 'Editar alimento' : 'Cadastrar alimento'} onClose={onClose}><form className="nutrition-modal-form" onSubmit={onSubmit}><p className="nutrition-modal-note">Os valores nutricionais devem corresponder à porção padrão informada.</p><div className="nutrition-modal-grid"><Field required label="Nome" value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} /><Field label="Marca" value={draft.brand} onChange={(event) => onChange({ ...draft, brand: event.target.value })} placeholder="Opcional" /><label className="nutrition-select-field"><span>Categoria</span><select required value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value })}>{FOOD_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label><Field required min="0.01" step="0.01" type="number" label="Porção padrão" value={draft.servingQuantity} onChange={number('servingQuantity')} /><Field required label="Unidade" value={draft.servingUnit} onChange={(event) => onChange({ ...draft, servingUnit: event.target.value })} /><Field required min="0" step="0.01" type="number" label="Calorias (kcal)" value={draft.calories} onChange={number('calories')} /><Field required min="0" step="0.01" type="number" label="Proteínas (g)" value={draft.protein} onChange={number('protein')} /><Field required min="0" step="0.01" type="number" label="Carboidratos (g)" value={draft.carbs} onChange={number('carbs')} /><Field required min="0" step="0.01" type="number" label="Gorduras (g)" value={draft.fat} onChange={number('fat')} /><Field required min="0" step="0.01" type="number" label="Fibras (g)" value={draft.fiber} onChange={number('fiber')} /><Field required min="0" step="0.01" type="number" label="Sódio (mg)" value={draft.sodium} onChange={number('sodium')} /><Field required min="0" step="0.01" type="number" label="Açúcar (g)" value={draft.sugar} onChange={number('sugar')} /></div><Field required label="Fonte das informações" value={draft.informationSource} onChange={(event) => onChange({ ...draft, informationSource: event.target.value })} placeholder="Ex.: rótulo do fabricante, TBCA, TACO..." /><div className="nutrition-modal-actions"><Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button><Button type="submit">{editing ? 'Salvar alterações' : 'Cadastrar alimento'}</Button></div></form></Modal>
}
