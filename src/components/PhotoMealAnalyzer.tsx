import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { AlertTriangle, Camera, CameraOff, Check, ImagePlus, LoaderCircle, Plus, RotateCcw, Sparkles, Trash2, X } from 'lucide-react'
import { Button, Field, Modal } from './ui'
import { photoMealService, type PhotoMealItem } from '../services/photoMealService'
import type { MealSection } from '../types'
import '../photoMeal.css'
import '../photoMealUpload.css'

const sections: MealSection[] = ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia', 'Outras refeições']

export function PhotoMealAnalyzer({ open, userId, onClose, onConfirmed }: { open: boolean; userId: string; onClose: () => void; onConfirmed: () => void }) {
  const galleryRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cameraRequest = useRef(0)
  const [image, setImage] = useState('')
  const [items, setItems] = useState<PhotoMealItem[]>([])
  const [confidence, setConfidence] = useState(0)
  const [notes, setNotes] = useState('')
  const [section, setSection] = useState<MealSection>('Almoço')
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5))
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)

  const totals = useMemo(() => items.reduce((sum, item) => ({ calories: sum.calories + item.calories, protein: sum.protein + item.protein, carbs: sum.carbs + item.carbs, fat: sum.fat + item.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [items])

  useEffect(() => {
    if (!open) releaseCamera()
  }, [open])
  useEffect(() => {
    const handleVisibility = () => { if (document.hidden) closeCamera() }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => { document.removeEventListener('visibilitychange', handleVisibility); releaseCamera() }
  }, [])

  if (!open) return null

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    closeCamera()
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Envie uma imagem JPG, PNG ou WebP.'); return }
    if (file.size > 12 * 1024 * 1024) { setError('A imagem deve ter no máximo 12 MB.'); return }
    try { setImage(await resizeImage(file)); setItems([]); setConfidence(0); setNotes('') }
    catch { setError('Não foi possível preparar esta imagem.') }
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) { setError('A câmera não está disponível neste navegador. Use uma foto da galeria.'); return }
    const requestId = ++cameraRequest.current
    setCameraReady(false); setCameraOpen(true); setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
      if (requestId !== cameraRequest.current) { stream.getTracks().forEach((track) => track.stop()); return }
      streamRef.current = stream
      window.requestAnimationFrame(() => { if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play() } })
    } catch (reason) {
      setCameraOpen(false)
      setError((reason as DOMException)?.name === 'NotAllowedError' ? 'A permissão da câmera foi negada. Libere o acesso nas configurações do navegador ou escolha uma foto.' : 'Não foi possível abrir a câmera. Tente usar uma foto da galeria.')
    }
  }

  function capturePhoto() {
    const video = videoRef.current
    if (!video?.videoWidth || !video.videoHeight) return
    const canvas = document.createElement('canvas')
    const max = 1600; const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    setImage(canvas.toDataURL('image/jpeg', .84)); setItems([]); setConfidence(0); setNotes('')
    closeCamera()
  }

  function releaseCamera() {
    cameraRequest.current += 1
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  function closeCamera() { releaseCamera(); setCameraOpen(false); setCameraReady(false) }

  async function analyze() {
    if (!image) return
    setAnalyzing(true); setError('')
    try { const result = await photoMealService.analyze(image); setItems(result.items.map((item, index) => ({ ...item, id: item.id || `photo-${Date.now()}-${index}` }))); setConfidence(result.confidence); setNotes(result.notes) }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Não foi possível analisar a imagem.') }
    finally { setAnalyzing(false) }
  }

  function update(id: string, patch: Partial<PhotoMealItem>) { setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item)) }
  function updateQuantity(item: PhotoMealItem, value: number) {
    const next = Math.max(0, value); const ratio = item.quantity > 0 ? next / item.quantity : 1
    update(item.id, { quantity: next, calories: round(item.calories * ratio), protein: round(item.protein * ratio), carbs: round(item.carbs * ratio), fat: round(item.fat * ratio) })
  }
  function addItem() { setItems((current) => [...current, { id: `manual-${Date.now()}`, name: '', quantity: 100, unit: 'g', calories: 0, protein: 0, carbs: 0, fat: 0, confidence: 100 }]) }

  async function confirm() {
    if (items.some((item) => !item.name.trim() || item.quantity <= 0)) { setError('Revise o nome e a quantidade de todos os alimentos.'); return }
    setSaving(true); setError('')
    try { await photoMealService.confirm(userId, section, time, items); onConfirmed(); close() }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Não foi possível confirmar a refeição.') }
    finally { setSaving(false) }
  }

  function close() { closeCamera(); setImage(''); setItems([]); setConfidence(0); setNotes(''); setError(''); if (galleryRef.current) galleryRef.current.value = ''; onClose() }

  return <Modal title="Registrar refeição por foto" onClose={close}>
    <div className="photo-meal">
      {cameraOpen ? <div className="photo-camera"><video ref={videoRef} autoPlay muted playsInline onLoadedMetadata={() => setCameraReady(true)} /><div className="photo-camera__status">{cameraReady ? <><i /> Câmera ativa somente nesta tela</> : <><LoaderCircle className="is-spinning" /> Abrindo câmera…</>}</div><div className="photo-camera__actions"><button type="button" onClick={closeCamera}><CameraOff size={17} /> Fechar câmera</button><button type="button" className="is-capture" disabled={!cameraReady} onClick={capturePhoto}><span /><Camera size={20} /> Capturar</button></div></div> : !image ? <div className="photo-meal-upload"><span><ImagePlus size={28} /></span><strong>Adicionar foto da refeição</strong><p>Use uma foto clara, tirada de cima e com todos os alimentos visíveis.</p><div className="photo-meal-upload__actions"><button type="button" onClick={() => void openCamera()}><Camera size={16} /> Abrir câmera</button><button type="button" onClick={() => galleryRef.current?.click()}><ImagePlus size={16} /> Escolher da galeria</button></div><small>A câmera é desligada após capturar ou fechar · JPG, PNG ou WebP</small></div> : <div className="photo-meal-preview"><img src={image} alt="Refeição selecionada para análise" /><button type="button" onClick={() => { setImage(''); setItems([]); if (galleryRef.current) galleryRef.current.value = ''; galleryRef.current?.click() }}><RotateCcw size={15} /> Trocar foto</button></div>}
      <input ref={galleryRef} className="photo-meal-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void selectImage(event)} />

      {!items.length && <div className="photo-meal-warning"><AlertTriangle size={18} /><p><strong>A análise é aproximada.</strong> A IA pode errar principalmente nas quantidades, óleos, molhos, ingredientes escondidos e modo de preparo. Você revisará tudo antes de salvar.</p></div>}
      {error && !items.length && <p className="ai-diet-error">{error}</p>}
      {image && !items.length && <div className="nutrition-modal-actions"><Button variant="secondary" onClick={close}>Cancelar</Button><Button onClick={() => void analyze()} disabled={analyzing}>{analyzing ? <><LoaderCircle className="is-spinning" size={16} /> Analisando foto...</> : <><Sparkles size={16} /> Analisar com IA</>}</Button></div>}

      {!!items.length && <>
        <div className="photo-confidence"><div><small>CONFIANÇA DA ANÁLISE</small><strong>{confidenceLabel(confidence)}</strong></div><span>{Math.round(confidence)}%</span><i><b style={{ width: `${confidence}%` }} /></i></div>
        {notes && <p className="photo-analysis-notes">{notes}</p>}
        <div className="photo-items-heading"><div><small>ALIMENTOS IDENTIFICADOS</small><h3>Revise antes de confirmar</h3></div><Button variant="secondary" onClick={addItem}><Plus size={15} /> Adicionar</Button></div>
        <div className="photo-item-list">{items.map((item, index) => <article key={item.id} className="photo-item"><header><span>{index + 1}</span><input aria-label="Nome do alimento" value={item.name} onChange={(event) => update(item.id, { name: event.target.value })} /><button type="button" onClick={() => setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))} aria-label={`Remover ${item.name || 'alimento'}`}><Trash2 size={15} /></button></header><div className="photo-item-fields"><Field label="Quantidade aproximada" type="number" min="0.1" step="0.1" value={item.quantity} onChange={(event) => updateQuantity(item, Number(event.target.value))} /><Field label="Unidade" value={item.unit} onChange={(event) => update(item.id, { unit: event.target.value })} /><Field label="Calorias" type="number" min="0" step="1" value={item.calories} onChange={(event) => update(item.id, { calories: Number(event.target.value) })} /><Field label="Proteínas (g)" type="number" min="0" step="0.1" value={item.protein} onChange={(event) => update(item.id, { protein: Number(event.target.value) })} /><Field label="Carboidratos (g)" type="number" min="0" step="0.1" value={item.carbs} onChange={(event) => update(item.id, { carbs: Number(event.target.value) })} /><Field label="Gorduras (g)" type="number" min="0" step="0.1" value={item.fat} onChange={(event) => update(item.id, { fat: Number(event.target.value) })} /></div><small className="photo-item-confidence">Confiança neste item: {Math.round(item.confidence)}%</small></article>)}</div>
        <div className="photo-totals"><div><small>CALORIAS ESTIMADAS</small><strong>≈ {Math.round(totals.calories)} kcal</strong></div><span><b>{round(totals.protein)}g</b> Proteínas</span><span><b>{round(totals.carbs)}g</b> Carboidratos</span><span><b>{round(totals.fat)}g</b> Gorduras</span></div>
        <div className="nutrition-modal-grid"><label className="nutrition-select-field"><span>Refeição</span><select value={section} onChange={(event) => setSection(event.target.value as MealSection)}>{sections.map((item) => <option key={item}>{item}</option>)}</select></label><Field label="Horário" type="time" value={time} onChange={(event) => setTime(event.target.value)} /></div>
        <div className="photo-confirm-warning"><AlertTriangle size={16} /> Nada foi salvo ainda. Confira os itens e confirme a refeição para registrá-la no diário.</div>
        {error && <p className="ai-diet-error">{error}</p>}
        <div className="nutrition-modal-actions"><Button variant="secondary" onClick={close}><X size={15} /> Cancelar</Button><Button onClick={() => void confirm()} disabled={saving || !items.length}>{saving ? <><LoaderCircle className="is-spinning" size={16} /> Salvando...</> : <><Check size={16} /> Confirmar refeição</>}</Button></div>
      </>}
    </div>
  </Modal>
}

async function resizeImage(file: File) {
  const source = await readFile(file)
  const image = new Image()
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Imagem inválida')); image.src = source })
  const max = 1600; const scale = Math.min(1, max / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale)
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', .82)
}
function readFile(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file) }) }
function round(value: number) { return Math.round(value * 10) / 10 }
function confidenceLabel(value: number) { return value >= 80 ? 'Alta' : value >= 60 ? 'Moderada' : 'Baixa — revise com atenção' }
