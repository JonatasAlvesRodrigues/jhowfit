import { useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Dumbbell,
  Filter,
  Heart,
  House,
  Info,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  X,
} from 'lucide-react'
import { ExerciseLibraryCard, ExerciseVisual } from '../components/ExerciseLibraryCards'
import { useExerciseLibrary } from '../hooks/useExerciseLibrary'
import type { ExerciseLibraryItem, WorkoutOption } from '../types/exerciseLibrary'

export function ExerciseLibraryPage({ userId }: { userId: string }) {
  const library = useExerciseLibrary(userId)
  const [selected, setSelected] = useState<ExerciseLibraryItem | null>(null)
  const [addExercise, setAddExercise] = useState<ExerciseLibraryItem | null>(null)
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)

  if (library.loading) return <ExerciseLibraryLoading />
  if (library.error || !library.data) {
    return (
      <section className="library-state">
        <span className="is-error"><RefreshCw size={24} /></span>
        <small>BIBLIOTECA INDISPONÍVEL</small>
        <h1>Não foi possível carregar os exercícios.</h1>
        <p>{library.error}</p>
        <button className="vita-primary-button" onClick={() => void library.retry()}><RefreshCw size={16} /> Tentar novamente</button>
      </section>
    )
  }

  async function handleFavorite(exercise: ExerciseLibraryItem) {
    setActionError('')
    try {
      await library.toggleFavorite(exercise.id)
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Não foi possível atualizar o favorito.')
    }
  }

  async function handleAdd(workout: WorkoutOption) {
    if (!addExercise) return
    setSaving(true)
    setActionError('')
    try {
      await library.addToWorkout(workout.id, addExercise)
      setMessage(`${addExercise.name} foi adicionado a ${workout.title}.`)
      setAddExercise(null)
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Não foi possível adicionar ao treino.')
    } finally {
      setSaving(false)
    }
  }

  if (selected) {
    const favorite = library.favoriteSet.has(selected.id)
    return (
      <>
        <ExerciseDetails
          exercise={selected}
          favorite={favorite}
          onBack={() => setSelected(null)}
          onFavorite={() => void handleFavorite(selected)}
          onAdd={() => setAddExercise(selected)}
          onSelectSubstitution={(name) => {
            const substitute = library.data?.exercises.find((exercise) => exercise.name === name)
            if (substitute) setSelected(substitute)
          }}
        />
        {addExercise && (
          <AddToWorkoutModal
            exercise={addExercise}
            workouts={library.data.workouts}
            saving={saving}
            onAdd={(workout) => void handleAdd(workout)}
            onClose={() => setAddExercise(null)}
          />
        )}
        {(message || actionError) && <LibraryToast message={message || actionError} error={Boolean(actionError)} onClose={() => { setMessage(''); setActionError('') }} />}
      </>
    )
  }

  return (
    <section className="exercise-library-page">
      <header className="library-heading">
        <div>
          <small>BIBLIOTECA DE EXERCÍCIOS</small>
          <h1>Encontre o movimento certo.</h1>
          <p>Explore instruções, segurança e variações para academia ou casa.</p>
        </div>
        <span><Dumbbell size={28} /></span>
      </header>

      {library.recentExercises.length > 0 && (
        <section className="recent-exercises">
          <div className="library-section-heading">
            <div><small>SEU HISTÓRICO</small><h2>Recentemente utilizados</h2></div>
          </div>
          <div className="recent-exercises__track">
            {library.recentExercises.map((exercise) => (
              <button key={exercise.id} onClick={() => setSelected(exercise)}>
                <ExerciseVisual exercise={exercise} compact />
                <span><strong>{exercise.name}</strong><small>{exercise.primaryMuscle} · {exercise.equipment}</small></span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="library-toolbar">
        <label className="library-search">
          <Search size={18} />
          <input
            value={library.filters.search}
            onChange={(event) => library.setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Buscar exercício ou grupo muscular"
          />
          {library.filters.search && <button onClick={() => library.setFilters((current) => ({ ...current, search: '' }))} aria-label="Limpar pesquisa"><X size={15} /></button>}
        </label>
        <button
          className={`favorite-filter ${library.filters.favoritesOnly ? 'is-active' : ''}`}
          onClick={() => library.setFilters((current) => ({ ...current, favoritesOnly: !current.favoritesOnly }))}
        >
          <Heart size={17} fill={library.filters.favoritesOnly ? 'currentColor' : 'none'} /> Favoritos
        </button>
      </div>

      <div className="library-layout">
        <aside className="library-filters">
          <div className="library-filters__heading"><Filter size={17} /><strong>Filtros</strong><button onClick={library.clearFilters}>Limpar</button></div>
          <FilterSelect label="Grupo muscular" value={library.filters.muscle} options={library.options.muscles} onChange={(value) => library.setFilters((current) => ({ ...current, muscle: value }))} />
          <FilterSelect label="Equipamento" value={library.filters.equipment} options={library.options.equipment} onChange={(value) => library.setFilters((current) => ({ ...current, equipment: value }))} />
          <FilterSelect label="Nível" value={library.filters.level} options={['Iniciante', 'Intermediário', 'Avançado']} onChange={(value) => library.setFilters((current) => ({ ...current, level: value }))} />
          <div className="location-filter">
            <span>Local</span>
            <button className={library.filters.location === 'Academia' ? 'is-active' : ''} onClick={() => library.setFilters((current) => ({ ...current, location: current.location === 'Academia' ? '' : 'Academia' }))}><MapPin size={15} /> Academia</button>
            <button className={library.filters.location === 'Casa' ? 'is-active' : ''} onClick={() => library.setFilters((current) => ({ ...current, location: current.location === 'Casa' ? '' : 'Casa' }))}><House size={15} /> Casa</button>
          </div>
        </aside>

        <main className="library-results">
          <div className="library-results__top">
            <span><SlidersHorizontal size={15} /> {library.filteredExercises.length} exercícios</span>
            {(library.filters.muscle || library.filters.equipment || library.filters.level || library.filters.location || library.filters.favoritesOnly) && <button onClick={library.clearFilters}>Remover filtros</button>}
          </div>
          {library.filteredExercises.length ? (
            <div className="exercise-library-grid">
              {library.filteredExercises.map((exercise) => (
                <ExerciseLibraryCard
                  key={exercise.id}
                  exercise={exercise}
                  favorite={library.favoriteSet.has(exercise.id)}
                  onOpen={() => setSelected(exercise)}
                  onFavorite={() => void handleFavorite(exercise)}
                  onAdd={() => setAddExercise(exercise)}
                />
              ))}
            </div>
          ) : (
            <div className="library-empty">
              <span><Search size={25} /></span>
              <h2>Nenhum exercício encontrado</h2>
              <p>Tente remover um filtro ou pesquisar por outro termo.</p>
              <button onClick={library.clearFilters}>Limpar filtros</button>
            </div>
          )}
        </main>
      </div>

      {addExercise && (
        <AddToWorkoutModal
          exercise={addExercise}
          workouts={library.data.workouts}
          saving={saving}
          onAdd={(workout) => void handleAdd(workout)}
          onClose={() => setAddExercise(null)}
        />
      )}
      {(message || actionError) && <LibraryToast message={message || actionError} error={Boolean(actionError)} onClose={() => { setMessage(''); setActionError('') }} />}
    </section>
  )
}

function ExerciseDetails({
  exercise,
  favorite,
  onBack,
  onFavorite,
  onAdd,
  onSelectSubstitution,
}: {
  exercise: ExerciseLibraryItem
  favorite: boolean
  onBack: () => void
  onFavorite: () => void
  onAdd: () => void
  onSelectSubstitution: (name: string) => void
}) {
  return (
    <section className="exercise-details-page">
      <button className="details-back" onClick={onBack}><ArrowLeft size={17} /> Voltar à biblioteca</button>
      <div className="exercise-details-hero">
        <ExerciseVisual exercise={exercise} />
        <div className="exercise-details-hero__copy">
          <span>{exercise.primaryMuscle}</span>
          <h1>{exercise.name}</h1>
          <p>{exercise.equipment} · {exercise.level}</p>
          <div className="exercise-detail-tags">
            {exercise.locations.map((location) => <span key={location}>{location === 'Casa' ? <House size={13} /> : <MapPin size={13} />}{location}</span>)}
          </div>
          <div className="exercise-detail-actions">
            <button className="details-add" onClick={onAdd}><Plus size={17} /> Adicionar a um treino</button>
            <button className={`details-favorite ${favorite ? 'is-favorite' : ''}`} onClick={onFavorite}><Heart size={17} fill={favorite ? 'currentColor' : 'none'} /> {favorite ? 'Favoritado' : 'Favoritar'}</button>
          </div>
        </div>
      </div>

      <div className="exercise-details-grid">
        <DetailSection icon={Target} eyebrow="EXECUÇÃO" title="Como executar" items={exercise.instructions} ordered />
        <DetailSection icon={AlertTriangle} eyebrow="ATENÇÃO" title="Erros comuns" items={exercise.commonMistakes} tone="warning" />
        <DetailSection icon={ShieldCheck} eyebrow="SEGURANÇA" title="Dicas de segurança" items={exercise.safetyTips} tone="safe" />
        <article className="exercise-detail-section substitutions-section">
          <div className="detail-section-heading"><span><Sparkles size={19} /></span><div><small>VARIAÇÕES</small><h2>Possíveis substituições</h2></div></div>
          <div className="substitution-list">
            {exercise.substitutions.map((name) => <button key={name} onClick={() => onSelectSubstitution(name)}>{name}<ChevronRight size={15} /></button>)}
          </div>
        </article>
      </div>

      <article className="muscle-summary">
        <span><Info size={19} /></span>
        <div><small>MÚSCULOS TRABALHADOS</small><strong>Principal: {exercise.primaryMuscle}</strong><p>{exercise.secondaryMuscles.length ? `Secundários: ${exercise.secondaryMuscles.join(', ')}` : 'Sem grupos secundários cadastrados.'}</p></div>
      </article>
    </section>
  )
}

function DetailSection({
  icon: Icon,
  eyebrow,
  title,
  items,
  tone = '',
  ordered = false,
}: {
  icon: typeof Target
  eyebrow: string
  title: string
  items: string[]
  tone?: string
  ordered?: boolean
}) {
  return (
    <article className={`exercise-detail-section ${tone ? `is-${tone}` : ''}`}>
      <div className="detail-section-heading"><span><Icon size={19} /></span><div><small>{eyebrow}</small><h2>{title}</h2></div></div>
      <ol className={ordered ? 'is-ordered' : ''}>{items.map((item, index) => <li key={item}>{ordered && <b>{index + 1}</b>}<span>{item}</span></li>)}</ol>
    </article>
  )
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="library-filter-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Todos</option>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  )
}

function AddToWorkoutModal({
  exercise,
  workouts,
  saving,
  onAdd,
  onClose,
}: {
  exercise: ExerciseLibraryItem
  workouts: WorkoutOption[]
  saving: boolean
  onAdd: (workout: WorkoutOption) => void
  onClose: () => void
}) {
  return (
    <div className="library-modal-backdrop" onMouseDown={onClose}>
      <div className="library-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="library-modal__heading">
          <div><small>ADICIONAR EXERCÍCIO</small><h2>Escolha um treino</h2><p>{exercise.name}</p></div>
          <button onClick={onClose} aria-label="Fechar"><X size={19} /></button>
        </div>
        {workouts.length ? (
          <div className="workout-option-list">
            {workouts.map((workout) => (
              <button key={workout.id} onClick={() => onAdd(workout)} disabled={saving}>
                <span><Dumbbell size={18} /></span>
                <div><strong>{workout.title}</strong><small>{workout.exerciseCount} exercícios</small></div>
                {saving ? <i className="library-spinner" /> : <Plus size={17} />}
              </button>
            ))}
          </div>
        ) : (
          <div className="no-workouts-modal">
            <span><Dumbbell size={25} /></span>
            <h3>Você ainda não possui treinos</h3>
            <p>Crie um treino na próxima etapa para começar a montar sua rotina.</p>
            <button onClick={onClose}>Entendi</button>
          </div>
        )}
      </div>
    </div>
  )
}

function LibraryToast({ message, error, onClose }: { message: string; error: boolean; onClose: () => void }) {
  return (
    <div className={`library-toast ${error ? 'is-error' : ''}`} role="status">
      <span>{error ? <AlertTriangle size={18} /> : <Check size={18} />}</span>
      <p>{message}</p>
      <button onClick={onClose}><X size={15} /></button>
    </div>
  )
}

function ExerciseLibraryLoading() {
  return (
    <section className="exercise-library-page" role="status" aria-label="Carregando biblioteca">
      <div className="library-loading library-loading--heading" />
      <div className="library-loading library-loading--search" />
      <div className="library-loading-layout"><div className="library-loading" /> <div className="library-loading-grid">{Array.from({ length: 6 }, (_, index) => <div className="library-loading" key={index} />)}</div></div>
    </section>
  )
}
