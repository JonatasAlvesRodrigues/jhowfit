import { Dumbbell, Heart, House, MapPin, Plus } from 'lucide-react'
import type { ExerciseLibraryItem } from '../types/exerciseLibrary'

export function ExerciseVisual({
  exercise,
  compact = false,
}: {
  exercise: ExerciseLibraryItem
  compact?: boolean
}) {
  return (
    <div className={`exercise-visual ${compact ? 'is-compact' : ''}`}>
      {exercise.imageUrl ? (
        <img src={exercise.imageUrl} alt={`Demonstração de ${exercise.name}`} />
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
