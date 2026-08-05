import { supabase } from '../integrations/supabase'

export const measurementKeys = ['waistCm', 'abdomenCm', 'chestCm', 'rightArmCm', 'leftArmCm', 'hipsCm', 'rightThighCm', 'leftThighCm', 'calfCm'] as const
export type MeasurementKey = typeof measurementKeys[number]

export interface BodyProgressInput {
  recordedAt: string
  weightKg: number
  bodyFatPercent: number | null
  waistCm: number | null
  abdomenCm: number | null
  chestCm: number | null
  rightArmCm: number | null
  leftArmCm: number | null
  hipsCm: number | null
  rightThighCm: number | null
  leftThighCm: number | null
  calfCm: number | null
  notes: string
}

export interface BodyProgressEntry extends BodyProgressInput { id: string }
export type PhotoPosition = 'front' | 'side' | 'back'

export interface ProgressPhotoSet {
  id: string
  takenAt: string
  observation: string
  isBlurred: boolean
  paths: Record<PhotoPosition, string>
  urls: Record<PhotoPosition, string>
}

const bucket = 'progress-photos'
const localEntries: BodyProgressEntry[] = []
const localPhotos: ProgressPhotoSet[] = []

export const bodyProgressService = {
  async listEntries(userId: string): Promise<BodyProgressEntry[]> {
    if (!supabase) return [...localEntries]
    const { data, error } = await supabase.from('body_progress_entries').select('*').eq('user_id', userId).order('recorded_at', { ascending: true })
    if (error) throw new Error('Não foi possível carregar sua evolução corporal.')
    return (data ?? []).map(mapEntry)
  },

  async saveEntry(userId: string, input: BodyProgressInput): Promise<void> {
    validateEntry(input)
    if (!supabase) { localEntries.push({ id: `body-${Date.now()}`, ...input }); return }
    const { error } = await supabase.from('body_progress_entries').insert(toEntryRow(userId, input))
    if (error) throw new Error('Não foi possível salvar as medidas.')
    const measuredAt = input.recordedAt.slice(0, 10)
    await Promise.all([
      supabase.from('body_measurements').upsert({ user_id: userId, measured_at: measuredAt, weight: input.weightKg, body_fat: input.bodyFatPercent }, { onConflict: 'user_id,measured_at' }),
      supabase.from('profiles').update({ current_weight: input.weightKg, updated_at: new Date().toISOString() }).eq('id', userId),
    ])
  },

  async removeEntry(userId: string, id: string): Promise<void> {
    if (!supabase) { const index = localEntries.findIndex((entry) => entry.id === id); if (index >= 0) localEntries.splice(index, 1); return }
    const { error } = await supabase.from('body_progress_entries').delete().eq('id', id).eq('user_id', userId)
    if (error) throw new Error('Não foi possível remover este registro.')
  },

  async listPhotoSets(userId: string): Promise<ProgressPhotoSet[]> {
    if (!supabase) return [...localPhotos]
    const { data, error } = await supabase.from('progress_photo_sets').select('id,taken_at,front_path,side_path,back_path,observation,is_blurred').eq('user_id', userId).order('taken_at', { ascending: false })
    if (error) throw new Error('Não foi possível carregar suas fotos privadas.')
    if (!data?.length) return []
    const paths = data.flatMap((row) => [String(row.front_path), String(row.side_path), String(row.back_path)])
    const signed = await supabase.storage.from(bucket).createSignedUrls(paths, 60 * 60)
    if (signed.error) throw new Error('Não foi possível autorizar a visualização das fotos privadas.')
    const urlByPath = new Map((signed.data ?? []).map((item) => [item.path, item.signedUrl]))
    return data.map((row) => ({
      id: String(row.id),
      takenAt: String(row.taken_at),
      observation: String(row.observation ?? ''),
      isBlurred: Boolean(row.is_blurred),
      paths: { front: String(row.front_path), side: String(row.side_path), back: String(row.back_path) },
      urls: { front: urlByPath.get(String(row.front_path)) ?? '', side: urlByPath.get(String(row.side_path)) ?? '', back: urlByPath.get(String(row.back_path)) ?? '' },
    }))
  },

  async savePhotoSet(userId: string, input: { takenAt: string; observation: string; isBlurred: boolean; files: Record<PhotoPosition, File> }): Promise<void> {
    validatePhotoInput(input)
    if (!supabase) throw new Error('O armazenamento privado exige uma conta MOVELYA conectada.')
    const setId = crypto.randomUUID()
    const paths = {
      front: `${userId}/${setId}/front.${extension(input.files.front)}`,
      side: `${userId}/${setId}/side.${extension(input.files.side)}`,
      back: `${userId}/${setId}/back.${extension(input.files.back)}`,
    }
    const uploaded: string[] = []
    try {
      for (const position of ['front', 'side', 'back'] as const) {
        const file = input.files[position]
        const { error } = await supabase.storage.from(bucket).upload(paths[position], file, { upsert: false, contentType: file.type, cacheControl: '3600' })
        if (error) throw error
        uploaded.push(paths[position])
      }
      const { error } = await supabase.from('progress_photo_sets').insert({
        id: setId,
        user_id: userId,
        taken_at: input.takenAt,
        front_path: paths.front,
        side_path: paths.side,
        back_path: paths.back,
        observation: input.observation.trim(),
        is_blurred: input.isBlurred,
      })
      if (error) throw error
    } catch {
      if (uploaded.length) await supabase.storage.from(bucket).remove(uploaded)
      throw new Error('Não foi possível salvar as fotos privadas. Nenhuma foto incompleta foi mantida.')
    }
  },

  async setPhotoPrivacy(userId: string, id: string, isBlurred: boolean): Promise<void> {
    if (!supabase) return
    const { error } = await supabase.from('progress_photo_sets').update({ is_blurred: isBlurred }).eq('id', id).eq('user_id', userId)
    if (error) throw new Error('Não foi possível atualizar a privacidade da foto.')
  },

  async removePhotoSet(userId: string, photo: ProgressPhotoSet): Promise<void> {
    if (!supabase) return
    const { error: storageError } = await supabase.storage.from(bucket).remove(Object.values(photo.paths))
    if (storageError) throw new Error('Não foi possível remover os arquivos privados.')
    const { error } = await supabase.from('progress_photo_sets').delete().eq('id', photo.id).eq('user_id', userId)
    if (error) throw new Error('Os arquivos foram removidos, mas não foi possível atualizar o histórico.')
  },
}

function mapEntry(row: Record<string, unknown>): BodyProgressEntry {
  return {
    id: String(row.id), recordedAt: String(row.recorded_at), weightKg: Number(row.weight_kg),
    bodyFatPercent: numberOrNull(row.body_fat_percent), waistCm: numberOrNull(row.waist_cm), abdomenCm: numberOrNull(row.abdomen_cm), chestCm: numberOrNull(row.chest_cm),
    rightArmCm: numberOrNull(row.right_arm_cm), leftArmCm: numberOrNull(row.left_arm_cm), hipsCm: numberOrNull(row.hips_cm),
    rightThighCm: numberOrNull(row.right_thigh_cm), leftThighCm: numberOrNull(row.left_thigh_cm), calfCm: numberOrNull(row.calf_cm), notes: String(row.notes ?? ''),
  }
}

function toEntryRow(userId: string, input: BodyProgressInput) {
  return { user_id: userId, recorded_at: input.recordedAt, weight_kg: input.weightKg, body_fat_percent: input.bodyFatPercent, waist_cm: input.waistCm, abdomen_cm: input.abdomenCm, chest_cm: input.chestCm, right_arm_cm: input.rightArmCm, left_arm_cm: input.leftArmCm, hips_cm: input.hipsCm, right_thigh_cm: input.rightThighCm, left_thigh_cm: input.leftThighCm, calf_cm: input.calfCm, notes: input.notes.trim() }
}

function validateEntry(input: BodyProgressInput) {
  if (!Number.isFinite(input.weightKg) || input.weightKg < 25 || input.weightKg > 400) throw new Error('Informe um peso entre 25 e 400 kg.')
  if (!Number.isFinite(new Date(input.recordedAt).getTime()) || new Date(input.recordedAt) > new Date()) throw new Error('A data e o horário não podem estar no futuro.')
  if (input.bodyFatPercent !== null && (input.bodyFatPercent < 1 || input.bodyFatPercent > 80)) throw new Error('Informe um percentual de gordura entre 1% e 80%.')
  for (const key of measurementKeys) if (input[key] !== null && (Number(input[key]) < 10 || Number(input[key]) > 300)) throw new Error('Confira as medidas informadas em centímetros.')
  if (input.notes.length > 1000) throw new Error('A observação deve ter até 1.000 caracteres.')
}

function validatePhotoInput(input: { takenAt: string; observation: string; files: Record<PhotoPosition, File> }) {
  if (!Number.isFinite(new Date(input.takenAt).getTime()) || new Date(input.takenAt) > new Date()) throw new Error('A data das fotos não pode estar no futuro.')
  if (input.observation.length > 1000) throw new Error('A observação deve ter até 1.000 caracteres.')
  for (const [position, file] of Object.entries(input.files)) {
    if (!file) throw new Error(`Selecione a foto de ${position}.`)
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.type)) throw new Error('Use fotos JPEG, PNG, WebP ou HEIC.')
    if (file.size > 20 * 1024 * 1024) throw new Error('Cada foto deve ter no máximo 20 MB.')
  }
}

function extension(file: File) { const fromName = file.name.split('.').pop()?.toLowerCase(); if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName; return file.type.split('/')[1] || 'jpg' }
function numberOrNull(value: unknown) { return value === null || value === undefined ? null : Number(value) }

