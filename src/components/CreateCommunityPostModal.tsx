import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { Camera, Check, ChevronDown, Dumbbell, Footprints, ImagePlus, LoaderCircle, Salad, Send, Sparkles, X } from 'lucide-react'
import { communityService, prepareCommunityImage, type CommunityPostType, type PreparedCommunityImage, type RecentCommunityActivity } from '../services/communityService'
import { subscriptionService, type PlanCode } from '../services/subscriptionService'

const categories: Array<{ value: CommunityPostType; label: string; icon: typeof Dumbbell }> = [
  { value: 'workout', label: 'Treino', icon: Dumbbell }, { value: 'running', label: 'Corrida', icon: Footprints },
  { value: 'walking', label: 'Caminhada', icon: Footprints }, { value: 'food', label: 'Refeição', icon: Salad },
  { value: 'achievement', label: 'Conquista', icon: Sparkles }, { value: 'general_fitness', label: 'Fitness', icon: Dumbbell },
]

export function CreateCommunityPostModal({ userId, initialType = 'workout', onClose, onPublished }: { userId: string; initialType?: CommunityPostType; onClose: () => void; onPublished: () => void }) {
  const [type, setType] = useState<CommunityPostType>(initialType)
  const [caption, setCaption] = useState('')
  const [image, setImage] = useState<PreparedCommunityImage | null>(null)
  const [activities, setActivities] = useState<RecentCommunityActivity[]>([])
  const [activityId, setActivityId] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [error, setError] = useState('')
  const [planCode, setPlanCode] = useState<PlanCode | null>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)

  const supportsActivity = type === 'running' || type === 'walking'
  const selectedCategory = categories.find((category) => category.value === type) ?? categories[0]
  const CategoryIcon = selectedCategory.icon

  useEffect(() => {
    let active = true
    setActivityId(null)
    if (!supportsActivity) { setActivities([]); return }
    communityService.listRecentActivities(userId, type).then((items) => active && setActivities(items)).catch(() => active && setActivities([]))
    return () => { active = false }
  }, [userId, type, supportsActivity])

  useEffect(() => {
    let active = true
    subscriptionService.getOverview().then((overview) => active && setPlanCode(overview.code)).catch(() => active && setPlanCode(null))
    return () => { active = false }
  }, [])

  useEffect(() => () => { if (image) URL.revokeObjectURL(image.previewUrl) }, [image])

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(''); setPreparing(true); setProgress(8); setProgressLabel('Otimizando foto…')
    try {
      const prepared = await prepareCommunityImage(file)
      setImage((current) => { if (current) URL.revokeObjectURL(current.previewUrl); return prepared })
      setProgress(0); setProgressLabel('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível preparar essa foto.') }
    finally { setPreparing(false) }
  }

  async function publish() {
    if (!image || publishing) return
    setError(''); setPublishing(true); setProgress(6); setProgressLabel('Iniciando publicação…')
    try {
      await communityService.createPost({ userId, type, caption, activityId: supportsActivity ? activityId : null, image, onProgress: (value, label) => { setProgress(value); setProgressLabel(label) } })
      onPublished()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível publicar agora. Tente novamente.'); setProgress(0); setProgressLabel('') }
    finally { setPublishing(false) }
  }

  return <div className="community-composer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !publishing) onClose() }}>
    <section className="community-composer" role="dialog" aria-modal="true" aria-labelledby="community-composer-title">
      <header><div><small>NOVA PUBLICAÇÃO</small><h2 id="community-composer-title">Compartilhe seu movimento</h2></div><button onClick={onClose} disabled={publishing} aria-label="Fechar criação de publicação"><X size={19} /></button></header>
      <div className="community-composer__body">
        <input ref={libraryInput} className="community-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={selectImage} />
        <input ref={cameraInput} className="community-file-input" type="file" accept="image/*" capture="environment" onChange={selectImage} />
        {image ? <div className="community-image-preview"><img src={image.previewUrl} alt="Prévia da foto selecionada" /><button onClick={() => setImage((current) => { if (current) URL.revokeObjectURL(current.previewUrl); return null })} disabled={publishing}><X size={16} /> Remover</button></div> : <div className={`community-image-picker ${preparing ? 'is-preparing' : ''}`}><span>{preparing ? <LoaderCircle size={23} className="is-spinning" /> : <ImagePlus size={23} />}</span><strong>{preparing ? 'Otimizando sua foto…' : 'Adicione uma foto'}</strong><p>Uma imagem por publicação. Ela será comprimida antes do envio.</p><div><button onClick={() => libraryInput.current?.click()} disabled={preparing}><ImagePlus size={15} />Escolher foto</button><button onClick={() => cameraInput.current?.click()} disabled={preparing}><Camera size={15} />Tirar foto</button></div></div>}

        <label className="community-field"><span>Categoria</span><div className="community-category-select"><CategoryIcon size={16} /><select value={type} disabled={publishing} onChange={(event) => setType(event.target.value as CommunityPostType)}>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select><ChevronDown size={15} /></div></label>
        {supportsActivity && <label className="community-field"><span>Vincular atividade recente <em>opcional</em></span><div className="community-activity-select"><select value={activityId ?? ''} disabled={publishing} onChange={(event) => setActivityId(event.target.value || null)}><option value="">Sem vínculo</option>{activities.map((activity) => <option value={activity.id} key={activity.id}>{activity.label}</option>)}</select><ChevronDown size={15} /></div></label>}
        <label className="community-field"><span>Legenda <em>{caption.length}/500</em></span><textarea maxLength={500} value={caption} disabled={publishing} onChange={(event) => setCaption(event.target.value)} placeholder="Conte como foi seu movimento hoje…" /></label>
        {planCode === 'FREE' && <p className="community-retention-note">Esta publicação fica disponível por 7 dias no plano Free.</p>}
        {(publishing || progressLabel) && <div className="community-upload-progress"><div><span>{progressLabel}</span><b>{progress}%</b></div><i><em style={{ width: `${progress}%` }} /></i></div>}
        {error && <div className="community-composer-error">{error}</div>}
      </div>
      <footer><button onClick={onClose} disabled={publishing}>Cancelar</button><button className="community-publish-button" onClick={() => void publish()} disabled={!image || preparing || publishing}>{publishing ? <LoaderCircle size={16} className="is-spinning" /> : <Send size={16} />}{publishing ? 'Publicando…' : 'Publicar'}</button></footer>
    </section>
  </div>
}
