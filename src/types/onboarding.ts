export interface SafetyAnswer {
  value: boolean
  details: string
}

export interface OnboardingData {
  name: string
  birthDate: string
  gender: string
  heightCm: string
  currentWeight: string
  goal: string
  experienceLevel: string
  trainingDaysPerWeek: string
  averageDurationMinutes: string
  preferredTime: string
  availableDays: string[]
  trainingLocations: string[]
  equipment: string[]
  mealsPerDay: string
  dietaryPreferences: string[]
  avoidedFoods: string
  allergies: string
  dietaryRestrictions: string[]
  monthlyFoodBudget: string
  injuries: SafetyAnswer
  pain: SafetyAnswer
  physicalLimitations: SafetyAnswer
  healthConditions: SafetyAnswer
  medication: SafetyAnswer
  pregnancyStatus: string
}

export const emptyOnboardingData: OnboardingData = {
  name: '',
  birthDate: '',
  gender: '',
  heightCm: '',
  currentWeight: '',
  goal: '',
  experienceLevel: '',
  trainingDaysPerWeek: '',
  averageDurationMinutes: '',
  preferredTime: '',
  availableDays: [],
  trainingLocations: [],
  equipment: [],
  mealsPerDay: '',
  dietaryPreferences: [],
  avoidedFoods: '',
  allergies: '',
  dietaryRestrictions: [],
  monthlyFoodBudget: '',
  injuries: { value: false, details: '' },
  pain: { value: false, details: '' },
  physicalLimitations: { value: false, details: '' },
  healthConditions: { value: false, details: '' },
  medication: { value: false, details: '' },
  pregnancyStatus: '',
}
