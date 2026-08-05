export type PageId = 'inicio' | 'treinos' | 'nutricao' | 'progresso' | 'mais'

export type MealSection =
  | 'Café da manhã'
  | 'Lanche da manhã'
  | 'Almoço'
  | 'Lanche da tarde'
  | 'Jantar'
  | 'Ceia'
  | 'Outras refeições'

export type MealSourceType = 'search' | 'favorite' | 'recent' | 'custom' | 'barcode' | 'public'

export interface NutritionTotals {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
}

export interface DailyStats {
  calories: { current: number; goal: number }
  water: { current: number; goal: number }
  steps: { current: number; goal: number }
  workout: { minutes: number; calories: number }
}

export interface Workout {
  id: string
  title: string
  focus: string
  duration: number
  exercises: number
  completed?: boolean
}

export interface Meal {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
  quantity?: number
  unit?: string
  date?: string
  time?: string
  mealSection?: MealSection
  description?: string
  notes?: string
  sourceType?: MealSourceType
  foodCatalogId?: string | null
}

export interface ChartPoint { label: string; value: number }

export interface FoodCatalogItem extends NutritionTotals {
  id: string
  name: string
  category: string
  servingQuantity: number
  servingUnit: string
  isPublic: boolean
  isFavorite: boolean
  sourceType: MealSourceType
}

export interface MealCombinationItem extends NutritionTotals {
  name: string
  quantity: number
  unit: string
}

export interface MealCombination {
  id: string
  name: string
  items: MealCombinationItem[]
  createdAt: string
}
