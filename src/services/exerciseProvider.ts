import type { ExerciseLibraryItem, ExerciseLevel, ExerciseLocation } from '../types/exerciseLibrary'

/** Provider contract. The app consumes normalized exercises and never depends
 * on a vendor-specific response shape. Keep the provider endpoint server-side
 * when possible; this client adapter is optional and disabled by default. */
export interface ExerciseProvider {
  search(query: string): Promise<Partial<ExerciseLibraryItem>[]>
}

export function createExerciseProvider(): ExerciseProvider | null {
  const endpoint = String(import.meta.env.VITE_EXERCISE_PROVIDER_URL ?? '').trim()
  if (!endpoint) return null
  return {
    async search(query: string) {
      const url = new URL(endpoint)
      url.searchParams.set('q', query)
      const response = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error('provider_unavailable')
      const payload = await response.json()
      const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
      return rows.map(normalizeProviderExercise)
    },
  }
}

export function normalizeProviderExercise(row: Record<string, unknown>): Partial<ExerciseLibraryItem> {
  const name = String(row.name_pt ?? row.name ?? '').trim()
  const primaryMuscle = String(row.primary_muscle ?? row.targetMuscle ?? row.bodyPart ?? row.body_part ?? 'Outro')
  const equipment = String(row.equipment_pt ?? row.equipment ?? 'Nenhum')
  return {
    externalId: stringOrNull(row.external_id ?? row.externalId ?? row.id),
    slug: slugify(String(row.slug ?? name)),
    name,
    primaryMuscle,
    secondaryMuscles: strings(row.secondary_muscles ?? row.secondaryMuscles),
    equipment,
    level: normalizeLevel(row.difficulty ?? row.level),
    locations: normalizeLocations(row.locations),
    instructions: strings(row.instructions_pt ?? row.instructions),
    commonMistakes: strings(row.common_mistakes ?? row.commonMistakes),
    safetyTips: strings(row.safety_tips ?? row.safetyTips),
    substitutions: strings(row.substitutions),
    gifUrl: stringOrNull(row.gif_url ?? row.gifUrl),
    videoUrl: stringOrNull(row.video_url ?? row.videoUrl),
    thumbnailUrl: stringOrNull(row.thumbnail_url ?? row.thumbnailUrl ?? row.image_url),
    imageUrl: stringOrNull(row.image_url),
    source: stringOrNull(row.source),
    sourceUrl: stringOrNull(row.source_url ?? row.sourceUrl),
  }
}

function strings(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function stringOrNull(value: unknown) { return value === null || value === undefined || value === '' ? null : String(value) }

function normalizeLevel(value: unknown): ExerciseLevel {
  const text = String(value ?? '').toLowerCase()
  if (text.includes('avan')) return 'Avançado'
  if (text.includes('inter')) return 'Intermediário'
  return 'Iniciante'
}

function normalizeLocations(value: unknown): ExerciseLocation[] {
  const values = strings(value).map((item) => item.toLowerCase())
  return values.some((item) => item.includes('casa') || item.includes('home')) ? ['Academia', 'Casa'] : ['Academia']
}

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
