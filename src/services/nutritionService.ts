import { supabase } from '../integrations/supabase'
import type {
  ChartPoint,
  FoodCatalogItem,
  Meal,
  MealCombination,
  MealCombinationItem,
  MealSection,
  MealSourceType,
  NutritionTotals,
} from '../types'

export interface DiarySection {
  section: MealSection
  meals: Meal[]
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export interface NutritionDiaryData {
  date: string
  summary: NutritionSummary
  sections: DiarySection[]
  foods: {
    all: FoodCatalogItem[]
    favorites: FoodCatalogItem[]
    recent: FoodCatalogItem[]
    custom: FoodCatalogItem[]
  }
  combinations: MealCombination[]
  history: ChartPoint[]
  previousDaySections: DiarySection[]
  hasEntries: boolean
  hasCatalog: boolean
}

export interface NutritionSummary extends NutritionTotals {
  goals: NutritionTotals
  caloriesGoal: number
  completion: number
}

export interface MealEntryInput {
  mealSection: MealSection
  name: string
  quantity: number
  unit: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
  time?: string
  notes?: string
  sourceType: MealSourceType
  foodCatalogId?: string | null
  date?: string
}

export interface CustomFoodInput extends Omit<MealEntryInput, 'mealSection' | 'time' | 'notes' | 'sourceType' | 'foodCatalogId' | 'date'> {
  category: string
  sourceType?: MealSourceType
}

export interface ComboInput {
  name: string
  items: MealCombinationItem[]
}

export interface GeneratedDietPlan {
  name: string
  summary: string
  dailyCalories: number
  protein: number
  estimatedWeeklyCost: number
  meals: Array<{ name: string; foods: string[]; calories: number; protein: number; notes: string; alternatives: Array<{ name: string; foods: string[]; notes: string }> }>
  safetyNotice: string
}

const mealSections: MealSection[] = [
  'Café da manhã',
  'Lanche da manhã',
  'Almoço',
  'Lanche da tarde',
  'Jantar',
  'Ceia',
  'Outras refeições',
]

const fallbackFoods: FoodCatalogItem[] = [
  food('1', 'Aveia em flocos', 'Cereais', 40, 'g', 155, 5.4, 27, 3, 4, 2, true, false, 'public'),
  food('2', 'Banana', 'Frutas', 1, 'unidade média', 105, 1.3, 27, 0.4, 3.1, 1, true, false, 'public'),
  food('3', 'Peito de frango grelhado', 'Proteínas', 100, 'g', 165, 31, 0, 3.6, 0, 74, true, false, 'public'),
  food('4', 'Arroz integral cozido', 'Base', 100, 'g', 123, 2.6, 25.8, 1, 1.8, 5, true, false, 'public'),
  food('5', 'Iogurte natural', 'Laticínios', 170, 'g', 98, 5.3, 7, 5, 0, 59, true, false, 'public'),
]

const fallbackMeals: Meal[] = [
  meal('meal-1', 'Café da manhã', '07:30', 'Café da manhã', 'Café da manhã', 2, 'porção', 420, 26, 42, 14, 7, 620, 'search'),
  meal('meal-2', 'Almoço', '12:50', 'Almoço', 'Almoço', 1, 'prato', 610, 45, 58, 20, 8, 780, 'recent'),
  meal('meal-3', 'Lanche da tarde', '16:20', 'Lanche da tarde', 'Lanche da tarde', 1, 'refeição', 210, 24, 18, 6, 3, 260, 'favorite'),
]

const fallbackCombinations: MealCombination[] = [
  {
    id: 'combo-1',
    name: 'Café equilibrado',
    items: [
      { name: 'Aveia em flocos', quantity: 40, unit: 'g', calories: 155, protein: 5.4, carbs: 27, fat: 3, fiber: 4, sodium: 2 },
      { name: 'Banana', quantity: 1, unit: 'unidade', calories: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3.1, sodium: 1 },
    ],
    createdAt: new Date().toISOString(),
  },
]

const fallbackHistory: ChartPoint[] = [
  { label: 'Seg', value: 1820 },
  { label: 'Ter', value: 1980 },
  { label: 'Qua', value: 1640 },
  { label: 'Qui', value: 2100 },
  { label: 'Sex', value: 1740 },
  { label: 'Sáb', value: 2250 },
  { label: 'Dom', value: 1890 },
]

export const nutritionService = {
  async generateDietWithAI(input: { userId: string; preferences: string; avoids: string; budget: string; mealsPerDay: number }) {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
    const { data, error } = await supabase.functions.invoke('generate-diet-plan', {
      body: {
        preferences: input.preferences,
        avoids: input.avoids,
        budget: input.budget,
        mealsPerDay: input.mealsPerDay,
      },
    })
    if (error) {
      const context = (error as { context?: Response }).context
      const response = context ? await context.clone().json().catch(() => null) : null
      throw new Error(response?.error || 'Não foi possível acessar o gerador de dieta.')
    }
    if (!data?.plan) throw new Error(data?.error || 'A IA não retornou uma dieta válida.')
    return data as { plan: GeneratedDietPlan }
  },
  async saveGeneratedDiet(userId: string, plan: GeneratedDietPlan) {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')
    const { error } = await supabase.from('diet_plans').insert({
      user_id: userId,
      name: plan.name,
      plan,
      source: 'ai',
      updated_at: nowIso(),
    })
    if (error) throw new Error('Não foi possível salvar sua dieta.')
  },
  async getDiary(userId: string, date = localDate()): Promise<NutritionDiaryData> {
    if (!supabase) {
      return buildFallbackDiary(date)
    }

    const [mealsResult, foodsResult, favoritesResult, combosResult, historyResult, statsResult, previousResult] = await Promise.all([
      supabase
        .from('meals')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .order('time'),
      supabase
        .from('meal_food_catalog')
        .select('*')
        .or(`is_public.eq.true,user_id.eq.${userId}`)
        .order('name'),
      supabase
        .from('meal_favorites')
        .select('food_id')
        .eq('user_id', userId),
      supabase
        .from('meal_combinations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('meals')
        .select('date,calories')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(7),
      supabase
        .from('daily_stats')
        .select('calories_current,calories_goal,protein_current,protein_goal,carbs_current,carbs_goal,fat_current,fat_goal,fiber_current,fiber_goal')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle(),
      supabase
        .from('meals')
        .select('*')
        .eq('user_id', userId)
        .eq('date', previousDate(date))
        .order('time'),
    ])

    const meals = mapMeals(mealsResult.data ?? [])
    const foods = mapFoods(foodsResult.data ?? [], favoritesResult.data ?? [])
    const combinations = mapCombinations(combosResult.data ?? [])
    const previousDaySections = mapSections(mapMeals(previousResult.data ?? []))
    const history = aggregateHistory(historyResult.data ?? [])
    const summary = buildSummary(meals, statsResult.data)

    return {
      date,
      summary,
      sections: mapSections(meals),
      foods,
      combinations,
      history,
      previousDaySections,
      hasEntries: meals.length > 0,
      hasCatalog: foods.all.length > 0,
    }
  },

  async addMealEntry(userId: string, input: MealEntryInput) {
    return upsertMealEntry(userId, input)
  },

  async updateMealEntry(userId: string, mealId: string, input: MealEntryInput) {
    if (!supabase) {
      return null
    }
    const { error } = await supabase.from('meals').update({
      meal_section: input.mealSection,
      name: input.name,
      quantity: input.quantity,
      unit: input.unit,
      calories: input.calories,
      protein: input.protein,
      carbs: input.carbs,
      fat: input.fat,
      fiber: input.fiber,
      sodium: input.sodium,
      time: input.time ?? currentTime(),
      notes: input.notes ?? '',
      source_type: input.sourceType,
      food_catalog_id: input.foodCatalogId ?? null,
      updated_at: nowIso(),
    }).eq('id', mealId).eq('user_id', userId)
    if (error) throw new Error('Não foi possível atualizar o alimento.')
    await syncNutritionStats(userId, input.date ?? localDate())
    return mealId
  },

  async removeMealEntry(userId: string, mealId: string, date = localDate()) {
    if (!supabase) return
    const { error } = await supabase.from('meals').delete().eq('id', mealId).eq('user_id', userId)
    if (error) throw new Error('Não foi possível remover o alimento.')
    await syncNutritionStats(userId, date)
  },

  async createCustomFood(userId: string, input: CustomFoodInput) {
    if (!supabase) return null
    const payload = {
      user_id: userId,
      name: input.name,
      category: input.category,
      serving_quantity: input.quantity,
      serving_unit: input.unit,
      calories: input.calories,
      protein: input.protein,
      carbs: input.carbs,
      fat: input.fat,
      fiber: input.fiber,
      sodium: input.sodium,
      source_type: input.sourceType ?? 'custom',
      is_public: false,
      updated_at: nowIso(),
    }
    const { data, error } = await supabase.from('meal_food_catalog').insert(payload).select('*').single()
    if (error) throw new Error('Não foi possível salvar o alimento personalizado.')
    return mapFood(data)
  },

  async toggleFavoriteFood(userId: string, foodId: string, isFavorite: boolean) {
    if (!supabase) return
    if (isFavorite) {
      const { error } = await supabase.from('meal_favorites').insert({ user_id: userId, food_id: foodId })
      if (error && !String(error.message).includes('duplicate')) throw new Error('Não foi possível favoritar o alimento.')
    } else {
      const { error } = await supabase.from('meal_favorites').delete().eq('user_id', userId).eq('food_id', foodId)
      if (error) throw new Error('Não foi possível remover dos favoritos.')
    }
  },

  async saveCombination(userId: string, input: ComboInput) {
    if (!supabase) return null
    const payload = {
      user_id: userId,
      name: input.name,
      items: input.items,
      updated_at: nowIso(),
    }
    const { data, error } = await supabase.from('meal_combinations').insert(payload).select('*').single()
    if (error) throw new Error('Não foi possível salvar a combinação.')
    return mapCombination(data)
  },

  async copyMealSection(
    userId: string,
    sourceDate: string,
    sourceSection: MealSection,
    targetSection: MealSection,
    targetDate = localDate(),
  ) {
    if (!supabase) return
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', userId)
      .eq('date', sourceDate)
      .eq('meal_section', sourceSection)
    if (error) throw new Error('Não foi possível copiar a refeição.')
    const meals = mapMeals(data ?? [])
    if (!meals.length) return
    await supabase.from('meals').insert(meals.map((mealItem) => ({
      user_id: userId,
      date: targetDate,
      time: mealItem.time ?? currentTime(),
      meal_section: targetSection,
      name: mealItem.name,
      quantity: mealItem.quantity ?? 1,
      unit: mealItem.unit ?? 'porção',
      calories: mealItem.calories,
      protein: mealItem.protein,
      carbs: mealItem.carbs,
      fat: mealItem.fat,
      fiber: mealItem.fiber,
      sodium: mealItem.sodium,
      source_type: mealItem.sourceType ?? 'recent',
      food_catalog_id: mealItem.foodCatalogId ?? null,
      notes: mealItem.notes ?? '',
      updated_at: nowIso(),
    })))
    await syncNutritionStats(userId, targetDate)
  },

  async repeatMealFromDate(userId: string, sourceDate: string, section: MealSection, targetDate = localDate()) {
    if (!supabase) return
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', userId)
      .eq('date', sourceDate)
      .eq('meal_section', section)
      .order('time')
    if (error) throw new Error('Não foi possível repetir a refeição.')
    const meals = mapMeals(data ?? [])
    if (!meals.length) return
    await supabase.from('meals').insert(meals.map((mealItem) => ({
      user_id: userId,
      date: targetDate,
      time: mealItem.time ?? currentTime(),
      meal_section: section,
      name: mealItem.name,
      quantity: mealItem.quantity ?? 1,
      unit: mealItem.unit ?? 'porção',
      calories: mealItem.calories,
      protein: mealItem.protein,
      carbs: mealItem.carbs,
      fat: mealItem.fat,
      fiber: mealItem.fiber,
      sodium: mealItem.sodium,
      source_type: mealItem.sourceType ?? 'recent',
      food_catalog_id: mealItem.foodCatalogId ?? null,
      notes: mealItem.notes ?? '',
      updated_at: nowIso(),
    })))
    await syncNutritionStats(userId, targetDate)
  },
}

async function upsertMealEntry(userId: string, input: MealEntryInput) {
  if (!supabase) return null
  const payload = {
    user_id: userId,
    date: input.date ?? localDate(),
    time: input.time ?? currentTime(),
    meal_section: input.mealSection,
    name: input.name,
    quantity: input.quantity,
    unit: input.unit,
    calories: input.calories,
    protein: input.protein,
    carbs: input.carbs,
    fat: input.fat,
    fiber: input.fiber,
    sodium: input.sodium,
    notes: input.notes ?? '',
    source_type: input.sourceType,
    food_catalog_id: input.foodCatalogId ?? null,
    updated_at: nowIso(),
  }
  const { data, error } = await supabase.from('meals').insert(payload).select('*').single()
  if (error) throw new Error('Não foi possível salvar o alimento.')
  await syncNutritionStats(userId, payload.date)
  return mapMeal(data)
}

async function syncNutritionStats(userId: string, date: string) {
  if (!supabase) return
  const { data, error } = await supabase.from('meals')
    .select('calories,protein,carbs,fat,fiber,sodium')
    .eq('user_id', userId)
    .eq('date', date)
  if (error) throw new Error('Não foi possível atualizar o resumo nutricional.')

  const totals = (data ?? []).reduce<NutritionTotals>((acc, meal) => ({
    calories: acc.calories + Number(meal.calories ?? 0),
    protein: acc.protein + Number(meal.protein ?? 0),
    carbs: acc.carbs + Number(meal.carbs ?? 0),
    fat: acc.fat + Number(meal.fat ?? 0),
    fiber: acc.fiber + Number(meal.fiber ?? 0),
    sodium: acc.sodium + Number(meal.sodium ?? 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 })

  const current = await readDailyStatsGoals(userId, date)
  const { error: upsertError } = await supabase.from('daily_stats').upsert({
    user_id: userId,
    date,
    calories_current: Math.round(totals.calories),
    calories_goal: current.calories_goal,
    protein_current: round(totals.protein, 1),
    protein_goal: current.protein_goal,
    carbs_current: round(totals.carbs, 1),
    carbs_goal: current.carbs_goal,
    fat_current: round(totals.fat, 1),
    fat_goal: current.fat_goal,
    fiber_current: round(totals.fiber, 1),
    fiber_goal: current.fiber_goal,
    water_current: current.water_current,
    water_goal: current.water_goal,
    steps_current: current.steps_current,
    steps_goal: current.steps_goal,
    workout_minutes: current.workout_minutes,
    workout_calories: current.workout_calories,
  }, { onConflict: 'user_id,date' })
  if (upsertError) throw new Error('Não foi possível atualizar o resumo nutricional.')
}

async function readDailyStatsGoals(userId: string, date: string) {
  if (!supabase) {
    return {
      calories_goal: 2200,
      protein_goal: 140,
      carbs_goal: 240,
      fat_goal: 70,
      fiber_goal: 30,
      water_current: 0,
      water_goal: 3,
      steps_current: 0,
      steps_goal: 10000,
      workout_minutes: 0,
      workout_calories: 0,
    }
  }
  const { data } = await supabase.from('daily_stats')
    .select('calories_goal,protein_goal,carbs_goal,fat_goal,fiber_goal,water_current,water_goal,steps_current,steps_goal,workout_minutes,workout_calories')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()
  return {
    calories_goal: Number(data?.calories_goal ?? 2200),
    protein_goal: Number(data?.protein_goal ?? 140),
    carbs_goal: Number(data?.carbs_goal ?? 240),
    fat_goal: Number(data?.fat_goal ?? 70),
    fiber_goal: Number(data?.fiber_goal ?? 30),
    water_current: Number(data?.water_current ?? 0),
    water_goal: Number(data?.water_goal ?? 3),
    steps_current: Number(data?.steps_current ?? 0),
    steps_goal: Number(data?.steps_goal ?? 10000),
    workout_minutes: Number(data?.workout_minutes ?? 0),
    workout_calories: Number(data?.workout_calories ?? 0),
  }
}

function buildSummary(meals: Meal[], stats: Record<string, unknown> | null | undefined): NutritionSummary {
  const totals = meals.reduce<NutritionTotals>((acc, meal) => ({
    calories: acc.calories + Number(meal.calories ?? 0),
    protein: acc.protein + Number(meal.protein ?? 0),
    carbs: acc.carbs + Number(meal.carbs ?? 0),
    fat: acc.fat + Number(meal.fat ?? 0),
    fiber: acc.fiber + Number(meal.fiber ?? 0),
    sodium: acc.sodium + Number(meal.sodium ?? 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 })

  const goals = {
    calories: Number(stats?.calories_goal ?? 2200),
    protein: Number(stats?.protein_goal ?? 140),
    carbs: Number(stats?.carbs_goal ?? 240),
    fat: Number(stats?.fat_goal ?? 70),
    fiber: Number(stats?.fiber_goal ?? 30),
    sodium: 2300,
  }

  const completion = Math.round(Math.min(totals.calories / goals.calories, 1) * 100)

  return {
    ...totals,
    goals,
    caloriesGoal: goals.calories,
    completion,
  }
}

function mapSections(meals: Meal[]): DiarySection[] {
  return mealSections.map((section) => {
    const sectionMeals = meals.filter((meal) => meal.mealSection === section)
    const totals = sectionMeals.reduce<NutritionTotals>((acc, meal) => ({
      calories: acc.calories + Number(meal.calories ?? 0),
      protein: acc.protein + Number(meal.protein ?? 0),
      carbs: acc.carbs + Number(meal.carbs ?? 0),
      fat: acc.fat + Number(meal.fat ?? 0),
      fiber: acc.fiber + Number(meal.fiber ?? 0),
      sodium: acc.sodium + Number(meal.sodium ?? 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 })
    return { section, meals: sectionMeals, ...totals }
  })
}

function mapMeals(rows: Record<string, unknown>[]): Meal[] {
  return rows.map((row) => mapMeal(row))
}

function mapMeal(row: Record<string, unknown>): Meal {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    calories: Number(row.calories ?? 0),
    protein: Number(row.protein ?? 0),
    carbs: Number(row.carbs ?? 0),
    fat: Number(row.fat ?? 0),
    fiber: Number(row.fiber ?? 0),
    sodium: Number(row.sodium ?? 0),
    quantity: Number(row.quantity ?? 1),
    unit: String(row.unit ?? 'porção'),
    date: String(row.date ?? ''),
    time: String(row.time ?? currentTime()).slice(0, 5),
    mealSection: mealSectionFrom(String(row.meal_section ?? 'Outras refeições')),
    description: String(row.notes ?? ''),
    notes: String(row.notes ?? ''),
    sourceType: sourceTypeFrom(String(row.source_type ?? 'search')),
    foodCatalogId: row.food_catalog_id ? String(row.food_catalog_id) : null,
  }
}

function mapFoods(rows: Record<string, unknown>[], favoriteRows: Record<string, unknown>[]): NutritionDiaryData['foods'] {
  const favoriteIds = new Set(favoriteRows.map((row) => String(row.food_id)))
  const items = rows.map(mapFood).map((item) => ({ ...item, isFavorite: favoriteIds.has(item.id) }))
  return {
    all: items,
    favorites: items.filter((item) => item.isFavorite),
    recent: items.slice(0, 6),
    custom: items.filter((item) => item.sourceType === 'custom'),
  }
}

function mapFood(row: Record<string, unknown>): FoodCatalogItem {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    category: String(row.category ?? 'Geral'),
    servingQuantity: Number(row.serving_quantity ?? 1),
    servingUnit: String(row.serving_unit ?? 'porção'),
    calories: Number(row.calories ?? 0),
    protein: Number(row.protein ?? 0),
    carbs: Number(row.carbs ?? 0),
    fat: Number(row.fat ?? 0),
    fiber: Number(row.fiber ?? 0),
    sodium: Number(row.sodium ?? 0),
    isPublic: Boolean(row.is_public),
    isFavorite: Boolean(row.is_favorite),
    sourceType: sourceTypeFrom(String(row.source_type ?? 'public')),
  }
}

function mapCombinations(rows: Record<string, unknown>[]): MealCombination[] {
  return rows.map(mapCombination)
}

function mapCombination(row: Record<string, unknown>): MealCombination {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Combinação'),
    items: Array.isArray(row.items) ? row.items.map((item) => ({
      name: String(item.name ?? ''),
      quantity: Number(item.quantity ?? 1),
      unit: String(item.unit ?? 'porção'),
      calories: Number(item.calories ?? 0),
      protein: Number(item.protein ?? 0),
      carbs: Number(item.carbs ?? 0),
      fat: Number(item.fat ?? 0),
      fiber: Number(item.fiber ?? 0),
      sodium: Number(item.sodium ?? 0),
    })) : [],
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }
}

function aggregateHistory(rows: Record<string, unknown>[]) {
  const grouped = new Map<string, number>()
  rows.forEach((row) => {
    const date = String(row.date ?? '')
    grouped.set(date, (grouped.get(date) ?? 0) + Number(row.calories ?? 0))
  })
  return Array.from(grouped.entries()).map(([date, calories]) => ({
    label: new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)).replace('.', ''),
    value: calories,
  })).slice(-7)
}

function buildFallbackDiary(date: string): NutritionDiaryData {
  return {
    date,
    summary: {
      calories: 1240,
      protein: 112,
      carbs: 138,
      fat: 42,
      fiber: 24,
      sodium: 1480,
      goals: {
        calories: 2200,
        protein: 140,
        carbs: 240,
        fat: 70,
        fiber: 30,
        sodium: 2300,
      },
      caloriesGoal: 2200,
      completion: 56,
    },
    sections: mapSections(fallbackMeals),
    foods: {
      all: fallbackFoods,
      favorites: fallbackFoods.slice(0, 2),
      recent: fallbackFoods.slice(1, 4),
      custom: [],
    },
    combinations: fallbackCombinations,
    history: fallbackHistory,
    previousDaySections: mapSections([fallbackMeals[1]]),
    hasEntries: true,
    hasCatalog: true,
  }
}

function food(
  id: string,
  name: string,
  category: string,
  quantity: number,
  unit: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  fiber: number,
  sodium: number,
  isPublic: boolean,
  isFavorite: boolean,
  sourceType: MealSourceType,
): FoodCatalogItem {
  return { id, name, category, servingQuantity: quantity, servingUnit: unit, calories, protein, carbs, fat, fiber, sodium, isPublic, isFavorite, sourceType }
}

function meal(
  id: string,
  name: string,
  time: string,
  mealSection: MealSection,
  description: string,
  quantity: number,
  unit: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  fiber: number,
  sodium: number,
  sourceType: MealSourceType,
): Meal {
  return {
    id,
    name,
    time,
    mealSection,
    description,
    quantity,
    unit,
    calories,
    protein,
    carbs,
    fat,
    fiber,
    sodium,
    sourceType,
  }
}

function mealSectionFrom(value: string): MealSection {
  return mealSections.includes(value as MealSection) ? value as MealSection : 'Outras refeições'
}

function sourceTypeFrom(value: string): MealSourceType {
  const allowed: MealSourceType[] = ['search', 'favorite', 'recent', 'custom', 'barcode']
  return allowed.includes(value as MealSourceType) ? value as MealSourceType : 'search'
}

function localDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function previousDate(date: string) {
  const result = new Date(`${date}T12:00:00`)
  result.setDate(result.getDate() - 1)
  return result.toISOString().slice(0, 10)
}

function currentTime() {
  return new Date().toTimeString().slice(0, 8)
}

function nowIso() {
  return new Date().toISOString()
}

function round(value: number, digits: number) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
