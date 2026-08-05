import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, CalendarDays, Camera, Check, Eye, EyeOff, Images, LockKeyhole, Plus, Ruler, Scale, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react'
import { Button, Card, Field, Modal } from '../components/ui'
import { bodyProgressService, measurementKeys, type BodyProgressEntry, type BodyProgressInput, type MeasurementKey, type PhotoPosition, type ProgressPhotoSet } from '../services/bodyProgressService'
import '../bodyEvolution.css'

const measurementLabels: Record<MeasurementKey, string> = { waistCm: 'Cintura', abdomenCm: 'Abdômen', chestCm: 'Peito', rightArmCm: 'Braço direito', leftArmCm: 'Braço esquerdo', hipsCm: 'Quadril', rightThighCm: 'Coxa direita', leftThighCm: 'Coxa esquerda', calfCm: 'Panturrilha' }
const emptyEntry = (): BodyProgressInput => ({ recordedAt: localDateTime(), weightKg: 0, bodyFatPercent: null, waistCm: null, abdomenCm: null, chestCm: null, rightArmCm: null, leftArmCm: null, hipsCm: null, rightThighCm: null, leftThighCm: null, calfCm: null, notes: '' })
const emptyFiles = (): Partial<Record<PhotoPosition, File>> => ({})

export function BodyEvolutionPage({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<BodyProgressEntry[]>([])
  const [photos, setPhotos] = useState<ProgressPhotoSet[]>([])
  const [tab, setTab] = useState<'measurements' | 'photos'>('measurements')
  const [metric, setMetric] = useState<MeasurementKey>('waistCm')
  const [entryOpen, setEntryOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [entryDraft, setEntryDraft] = useState<BodyProgressInput>(emptyEntry)
  const [photoDate, setPhotoDate] = useState(localDateTime())
  const [photoObservation, setPhotoObservation] = useState('')
  const [photoBlurred, setPhotoBlurred] = useState(true)
  const [photoFiles, setPhotoFiles] = useState<Partial<Record<PhotoPosition, File>>>(emptyFiles)
  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const [nextEntries, nextPhotos] = await Promise.all([bodyProgressService.listEntries(userId), bodyProgressService.listPhotoSets(userId)])
      setEntries(nextEntries); setPhotos(nextPhotos)
      setLeftId((current) => current || nextPhotos[1]?.id || nextPhotos[0]?.id || '')
      setRightId((current) => current || nextPhotos[0]?.id || '')
    } catch (requestError) { setError(message(requestError)) }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [userId])
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3500); return () => window.clearTimeout(timer) }, [toast])

  const latest = entries[entries.length - 1]
  const weightSeries = useMemo(() => entries.map((entry) => ({ date: shortDate(entry.recordedAt), value: entry.weightKg })), [entries])
  const measureSeries = useMemo(() => entries.filter((entry) => entry[metric] !== null).map((entry) => ({ date: shortDate(entry.recordedAt), value: entry[metric] })), [entries, metric])
  const weekly = variation(entries, 7)
  const monthly = variation(entries, 30)
  const leftPhoto = photos.find((photo) => photo.id === leftId)
  const rightPhoto = photos.find((photo) => photo.id === rightId)

  async function saveEntry(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try { await bodyProgressService.saveEntry(userId, entryDraft); setEntryOpen(false); setEntryDraft(emptyEntry()); setToast('Peso e medidas registrados.'); await load() }
    catch (requestError) { setError(message(requestError)) }
    finally { setSaving(false) }
  }

  async function savePhotos(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      if (!photoFiles.front || !photoFiles.side || !photoFiles.back) throw new Error('Selecione as fotos de frente, lado e costas.')
      await bodyProgressService.savePhotoSet(userId, { takenAt: photoDate, observation: photoObservation, isBlurred: photoBlurred, files: photoFiles as Record<PhotoPosition, File> })
      setPhotoOpen(false); setPhotoFiles(emptyFiles()); setPhotoObservation(''); setPhotoDate(localDateTime()); setToast('Fotos salvas no armazenamento privado.'); await load()
    } catch (requestError) { setError(message(requestError)) }
    finally { setSaving(false) }
  }

  async function removeEntry(entry: BodyProgressEntry) {
    if (!window.confirm(`Remover o registro de ${formatDateTime(entry.recordedAt)}?`)) return
    try { await bodyProgressService.removeEntry(userId, entry.id); setToast('Registro removido.'); await load() } catch (requestError) { setError(message(requestError)) }
  }

  async function togglePrivacy(photo: ProgressPhotoSet) {
    try { await bodyProgressService.setPhotoPrivacy(userId, photo.id, !photo.isBlurred); setPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, isBlurred: !item.isBlurred } : item)); setToast('Controle de privacidade atualizado.') }
    catch (requestError) { setError(message(requestError)) }
  }

  async function removePhoto(photo: ProgressPhotoSet) {
    if (!window.confirm('Remover permanentemente estas três fotos privadas?')) return
    try { await bodyProgressService.removePhotoSet(userId, photo); setToast('Fotos removidas permanentemente.'); await load() } catch (requestError) { setError(message(requestError)) }
  }

  if (loading) return <div className="body-loading"><div /><div /><div /></div>

  return <section className="body-page">
    <div className="page-heading body-hero"><div><p>EVOLUÇÃO CORPORAL</p><h1>Acompanhe mudanças reais.</h1><span>Peso, medidas e fotos privadas, sem filtros que alterem seu corpo.</span></div><div className="body-hero-actions"><Button variant="secondary" onClick={() => setPhotoOpen(true)}><Camera size={16} /> Fotos de progresso</Button><Button onClick={() => setEntryOpen(true)}><Plus size={16} /> Novo registro</Button></div></div>
    {error && <div className="body-alert is-error"><TriangleAlert size={17} />{error}</div>}
    {toast && <div className="body-alert is-success"><Check size={17} />{toast}</div>}

    <div className="body-tabs"><button className={tab === 'measurements' ? 'is-active' : ''} onClick={() => setTab('measurements')}><Scale size={16} /> Peso e medidas</button><button className={tab === 'photos' ? 'is-active' : ''} onClick={() => setTab('photos')}><Images size={16} /> Fotos privadas</button></div>

    {tab === 'measurements' ? <>
      <div className="body-summary-grid">
        <Summary icon={<Scale size={20} />} label="PESO ATUAL" value={latest ? `${formatValue(latest.weightKg)} kg` : '—'} caption={latest ? formatDateTime(latest.recordedAt) : 'Nenhum registro'} />
        <Summary icon={<Ruler size={20} />} label="GORDURA CORPORAL" value={latest?.bodyFatPercent !== null && latest?.bodyFatPercent !== undefined ? `${formatValue(latest.bodyFatPercent)}%` : 'Opcional'} caption="informado por você" />
        <VariationCard label="VARIAÇÃO SEMANAL" value={weekly} />
        <VariationCard label="VARIAÇÃO MENSAL" value={monthly} />
      </div>
      <div className="body-chart-grid">
        <Card className="body-chart-card"><header><div><small>HISTÓRICO DE PESO</small><h2>Evolução em kg</h2></div></header><BodyChart data={weightSeries} unit="kg" /></Card>
        <Card className="body-chart-card"><header><div><small>HISTÓRICO DE MEDIDAS</small><h2>{measurementLabels[metric]}</h2></div><select value={metric} onChange={(event) => setMetric(event.target.value as MeasurementKey)}>{measurementKeys.map((key) => <option key={key} value={key}>{measurementLabels[key]}</option>)}</select></header><BodyChart data={measureSeries as Array<{ date: string; value: number }>} unit="cm" /></Card>
      </div>
      <Card className="body-history"><header><div><small>REGISTROS</small><h2>Histórico corporal</h2></div><Button variant="secondary" onClick={() => setEntryOpen(true)}><Plus size={15} /> Adicionar</Button></header><div>{[...entries].reverse().map((entry) => <article key={entry.id}><span><Scale size={17} /></span><div><strong>{formatValue(entry.weightKg)} kg</strong><small><CalendarDays size={12} /> {formatDateTime(entry.recordedAt)}{entry.bodyFatPercent !== null ? ` · ${formatValue(entry.bodyFatPercent)}% gordura` : ''}</small></div><p>{entry.waistCm ? `Cintura ${formatValue(entry.waistCm)} cm` : entry.notes || 'Sem medidas adicionais'}</p><button onClick={() => void removeEntry(entry)} aria-label="Remover registro"><Trash2 size={15} /></button></article>)}{!entries.length && <Empty icon={<Scale size={30} />} title="Nenhuma medida registrada" text="Crie seu primeiro registro corporal para visualizar os gráficos." action={() => setEntryOpen(true)} />}</div></Card>
    </> : <>
      <div className="photo-security"><LockKeyhole size={21} /><div><strong>Armazenamento privado</strong><p>As fotos usam links temporários e somente sua conta pode acessá-las. O MOVELYA não aplica filtros, remodelagem ou retoques corporais.</p></div><ShieldCheck size={21} /></div>
      <Card className="photo-compare"><header><div><small>COMPARAÇÃO LADO A LADO</small><h2>Compare duas datas</h2></div><Button onClick={() => setPhotoOpen(true)}><Plus size={15} /> Nova sequência</Button></header>{photos.length ? <><div className="photo-compare-selects"><select value={leftId} onChange={(event) => setLeftId(event.target.value)}>{photos.map((photo) => <option key={photo.id} value={photo.id}>{formatDateTime(photo.takenAt)}</option>)}</select><span>comparar com</span><select value={rightId} onChange={(event) => setRightId(event.target.value)}>{photos.map((photo) => <option key={photo.id} value={photo.id}>{formatDateTime(photo.takenAt)}</option>)}</select></div><div className="photo-compare-grid">{leftPhoto && <PhotoColumn photo={leftPhoto} revealed={revealed.has(leftPhoto.id)} onReveal={() => toggleReveal(leftPhoto.id, setRevealed)} />}{rightPhoto && <PhotoColumn photo={rightPhoto} revealed={revealed.has(rightPhoto.id)} onReveal={() => toggleReveal(rightPhoto.id, setRevealed)} />}</div></> : <Empty icon={<Images size={30} />} title="Nenhuma foto de progresso" text="Adicione frente, lado e costas para iniciar uma comparação privada." action={() => setPhotoOpen(true)} />}</Card>
      {!!photos.length && <div className="photo-set-list">{photos.map((photo) => <Card key={photo.id} className="photo-set-card"><div className={`photo-set-thumbs ${photo.isBlurred && !revealed.has(photo.id) ? 'is-blurred' : ''}`}>{(['front','side','back'] as const).map((position) => <img key={position} src={photo.urls[position]} alt={`${positionLabel(position)} em ${formatDateTime(photo.takenAt)}`} />)}</div><div><small>SEQUÊNCIA PRIVADA</small><strong>{formatDateTime(photo.takenAt)}</strong><p>{photo.observation || 'Sem observação'}</p></div><footer><button onClick={() => toggleReveal(photo.id, setRevealed)}>{revealed.has(photo.id) ? <EyeOff size={14} /> : <Eye size={14} />} {revealed.has(photo.id) ? 'Ocultar agora' : 'Revelar agora'}</button><button onClick={() => void togglePrivacy(photo)}><LockKeyhole size={14} /> {photo.isBlurred ? 'Desativar desfoque padrão' : 'Ativar desfoque padrão'}</button><button onClick={() => void removePhoto(photo)}><Trash2 size={14} /> Remover</button></footer></Card>)}</div>}
    </>}

    {entryOpen && <Modal title="Registrar peso e medidas" onClose={() => setEntryOpen(false)}><form className="body-form" onSubmit={saveEntry}><div className="body-form-grid"><Field required label="Peso (kg)" type="number" inputMode="decimal" min="25" max="400" step="0.1" value={entryDraft.weightKg || ''} onChange={(event) => setEntryDraft({ ...entryDraft, weightKg: Number(event.target.value) })} /><OptionalField label="Gordura corporal (%)" value={entryDraft.bodyFatPercent} onChange={(value) => setEntryDraft({ ...entryDraft, bodyFatPercent: value })} />{measurementKeys.map((key) => <OptionalField key={key} label={`${measurementLabels[key]} (cm)`} value={entryDraft[key]} onChange={(value) => setEntryDraft({ ...entryDraft, [key]: value })} />)}</div><div className="body-date-grid"><Field required label="Data" type="date" max={localDateTime().slice(0,10)} value={entryDraft.recordedAt.slice(0,10)} onChange={(event) => setEntryDraft({ ...entryDraft, recordedAt: combineDateTime(event.target.value, entryDraft.recordedAt.slice(11,16)) })} /><Field required label="Horário" type="time" value={entryDraft.recordedAt.slice(11,16)} onChange={(event) => setEntryDraft({ ...entryDraft, recordedAt: combineDateTime(entryDraft.recordedAt.slice(0,10), event.target.value) })} /></div><label className="body-textarea"><span>Observações</span><textarea maxLength={1000} value={entryDraft.notes} onChange={(event) => setEntryDraft({ ...entryDraft, notes: event.target.value })} placeholder="Condições da medição, rotina ou observações pessoais" /></label><div className="nutrition-modal-actions"><Button variant="secondary" type="button" onClick={() => setEntryOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar registro'}</Button></div></form></Modal>}
    {photoOpen && <Modal title="Adicionar fotos de progresso" onClose={() => setPhotoOpen(false)}><form className="body-form" onSubmit={savePhotos}><div className="photo-upload-grid">{(['front','side','back'] as const).map((position) => <label key={position}><input required type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => setPhotoFiles({ ...photoFiles, [position]: event.target.files?.[0] })} /><span><Camera size={19} /></span><strong>{positionLabel(position)}</strong><small>{photoFiles[position]?.name || 'Selecionar foto'}</small></label>)}</div><p className="photo-integrity-note"><ShieldCheck size={16} /> Os arquivos originais são enviados sem filtros, remodelagem ou alterações corporais.</p><div className="body-date-grid"><Field required label="Data" type="date" max={localDateTime().slice(0,10)} value={photoDate.slice(0,10)} onChange={(event) => setPhotoDate(combineDateTime(event.target.value, photoDate.slice(11,16)))} /><Field required label="Horário" type="time" value={photoDate.slice(11,16)} onChange={(event) => setPhotoDate(combineDateTime(photoDate.slice(0,10), event.target.value))} /></div><label className="body-textarea"><span>Observação</span><textarea maxLength={1000} value={photoObservation} onChange={(event) => setPhotoObservation(event.target.value)} /></label><label className="photo-privacy-toggle"><input type="checkbox" checked={photoBlurred} onChange={(event) => setPhotoBlurred(event.target.checked)} /><span><LockKeyhole size={17} /></span><div><strong>Ocultar miniaturas por padrão</strong><small>As fotos continuam privadas mesmo com esta opção desligada.</small></div></label><div className="nutrition-modal-actions"><Button variant="secondary" type="button" onClick={() => setPhotoOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Enviando com segurança…' : 'Salvar fotos privadas'}</Button></div></form></Modal>}
  </section>
}

function BodyChart({ data, unit }: { data: Array<{ date: string; value: number }>; unit: string }) { return data.length ? <ResponsiveContainer width="100%" height={245}><AreaChart data={data} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}><defs><linearGradient id={`body-${unit}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#27d68f" stopOpacity={.3}/><stop offset="100%" stopColor="#27d68f" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#202b24" vertical={false}/><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill:'#718078', fontSize:7 }}/><YAxis domain={['dataMin - 2','dataMax + 2']} axisLine={false} tickLine={false} tick={{ fill:'#718078', fontSize:7 }}/><Tooltip formatter={(value) => [`${formatValue(Number(value))} ${unit}`, unit === 'kg' ? 'Peso' : 'Medida']} contentStyle={{ background:'#101713',border:'1px solid #26332b',borderRadius:10,fontSize:9 }}/><Area type="monotone" dataKey="value" stroke="#27d68f" strokeWidth={3} fill={`url(#body-${unit})`} /></AreaChart></ResponsiveContainer> : <div className="body-chart-empty"><Ruler size={27} /><strong>Dados insuficientes</strong><p>Adicione registros para visualizar este gráfico.</p></div> }
function Summary({ icon,label,value,caption }: { icon:React.ReactNode;label:string;value:string;caption:string }) { return <Card className="body-summary"><span>{icon}</span><small>{label}</small><strong>{value}</strong><p>{caption}</p></Card> }
function VariationCard({ label,value }: { label:string;value:number|null }) { const positive = value !== null && value > 0; return <Card className="body-summary"><span className={positive ? 'is-up' : 'is-down'}>{positive ? <ArrowUpRight size={20}/> : <ArrowDownRight size={20}/>}</span><small>{label}</small><strong>{value === null ? '—' : `${value > 0 ? '+' : ''}${formatValue(value)} kg`}</strong><p>{value === null ? 'dados insuficientes' : 'comparado ao período anterior'}</p></Card> }
function OptionalField({ label,value,onChange }: { label:string;value:number|null;onChange:(value:number|null)=>void }) { return <Field label={label} type="number" inputMode="decimal" min="0" max="300" step="0.1" value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))} /> }
function Empty({ icon,title,text,action }: { icon:React.ReactNode;title:string;text:string;action:()=>void }) { return <div className="body-empty">{icon}<strong>{title}</strong><p>{text}</p><Button onClick={action}><Plus size={15}/> Adicionar agora</Button></div> }
function PhotoColumn({ photo,revealed,onReveal }: { photo:ProgressPhotoSet;revealed:boolean;onReveal:()=>void }) { const blurred=photo.isBlurred&&!revealed; return <div className="photo-compare-column"><strong>{formatDateTime(photo.takenAt)}</strong>{(['front','side','back'] as const).map((position)=><div key={position} className={blurred?'is-blurred':''}><img src={photo.urls[position]} alt={`${positionLabel(position)} em ${formatDateTime(photo.takenAt)}`}/><span>{positionLabel(position)}</span>{blurred&&<button onClick={onReveal}><Eye size={16}/> Revelar</button>}</div>)}</div> }
function toggleReveal(id:string,setter:React.Dispatch<React.SetStateAction<Set<string>>>) { setter((current)=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next}) }
function variation(entries:BodyProgressEntry[],days:number){if(entries.length<2)return null;const latest=entries[entries.length-1];const target=new Date(latest.recordedAt).getTime()-days*86400000;const prior=[...entries].reverse().find((entry)=>new Date(entry.recordedAt).getTime()<=target);return prior?Math.round((latest.weightKg-prior.weightKg)*10)/10:null}
function positionLabel(position:PhotoPosition){return position==='front'?'Frente':position==='side'?'Lado':'Costas'}
function combineDateTime(date:string,time:string){return `${date}T${time || '12:00'}`}
function localDateTime(){const now=new Date();const offset=now.getTimezoneOffset()*60000;return new Date(now.getTime()-offset).toISOString().slice(0,16)}
function shortDate(value:string){return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(new Date(value)).replace('.','')}
function formatDateTime(value:string){return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value))}
function formatValue(value:number){return value.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}
function message(error:unknown){return error instanceof Error?error.message:'Não foi possível concluir esta ação.'}
