import { useState } from 'react'
import { Dumbbell, ExternalLink, Heart, House, MapPin, Plus } from 'lucide-react'
import type { ExerciseLibraryItem } from '../types/exerciseLibrary'

export function ExerciseVisual({
  exercise,
  compact = false,
}: {
  exercise: ExerciseLibraryItem
  compact?: boolean
}) {
  const [mediaFailed, setMediaFailed] = useState(false)
  const providerMedia = null
  const directMedia = exercise.gifUrl || exercise.imageUrl || exercise.thumbnailUrl || (exercise.externalId ? `https://static.exercisedb.dev/media/${encodeURIComponent(exercise.externalId)}.gif` : null)
  const mediaUrl = mediaFailed ? providerMedia : (directMedia || providerMedia)
  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`como fazer ${exercise.name}`)}`
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
          {!compact && <a href={youtubeUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><ExternalLink size={13} /> Ver execução no YouTube</a>}
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
