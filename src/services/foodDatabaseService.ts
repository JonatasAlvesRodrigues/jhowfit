import { supabase } from '../integrations/supabase'
import type { FoodCatalogItem } from '../types'

export const FOOD_CATEGORIES = [
  'Arroz e massas', 'Carnes', 'Frutas', 'Verduras', 'Bebidas', 'Laticínios',
  'Pães', 'Doces', 'Industrializados', 'Receitas',
] as const

export interface FoodInput {
  name: string
  brand: string
  category: string
  servingQuantity: number
  servingUnit: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
  sugar: number
  informationSource: string
}

export interface FoodCorrectionInput {
  foodId: string
  reason: string
  suggestedCorrection: string
}

let localFoods: FoodCatalogItem[] = [
  item('f1', 'Arroz integral cozido', '', 'Arroz e massas', 100, 'g', 124, 2.6, 25.8, 1, 2.7, 1, 0.2, 'TBCA – Tabela Brasileira de Composição de Alimentos'),
  item('f2', 'Peito de frango grelhado', 'Sistema', 'Carnes', 100, 'g', 159, 32, 0, 2.5, 0, 50, 0, 'TBCA – Tabela Brasileira de Composição de Alimentos'),
  item('f3', 'Banana-prata', '', 'Frutas', 1, 'unidade média', 86, 1.3, 22, 0.1, 2, 0, 12.4, 'TACO – NEPA/UNICAMP'),
  item('f4', 'Brócolis cozido', '', 'Verduras', 100, 'g', 25, 2.1, 4.4, 0.5, 3.4, 2, 1.4, 'TACO – NEPA/UNICAMP'),
  item('f5', 'Leite integral', 'Sistema', 'Laticínios', 200, 'ml', 122, 6.4, 9.2, 6.6, 0, 126, 9.2, 'Rótulo do fabricante'),
  item('f6', 'Pão integral', 'Sistema', 'Pães', 2, 'fatias', 132, 7, 24, 2.2, 3, 230, 3.2, 'Rótulo do fabricante'),
]

export const foodDatabaseService = {
  async list(userId: string): Promise<FoodCatalogItem[]> {
    if (!supabase) return localFoods
    const [foods, favorites] = await Promise.all([
      supabase.from('meal_food_catalog').select('*').or(`is_public.eq.true,user_id.eq.${userId}`).order('name'),
      supabase.from('meal_favorites').select('food_id').eq('user_id', userId),
    ])
    if (foods.error) throw new Error('Não foi possível carregar o banco de alimentos.')
    const favoriteIds = new Set((favorites.data ?? []).map((row) => String(row.food_id)))
    return (foods.data ?? []).map((row) => mapFood(row, favoriteIds.has(String(row.id))))
  },

  async create(userId: string, input: FoodInput) {
    if (!supabase) {
      const created = { ...input, id: `local-${Date.now()}`, isPublic: false, isFavorite: false, sourceType: 'custom' as const, ownerId: userId }
      localFoods = [created, ...localFoods]
      return created
    }
    const { data, error } = await supabase.from('meal_food_catalog').insert(toRow(userId, input)).select('*').single()
    if (error) throw new Error('Não foi possível cadastrar o alimento.')
    return mapFood(data, false)
  },

  async update(userId: string, foodId: string, input: FoodInput) {
    if (!supabase) {
      const target = localFoods.find((food) => food.id === foodId)
      if (!target || target.isPublic || target.ownerId !== userId) throw new Error('Somente alimentos criados por você podem ser editados.')
      localFoods = localFoods.map((food) => food.id === foodId ? { ...food, ...input } : food)
      return
    }
    const { error } = await supabase.from('meal_food_catalog').update({ ...toRow(userId, input), updated_at: new Date().toISOString() }).eq('id', foodId).eq('user_id', userId).eq('is_public', false)
    if (error) throw new Error('Não foi possível atualizar o alimento.')
  },

  async toggleFavorite(userId: string, foodId: string, favorite: boolean) {
    if (!supabase) {
      localFoods = localFoods.map((food) => food.id === foodId ? { ...food, isFavorite: favorite } : food)
      return
    }
    const query = favorite
      ? supabase.from('meal_favorites').upsert({ user_id: userId, food_id: foodId })
      : supabase.from('meal_favorites').delete().eq('user_id', userId).eq('food_id', foodId)
    const { error } = await query
    if (error) throw new Error('Não foi possível atualizar os favoritos.')
  },

  async report(userId: string, input: FoodCorrectionInput) {
    if (!supabase) return
    const { error } = await supabase.from('food_correction_reports').insert({ user_id: userId, food_id: input.foodId, reason: input.reason, suggested_correction: input.suggestedCorrection })
    if (error) throw new Error('Não foi possível enviar a solicitação de correção.')
  },
}

function toRow(userId: string, input: FoodInput) {
  return { user_id: userId, name: input.name, brand: input.brand, category: input.category, serving_quantity: input.servingQuantity, serving_unit: input.servingUnit, calories: input.calories, protein: input.protein, carbs: input.carbs, fat: input.fat, fiber: input.fiber, sodium: input.sodium, sugar: input.sugar, information_source: input.informationSource, source_type: 'custom', is_public: false }
}

function mapFood(row: Record<string, unknown>, favorite: boolean): FoodCatalogItem {
  return { id: String(row.id), name: String(row.name), brand: String(row.brand ?? ''), category: String(row.category), servingQuantity: Number(row.serving_quantity), servingUnit: String(row.serving_unit), calories: Number(row.calories), protein: Number(row.protein), carbs: Number(row.carbs), fat: Number(row.fat), fiber: Number(row.fiber), sodium: Number(row.sodium), sugar: Number(row.sugar ?? 0), informationSource: String(row.information_source ?? 'Não informada'), isPublic: Boolean(row.is_public), isFavorite: favorite, sourceType: Boolean(row.is_public) ? 'public' : 'custom', ownerId: row.user_id ? String(row.user_id) : null }
}

function item(id: string, name: string, brand: string, category: string, servingQuantity: number, servingUnit: string, calories: number, protein: number, carbs: number, fat: number, fiber: number, sodium: number, sugar: number, informationSource: string): FoodCatalogItem {
  return { id, name, brand, category, servingQuantity, servingUnit, calories, protein, carbs, fat, fiber, sodium, sugar, informationSource, isPublic: true, isFavorite: false, sourceType: 'public', ownerId: null }
}
