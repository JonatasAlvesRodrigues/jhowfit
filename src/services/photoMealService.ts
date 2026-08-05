import { supabase } from '../integrations/supabase'
import { nutritionService } from './nutritionService'
import type { MealSection } from '../types'

export interface PhotoMealItem {
  id: string
  name: string
  quantity: number
  unit: string
  calories: number
  protein: number
  carbs: number
  fat: number
  confidence: number
}

export interface PhotoMealAnalysis {
  items: PhotoMealItem[]
  confidence: number
  notes: string
}

export const photoMealService = {
  async analyze(imageDataUrl: string): Promise<PhotoMealAnalysis> {
    if (!supabase) return fallbackAnalysis()
    const { data, error } = await supabase.functions.invoke('analyze-meal-photo', { body: { image: imageDataUrl } })
    if (error) {
      const context = (error as { context?: Response }).context
      const response = context ? await context.clone().json().catch(() => null) : null
      throw new Error(response?.error || 'Não foi possível analisar a foto.')
    }
    if (!data?.analysis?.items?.length) throw new Error('Não identificamos alimentos com segurança. Tente outra foto ou adicione os itens manualmente.')
    return data.analysis as PhotoMealAnalysis
  },

  async confirm(userId: string, section: MealSection, time: string, items: PhotoMealItem[]) {
    if (!items.length) throw new Error('Adicione pelo menos um alimento antes de confirmar.')
    for (const item of items) {
      await nutritionService.addMealEntry(userId, {
        mealSection: section, name: item.name.trim(), quantity: item.quantity, unit: item.unit.trim() || 'g',
        calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat,
        fiber: 0, sodium: 0, time, sourceType: 'photo', notes: `Estimado por foto · confiança ${Math.round(item.confidence)}%`,
      })
    }
  },
}

function fallbackAnalysis(): PhotoMealAnalysis {
  return { confidence: 78, notes: 'Análise demonstrativa. Revise todos os itens antes de confirmar.', items: [
    { id: 'demo-1', name: 'Arroz', quantity: 150, unit: 'g', calories: 195, protein: 3.8, carbs: 42, fat: 0.3, confidence: 88 },
    { id: 'demo-2', name: 'Feijão', quantity: 100, unit: 'g', calories: 77, protein: 4.8, carbs: 14, fat: 0.5, confidence: 80 },
    { id: 'demo-3', name: 'Frango grelhado', quantity: 120, unit: 'g', calories: 198, protein: 37, carbs: 0, fat: 4.3, confidence: 74 },
    { id: 'demo-4', name: 'Salada', quantity: 50, unit: 'g', calories: 18, protein: 0.8, carbs: 3.5, fat: 0.2, confidence: 68 },
  ] }
}
