import { useEffect, useState } from 'react'
import { Dumbbell, Heart, House, MapPin, Plus } from 'lucide-react'
import type { ExerciseLibraryItem } from '../types/exerciseLibrary'

const mediaCache = new Map<string, string | null>()
const mediaRequests = new Map<string, Promise<string | null>>()
const providerAliases: Record<string, string> = {
  'rosca direta': 'barbell curl',
  'corrida na esteira': 'treadmill running',
  polichinelo: 'jumping jack',
  bíceps: 'biceps curl',
}

async function resolveProviderMedia(name: string) {
  const query = providerAliases[name.trim().toLowerCase()] || name
  const key = query.toLowerCase()
  if (mediaCache.has(key)) return mediaCache.get(key) ?? null
  if (!mediaRequests.has(key)) {
    const request = fetch(`https://oss.exercisedb.dev/api/v1/exercises?q=${encodeURIComponent(query)}&limit=5`)
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
        const row = rows.find((item: Record<string, unknown>) => item.gifUrl || item.gif_url || item.imageUrl || item.image_url)
        return row ? String(row.gifUrl || row.gif_url || row.imageUrl || row.image_url) : null
      })
      .catch(() => null)
      .then((url) => { mediaCache.set(key, url); mediaRequests.delete(key); return url })
    mediaRequests.set(key, request)
  }
  return mediaRequests.get(key)!
}

export function ExerciseVisual({
  exercise,
  compact = false,
}: {
  exercise: ExerciseLibraryItem
  compact?: boolean
}) {
  const [mediaFailed, setMediaFailed] = useState(false)
  const [providerMedia, setProviderMedia] = useState<string | null>(null)
  const directMedia = exercise.gifUrl || exercise.imageUrl || exercise.thumbnailUrl || (exercise.externalId ? `https://static.exercisedb.dev/media/${encodeURIComponent(exercise.externalId)}.gif` : null)
  useEffect(() => {
    if (directMedia || providerMedia || mediaFailed) return
    let active = true
    void resolveProviderMedia(exercise.name).then((url) => { if (active && url) setProviderMedia(url) })
    return () => { active = false }
  }, [directMedia, exercise.name, mediaFailed, providerMedia])
  const mediaUrl = directMedia || providerMedia
  return (
    <div className={`exercise-visual ${compact ? 'is-compact' : ''}`}>
      {mediaUrl && !mediaFailed ? (
        <img src={mediaUrl} alt={`Demonstração de ${exercise.name}`} loading="lazy" decoding="async" onError={() => setMediaFailed(true)} />
      ) : exercise.videoUrl && !mediaFailed ? (
        <video src={exercise.videoUrl} aria-label={`Demonstração de ${exercise.name}`} autoPlay loop muted playsInline preload="metadata" onError={() => setMediaFailed(true)} />
      ) : (
        <div className="exercise-placeholder">
          <span><Dumbbell size={compact ? 22 : 36} strokeWidth={1.6} /></span>
          {!compact && <><strong>{exercise.primaryMuscle}</strong><small>Ilustração em preparação</small></>}
        </div>
      )}
    </div>
  )
}

export function ExerciseLibraryCard({
  exercise,
  favorite,
  onOpen,
  onFavorite,
  onAdd,
}: {
  exercise: ExerciseLibraryItem
  favorite: boolean
  onOpen: () => void
  onFavorite: () => void
  onAdd: () => void
}) {
  return (
    <article className="exercise-library-card" onClick={onOpen}>
      <ExerciseVisual exercise={exercise} />
      <div className="exercise-library-card__body">
        <div className="exercise-library-card__top">
          <span>{exercise.primaryMuscle}</span>
          <button
            className={favorite ? 'is-favorite' : ''}
            onClick={(event) => {
              event.stopPropagation()
              onFavorite()
            }}
            aria-label={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <Heart size={17} fill={favorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        <h3>{exercise.name}</h3>
        <p>{exercise.equipment} · {exercise.level}</p>
        <div className="exercise-location-tags">
          {exercise.locations.map((location) => (
            <span key={location}>{location === 'Casa' ? <House size={12} /> : <MapPin size={12} />}{location}</span>
          ))}
        </div>
        <button
          className="exercise-add-button"
          onClick={(event) => {
            event.stopPropagation()
            onAdd()
          }}
        >
          <Plus size={15} /> Adicionar ao treino
        </button>
      </div>
    </article>
  )
}
