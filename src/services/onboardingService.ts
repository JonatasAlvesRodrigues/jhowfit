import { supabase } from '../integrations/supabase'
import type { OnboardingData } from '../types/onboarding'

export const onboardingService = {
  async getStatus(userId: string) {
    if (!supabase) return { completed: false, available: false }
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', userId)
      .maybeSingle()

    if (error) return { completed: false, available: false }
    return { completed: Boolean(data?.onboarding_completed), available: true }
  },

  async save(userId: string, data: OnboardingData) {
    if (!supabase) throw new Error('A conexão com o Supabase não está configurada.')

    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      full_name: data.name.trim(),
      birth_date: data.birthDate,
      gender: data.gender || null,
      height_cm: Number(data.heightCm),
      current_weight: Number(data.currentWeight),
      goal: data.goal,
      experience_level: data.experienceLevel,
      training_days_per_week: Number(data.trainingDaysPerWeek),
      average_duration_minutes: Number(data.averageDurationMinutes),
      preferred_time: data.preferredTime,
      available_days: data.availableDays,
      training_locations: data.trainingLocations,
      equipment: data.equipment,
      meals_per_day: Number(data.mealsPerDay),
      dietary_preferences: data.dietaryPreferences,
      avoided_foods: data.avoidedFoods.trim() || null,
      allergies: data.allergies.trim() || null,
      dietary_restrictions: data.dietaryRestrictions,
      monthly_food_budget: data.monthlyFoodBudget ? Number(data.monthlyFoodBudget) : null,
      has_injuries: data.injuries.value,
      injuries_details: data.injuries.details.trim() || null,
      has_pain: data.pain.value,
      pain_details: data.pain.details.trim() || null,
      has_physical_limitations: data.physicalLimitations.value,
      physical_limitations_details: data.physicalLimitations.details.trim() || null,
      has_health_conditions: data.healthConditions.value,
      health_conditions_details: data.healthConditions.details.trim() || null,
      uses_medication: data.medication.value,
      medication_details: data.medication.details.trim() || null,
      pregnancy_status: data.pregnancyStatus || null,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

    if (error) {
      if (error.code === '42P01' || error.message.toLowerCase().includes('schema cache')) {
        throw new Error('A estrutura do questionário ainda não foi aplicada no Supabase.')
      }
      throw new Error('Não foi possível salvar suas informações. Tente novamente.')
    }

    const { error: authError } = await supabase.auth.updateUser({
      data: { full_name: data.name.trim() },
    })
    if (authError) console.warn('Perfil salvo, mas o nome da sessão não foi atualizado.')
  },
}
