import { useEffect, useRef, useState, type ComponentType, type FormEvent } from 'react'
import { Activity, Bike, Check, ChevronRight, CircleStop, Clock3, CloudOff, Crosshair, Footprints, Gauge, LocateFixed, Map, MapPin, Pause, Play, RotateCcw, Route, Share2, Sparkles, TimerReset, TriangleAlert, WifiOff, X } from 'lucide-react'
import { Button, Card, Modal } from './ui'
import { outdoorActivityService, type ActivityRecord, type ActivityType, type GpsStatus, type RoutePoint } from '../services/outdoorActivityService'
import { liveActivityBridge } from '../services/liveActivityBridge'
import 'leaflet/dist/leaflet.css'

interface LiveSession {
  type: ActivityType
  startedAt: number
  pausedAt: number | null
  pausedTotalMs: number
  status: 'active' | 'paused'
  distanceKm: number
  route: RoutePoint[]
  gpsStatus: GpsStatus
  interrupted: boolean
}

const activityTypes: Array<{ id: ActivityType; label: string; description: string; outdoor: boolean; icon: ComponentType<{ size?: number }> }> = [
  { id: 'walk', label: 'Caminhada', description: 'Ritmo leve ao ar livre', outdoor: true, icon: Footprints },
  { id: 'run', label: 'Corrida', description: 'Ritmo e percurso por GPS', outdoor: true, icon: Activity },
  { id: 'treadmill', label: 'Esteira', description: 'Distância informada por você', outdoor: false, icon: Gauge },
  { id: 'bike', label: 'Bicicleta', description: 'Velocidade e trajeto por GPS', outdoor: true, icon: Bike },
  { id: 'other', label: 'Outra atividade', description: 'Registro livre de movimento', outdoor: false, icon: Sparkles },
]

const calorieRate: Record<ActivityType, number> = { walk: 4.2, run: 10.5, treadmill: 8.2, bike: 7.4, other: 5.5 }

export function OutdoorActivityTracker({ userId, startRequest = 0 }: { userId: string; startRequest?: number }) {
  const [activities, setActivities] = useState<ActivityRecord[]>([])
  const [chooserOpen, setChooserOpen] = useState(false)
  const [session, setSession] = useState<LiveSession | null>(null)
  const [recovery, setRecovery] = useState<LiveSession | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [distanceDraft, setDistanceDraft] = useState('0')
  const [observation, setObservation] = useState('')
  const [difficulty, setDifficulty] = useState(3)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<ActivityRecord | null>(null)
  const [details, setDetails] = useState<ActivityRecord | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const [backgroundWarning, setBackgroundWarning] = useState(false)
  const [now, setNow] = useState(Date.now())
  const originalTitle = useRef(typeof document === 'undefined' ? 'MOVELYA' : document.title)
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null)

  async function loadHistory() {
    try { setActivities(await outdoorActivityService.list(userId)) }
    catch (reason) { setError(message(reason)) }
  }

  useEffect(() => { void loadHistory() }, [userId])
  useEffect(() => { if (startRequest > 0 && !session) setChooserOpen(true) }, [startRequest])
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(userId))
      if (raw) setRecovery(JSON.parse(raw) as LiveSession)
    } catch { localStorage.removeItem(storageKey(userId)) }
  }, [userId])
  useEffect(() => {
    if (!session) return
    localStorage.setItem(storageKey(userId), JSON.stringify(session))
  }, [session, userId])
  useEffect(() => {
    if (!session || session.status !== 'active') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [session?.status, session?.startedAt])
  useEffect(() => {
    if (!session) { document.title = originalTitle.current; return }
    document.title = `${formatClock(elapsed(session, now))} · ${configFor(session.type).label} · MOVELYA`
    return () => { document.title = originalTitle.current }
  }, [session, now])
  useEffect(() => {
    if (!session || session.status !== 'active' || !('wakeLock' in navigator)) return
    let cancelled = false
    ;(navigator as Navigator & { wakeLock: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen')
      .then((sentinel) => { if (cancelled) void sentinel.release(); else wakeLock.current = sentinel })
      .catch(() => undefined)
    return () => { cancelled = true; void wakeLock.current?.release(); wakeLock.current = null }
  }, [session?.status, session?.startedAt])
  useEffect(() => {
    const connected = () => setOnline(true)
    const disconnected = () => setOnline(false)
    window.addEventListener('online', connected); window.addEventListener('offline', disconnected)
    return () => { window.removeEventListener('online', connected); window.removeEventListener('offline', disconnected) }
  }, [])
  useEffect(() => {
    const changed = () => {
      if (document.hidden && session?.status === 'active') setBackgroundWarning(true)
      if (!document.hidden) setNow(Date.now())
    }
    document.addEventListener('visibilitychange', changed)
    return () => document.removeEventListener('visibilitychange', changed)
  }, [session?.status])

  const needsGps = session ? isOutdoor(session.type) : false
  useEffect(() => {
    if (!session || session.status !== 'active' || !needsGps) return
    if (!('geolocation' in navigator)) {
      setSession((current) => current ? { ...current, gpsStatus: 'unavailable' } : current)
      return
    }
    setSession((current) => current && current.gpsStatus !== 'active' ? { ...current, gpsStatus: 'searching' } : current)
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const point: RoutePoint = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, recordedAt: position.timestamp }
        setSession((current) => {
          if (!current || current.status !== 'active') return current
          const previous = current.route[current.route.length - 1]
          const increment = previous ? distanceBetween(previous, point) : 0
          const secondsSincePrevious = previous ? Math.max((point.recordedAt - previous.recordedAt) / 1000, 1) : 1
          const measuredSpeed = increment / (secondsSincePrevious / 3600)
          const minimumMovement = previous ? Math.max(.003, Math.min(Math.max(previous.accuracy, point.accuracy) / 1000 * .35, .012)) : 0
          const maximumSpeed = current.type === 'bike' ? 75 : current.type === 'run' ? 32 : 16
          const accurate = point.accuracy <= 65
          const plausible = !previous || measuredSpeed <= maximumSpeed
          const moved = !previous || increment >= minimumMovement
          if (!accurate || !plausible || !moved) return { ...current, gpsStatus: accurate ? 'active' : 'searching' }
          return { ...current, route: [...current.route.slice(-1998), point], distanceKm: current.distanceKm + increment, gpsStatus: 'active' }
        })
      },
      (gpsError) => setSession((current) => current ? { ...current, gpsStatus: gpsError.code === 1 ? 'denied' : gpsError.code === 2 ? 'disabled' : 'unavailable' } : current),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [session?.status, session?.type, needsGps])

  const elapsedSeconds = session ? elapsed(session, now) : 0
  const calories = session ? Math.round(elapsedSeconds / 60 * calorieRate[session.type]) : 0
  const speed = elapsedSeconds > 0 && session ? session.distanceKm / (elapsedSeconds / 3600) : 0
  const pace = session?.distanceKm ? elapsedSeconds / session.distanceKm : null
  const liveUpdateBucket = Math.floor(elapsedSeconds / 15)

  useEffect(() => {
    if (!session || !liveActivityBridge.isAvailable()) return
    liveActivityBridge.update({ type: session.type, label: configFor(session.type).label, startedAt: session.startedAt, elapsedSeconds, distanceKm: session.distanceKm, status: session.status })
  }, [session?.status, session?.distanceKm, liveUpdateBucket])

  function start(type: ActivityType) {
    const outdoor = isOutdoor(type)
    setSession({ type, startedAt: Date.now(), pausedAt: null, pausedTotalMs: 0, status: 'active', distanceKm: 0, route: [], gpsStatus: outdoor ? 'searching' : 'not_required', interrupted: false })
    liveActivityBridge.start({ type, label: configFor(type).label, startedAt: Date.now(), elapsedSeconds: 0, distanceKm: 0, status: 'active' })
    setNow(Date.now()); setChooserOpen(false); setError(''); setBackgroundWarning(false)
  }

  function pause() { setSession((current) => current ? { ...current, status: 'paused', pausedAt: Date.now() } : current) }
  function continueActivity() {
    setSession((current) => current ? { ...current, status: 'active', pausedTotalMs: current.pausedTotalMs + (current.pausedAt ? Date.now() - current.pausedAt : 0), pausedAt: null } : current)
    setNow(Date.now())
  }
  function finish() {
    if (!session) return
    const paused = session.status === 'paused' ? session : { ...session, status: 'paused' as const, pausedAt: Date.now() }
    setSession(paused); setDistanceDraft(paused.distanceKm.toFixed(2)); setFinishing(true)
  }
  function cancelFinish() { setFinishing(false); continueActivity() }
  function adjustDistance(amount: number) { setSession((current) => current ? { ...current, distanceKm: Math.max(current.distanceKm + amount, 0) } : current) }

  async function saveActivity(event: FormEvent) {
    event.preventDefault(); if (!session) return
    if (!online) { setError('Você está sem conexão. A atividade permanece guardada neste dispositivo. Tente salvar quando a conexão voltar.'); return }
    setSaving(true); setError('')
    try {
      const durationSeconds = elapsed(session, Date.now())
      const record = await outdoorActivityService.save(userId, {
        type: session.type,
        startedAt: new Date(session.startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        durationSeconds,
        distanceKm: Number(distanceDraft),
        calories: Math.round(durationSeconds / 60 * calorieRate[session.type]),
        observation,
        difficulty,
        route: session.route,
        gpsStatus: session.gpsStatus,
        interrupted: session.interrupted,
      })
      localStorage.removeItem(storageKey(userId)); setSaved(record); setSession(null); setFinishing(false); setObservation(''); setDifficulty(3)
      liveActivityBridge.end({ type: record.type, label: configFor(record.type).label, startedAt: new Date(record.startedAt).getTime(), elapsedSeconds: record.durationSeconds, distanceKm: record.distanceKm, status: 'finished' })
      await loadHistory()
    } catch (reason) { setError(message(reason)) }
    finally { setSaving(false) }
  }

  function restore() {
    if (!recovery) return
    const restored = recovery.status === 'paused'
      ? { ...recovery, interrupted: true }
      : { ...recovery, interrupted: true, status: 'active' as const }
    setSession(restored); setNow(Date.now()); setRecovery(null); setNotice('Atividade recuperada. O cronômetro usa o horário real para preservar a duração.')
  }
  function discardRecovery() { localStorage.removeItem(storageKey(userId)); setRecovery(null) }

  async function share(activity: ActivityRecord) {
    try {
      const blob = await createShareCard(activity)
      const file = new File([blob], `movelya-${activity.id}.png`, { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ title: 'Minha atividade no MOVELYA', text: shareText(activity), files: [file] })
      else {
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = file.name; link.click(); URL.revokeObjectURL(link.href)
        setNotice('Card gerado e baixado para você compartilhar.')
      }
    } catch (reason) { if ((reason as Error)?.name !== 'AbortError') setError('Não foi possível compartilhar o card agora.') }
  }

  return <>
    {(notice || error || !online) && <div className={`activity-inline-alert ${error || !online ? 'is-error' : ''}`}>{!online ? <WifiOff size={16} /> : error ? <TriangleAlert size={16} /> : <Check size={16} />}<span>{!online ? 'Sem conexão. Você pode continuar a atividade; será necessário reconectar para salvar.' : error || notice}</span>{(notice || error) && <button onClick={() => { setNotice(''); setError('') }} aria-label="Fechar aviso"><X size={14} /></button>}</div>}

    <Card className="activity-launch-card">
      <div><span><LocateFixed size={21} /></span><div><small>CAMINHADA E CORRIDA</small><h2>Comece uma atividade</h2><p>Acompanhe seu movimento ao vivo e salve o percurso quando terminar.</p></div></div>
      <Button onClick={() => setChooserOpen(true)}><Play size={16} fill="currentColor" /> Iniciar atividade</Button>
    </Card>

    <Card className="activity-recent-card">
      <div className="steps-panel-heading"><div><small>ATIVIDADES SALVAS</small><h2>Seus últimos percursos</h2></div><span>{activities.length} registro(s)</span></div>
      <div className="activity-recent-list">
        {activities.slice(0, 5).map((item) => { const config = configFor(item.type); const Icon = config.icon; return <button key={item.id} onClick={() => setDetails(item)}><span><Icon size={18} /></span><div><strong>{config.label}</strong><small>{formatDateTime(item.startedAt)} · {formatDuration(item.durationSeconds)}</small></div><b>{formatDistance(item.distanceKm)}</b><i>{formatPace(item.averagePaceSeconds)}</i><ChevronRight size={16} /></button> })}
        {!activities.length && <div className="activity-recent-empty"><MapPin size={23} /><span>Suas caminhadas e corridas salvas aparecerão aqui.</span></div>}
      </div>
    </Card>

    {chooserOpen && <Modal title="Escolha sua atividade" onClose={() => setChooserOpen(false)}><div className="activity-type-grid">{activityTypes.map(({ id, label, description, outdoor, icon: Icon }) => <button key={id} onClick={() => start(id)}><span><Icon size={22} /></span><div><strong>{label}</strong><small>{description}</small>{outdoor && <i><LocateFixed size={11} /> usa GPS</i>}</div><ChevronRight size={16} /></button>)}</div><div className="activity-gps-note"><LocateFixed size={16} /><p><strong>Atividades ao ar livre</strong> solicitam sua localização somente durante o percurso. Você pode continuar sem GPS, mas distância e mapa não serão automáticos.</p></div></Modal>}

    {recovery && !session && <Modal title="Atividade interrompida" onClose={() => undefined}><div className="activity-recovery"><span><RotateCcw size={27} /></span><h3>Encontramos uma atividade não finalizada.</h3><p>Isso pode acontecer quando o aplicativo é fechado inesperadamente ou o aparelho reinicia. Você pode continuar do ponto salvo ou descartar.</p><div><Button variant="secondary" onClick={discardRecovery}>Descartar</Button><Button onClick={restore}><Play size={15} /> Continuar atividade</Button></div></div></Modal>}

    {session && <div className="activity-live" role="dialog" aria-modal="true" aria-label={`Atividade em andamento: ${configFor(session.type).label}`}>
      <div className="activity-live__glow" />
      <header><div><small>ATIVIDADE EM ANDAMENTO</small><h1>{configFor(session.type).label}</h1></div><span className={session.status === 'paused' ? 'is-paused' : ''}><i /> {session.status === 'paused' ? 'Pausada' : 'Gravando'}</span></header>
      <main>
        {(!online || backgroundWarning || gpsMessage(session.gpsStatus)) && <div className="activity-live-warning">{!online ? <CloudOff /> : session.gpsStatus === 'active' ? <TimerReset /> : <LocateFixed />}<div><strong>{!online ? 'Sem conexão' : backgroundWarning ? 'Atividade retomada em primeiro plano' : gpsTitle(session.gpsStatus)}</strong><p>{!online ? 'O cronômetro e o GPS continuam funcionando. Reconecte antes de salvar.' : backgroundWarning ? 'O tempo foi preservado. Em alguns aparelhos, o GPS pode ter sido limitado enquanto o app estava em segundo plano.' : gpsMessage(session.gpsStatus)}</p></div>{backgroundWarning && <button onClick={() => setBackgroundWarning(false)}><X size={14} /></button>}</div>}
        <section className="activity-live-time"><small>TEMPO</small><strong>{formatClock(elapsedSeconds)}</strong><span>{formatDateTime(new Date(session.startedAt).toISOString())}</span></section>
        <section className="activity-live-metrics">
          <LiveMetric icon={Route} label="Distância" value={formatDistance(session.distanceKm)} />
          <LiveMetric icon={TimerReset} label="Ritmo" value={formatPace(pace)} />
          <LiveMetric icon={Gauge} label="Velocidade" value={`${speed.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km/h`} />
          <LiveMetric icon={Sparkles} label="Calorias" value={`${calories} kcal`} />
        </section>
        {!needsGps && <div className="activity-distance-adjust"><span>Atualizar distância</span><button onClick={() => adjustDistance(.1)}>+ 0,1 km</button><button onClick={() => adjustDistance(.5)}>+ 0,5 km</button></div>}
        <MapPreview route={session.route} live gpsStatus={session.gpsStatus} />
      </main>
      <footer>{session.status === 'active' ? <Button variant="secondary" onClick={pause}><Pause size={18} fill="currentColor" /> Pausar</Button> : <Button onClick={continueActivity}><Play size={18} fill="currentColor" /> Continuar</Button>}<Button className="activity-finish-button" onClick={finish}><CircleStop size={19} /> Finalizar</Button></footer>
    </div>}

    {finishing && session && <Modal title="Finalizar atividade" onClose={cancelFinish}><form className="activity-finish-form" onSubmit={saveActivity}><div className="activity-finish-summary"><span><Clock3 /> <small>Tempo</small><strong>{formatDuration(elapsed(session, Date.now()))}</strong></span><span><Route /> <small>Distância</small><strong>{formatDistance(Number(distanceDraft))}</strong></span><span><Sparkles /> <small>Estimativa</small><strong>{Math.round(elapsed(session, Date.now()) / 60 * calorieRate[session.type])} kcal</strong></span></div><label className="field"><span>Distância final (km)</span><input required type="number" min="0" max="1000" step="0.01" value={distanceDraft} onChange={(event) => setDistanceDraft(event.target.value)} /></label><label className="activity-textarea"><span>Observação</span><textarea maxLength={1000} value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="Como foi a atividade? Clima, terreno, sensação…" /></label><fieldset className="activity-difficulty"><legend>Dificuldade percebida</legend><div>{[1,2,3,4,5].map((value) => <button type="button" key={value} className={difficulty === value ? 'is-selected' : ''} onClick={() => setDifficulty(value)}><b>{value}</b><small>{difficultyLabel(value)}</small></button>)}</div></fieldset><MapPreview route={session.route} gpsStatus={session.gpsStatus} /><div className="nutrition-modal-actions"><Button variant="secondary" type="button" onClick={cancelFinish}>Voltar à atividade</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar atividade'}</Button></div></form></Modal>}

    {(saved || details) && <ActivityDetails activity={(saved ?? details)!} previous={previousComparable((saved ?? details)!, activities)} onClose={() => { setSaved(null); setDetails(null) }} onShare={() => void share((saved ?? details)!)} justSaved={Boolean(saved)} />}
  </>
}

function LiveMetric({ icon: Icon, label, value }: { icon: ComponentType<{ size?: number }>; label: string; value: string }) { return <div><span><Icon size={18} /></span><small>{label}</small><strong>{value}</strong></div> }

function ActivityDetails({ activity, previous, onClose, onShare, justSaved }: { activity: ActivityRecord; previous: ActivityRecord | null; onClose: () => void; onShare: () => void; justSaved: boolean }) {
  return <Modal title={justSaved ? 'Atividade salva!' : 'Detalhes da atividade'} onClose={onClose}><div className="activity-details">{justSaved && <div className="activity-saved-title"><span><Check size={22} /></span><div><small>TUDO CERTO</small><h3>{configFor(activity.type).label} concluída</h3></div></div>}<div className="activity-share-card"><small>MOVELYA · {configFor(activity.type).label.toUpperCase()}</small><h3>{formatDistance(activity.distanceKm)}</h3><div><span><b>{formatDuration(activity.durationSeconds)}</b><small>tempo</small></span><span><b>{formatPace(activity.averagePaceSeconds)}</b><small>ritmo</small></span><span><b>{activity.calories} kcal</b><small>estimativa</small></span></div></div><MapPreview route={activity.route} gpsStatus={activity.gpsStatus} />{activity.observation && <div className="activity-observation"><small>SUA OBSERVAÇÃO</small><p>{activity.observation}</p></div>}<div className="activity-detail-meta"><span>Dificuldade <b>{activity.difficulty}/5 · {difficultyLabel(activity.difficulty)}</b></span>{activity.interrupted && <span>Esta atividade foi recuperada após uma interrupção.</span>}</div><Comparison current={activity} previous={previous} /><div className="nutrition-modal-actions"><Button variant="secondary" onClick={onClose}>Fechar</Button><Button onClick={onShare}><Share2 size={15} /> Compartilhar card</Button></div></div></Modal>
}

function Comparison({ current, previous }: { current: ActivityRecord; previous: ActivityRecord | null }) {
  if (!previous) return <div className="activity-comparison"><small>COMPARAÇÃO</small><strong>Primeira {configFor(current.type).label.toLowerCase()} salva</strong><p>Na próxima atividade, mostraremos a evolução de distância, ritmo e duração.</p></div>
  const distanceDelta = percentageDelta(current.distanceKm, previous.distanceKm)
  const paceDelta = current.averagePaceSeconds && previous.averagePaceSeconds ? percentageDelta(previous.averagePaceSeconds, current.averagePaceSeconds) : null
  return <div className="activity-comparison"><small>COMPARAÇÃO COM A ANTERIOR</small><div><span><b>{signed(distanceDelta)}</b><small>distância</small></span><span><b>{paceDelta === null ? '—' : signed(paceDelta)}</b><small>ritmo</small></span><span><b>{signed(percentageDelta(current.durationSeconds, previous.durationSeconds))}</b><small>duração</small></span></div><p>Comparado com {formatDateTime(previous.startedAt)}.</p></div>
}

function MapPreview({ route, gpsStatus, live = false }: { route: RoutePoint[]; gpsStatus: GpsStatus; live?: boolean }) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<import('leaflet').Map | null>(null)
  const routeLayer = useRef<import('leaflet').LayerGroup | null>(null)
  const leaflet = useRef<typeof import('leaflet') | null>(null)
  const lastCenteredPoint = useRef(0)

  useEffect(() => {
    if (!container.current || map.current || !route.length) return
    let cancelled = false
    void import('leaflet').then((module) => {
      if (cancelled || !container.current) return
      const L = module
      const latest = route[route.length - 1]
      leaflet.current = module
      const instance = L.map(container.current, { zoomControl: true, attributionControl: true }).setView([latest.latitude, latest.longitude], 17)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(instance)
      routeLayer.current = L.layerGroup().addTo(instance)
      map.current = instance
      drawRoute(L, instance, routeLayer.current, route, live)
      window.setTimeout(() => instance.invalidateSize(), 80)
    })
    return () => { cancelled = true; map.current?.remove(); map.current = null; routeLayer.current = null; leaflet.current = null }
  }, [Boolean(route.length)])

  useEffect(() => {
    const L = leaflet.current
    if (!L || !map.current || !routeLayer.current || !route.length) return
    drawRoute(L, map.current, routeLayer.current, route, live)
    const latest = route[route.length - 1]
    if (live && latest.recordedAt !== lastCenteredPoint.current) {
      map.current.panTo([latest.latitude, latest.longitude], { animate: true })
      lastCenteredPoint.current = latest.recordedAt
    }
  }, [route, live])

  function recenter() {
    const latest = route[route.length - 1]
    if (latest && map.current) map.current.setView([latest.latitude, latest.longitude], Math.max(map.current.getZoom(), 17), { animate: true })
  }

  const latest = route[route.length - 1]
  return <div className={`activity-map ${route.length ? 'has-route' : ''}`}>
    {route.length ? <div ref={container} className="activity-map-canvas" /> : <><div className="activity-map-grid" /><div className="activity-map-empty"><Map size={26} /><strong>{gpsStatus === 'not_required' ? 'Atividade sem percurso GPS' : gpsStatus === 'denied' ? 'Localização não permitida' : gpsStatus === 'disabled' ? 'GPS indisponível ou desativado' : 'Aguardando localização precisa'}</strong><p>{gpsStatus === 'denied' ? 'Permita a localização nas configurações do navegador para registrar o próximo mapa.' : 'O primeiro ponto aparece quando a precisão estiver melhor que 65 metros.'}</p></div></>}
    <span><MapPin size={12} /> {live ? 'Mapa ao vivo' : 'Mapa do percurso'}{latest && ` · precisão ±${Math.round(latest.accuracy)} m`}</span>
    {route.length > 0 && <button className="activity-map-recenter" type="button" onClick={recenter} aria-label="Centralizar na localização atual"><Crosshair size={15} /></button>}
  </div>
}

function drawRoute(L: typeof import('leaflet'), map: import('leaflet').Map, group: import('leaflet').LayerGroup, route: RoutePoint[], live: boolean) {
  group.clearLayers()
  const coordinates = route.map((point): [number, number] => [point.latitude, point.longitude])
  if (!coordinates.length) return
  if (coordinates.length > 1) L.polyline(coordinates, { color: '#27d68f', weight: 5, opacity: .95, lineCap: 'round', lineJoin: 'round' }).addTo(group)
  const first = route[0]
  const latest = route[route.length - 1]
  L.circleMarker([first.latitude, first.longitude], { radius: 6, color: '#07100b', weight: 2, fillColor: '#e2a358', fillOpacity: 1 }).bindTooltip('Início').addTo(group)
  L.circle([latest.latitude, latest.longitude], { radius: Math.max(latest.accuracy, 5), color: '#27d68f', weight: 1, opacity: .25, fillColor: '#27d68f', fillOpacity: .07 }).addTo(group)
  L.circleMarker([latest.latitude, latest.longitude], { radius: 7, color: '#07100b', weight: 3, fillColor: '#27d68f', fillOpacity: 1 }).bindTooltip(live ? 'Você está aqui' : 'Fim').addTo(group)
  if (!live && coordinates.length > 1) map.fitBounds(L.latLngBounds(coordinates), { padding: [28, 28], maxZoom: 17 })
}

function elapsed(session: LiveSession, reference: number) { const end = session.status === 'paused' && session.pausedAt ? session.pausedAt : reference; return Math.max(1, Math.floor((end - session.startedAt - session.pausedTotalMs) / 1000)) }
function isOutdoor(type: ActivityType) { return type === 'walk' || type === 'run' || type === 'bike' }
function configFor(type: ActivityType) { return activityTypes.find((item) => item.id === type)! }
function storageKey(userId: string) { return `movelya-active-activity-${userId}` }
function message(reason: unknown) { return reason instanceof Error ? reason.message : 'Não foi possível concluir esta ação.' }
function formatDistance(value: number) { return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km` }
function formatDuration(seconds: number) { const hours = Math.floor(seconds / 3600); const minutes = Math.floor(seconds % 3600 / 60); const rest = Math.floor(seconds % 60); return hours ? `${hours}h ${minutes.toString().padStart(2, '0')}min` : `${minutes}min ${rest.toString().padStart(2, '0')}s` }
function formatClock(seconds: number) { const hours = Math.floor(seconds / 3600); const minutes = Math.floor(seconds % 3600 / 60); const rest = Math.floor(seconds % 60); return [hours, minutes, rest].map((value) => value.toString().padStart(2, '0')).join(':') }
function formatPace(seconds: number | null) { if (!seconds || !Number.isFinite(seconds)) return '—'; const minutes = Math.floor(seconds / 60); const rest = Math.round(seconds % 60); return `${minutes}:${rest.toString().padStart(2, '0')} /km` }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)).replace('.', '') }
function difficultyLabel(value: number) { return ['Muito leve', 'Leve', 'Moderada', 'Difícil', 'Máxima'][value - 1] }
function percentageDelta(current: number, previous: number) { return previous > 0 ? Math.round((current - previous) / previous * 100) : 0 }
function signed(value: number) { return `${value > 0 ? '+' : ''}${value}%` }
function previousComparable(current: ActivityRecord, activities: ActivityRecord[]) { return activities.find((item) => item.type === current.type && item.id !== current.id && new Date(item.startedAt) < new Date(current.startedAt)) ?? null }
function gpsTitle(status: GpsStatus) { return status === 'searching' ? 'Buscando sinal de GPS' : status === 'denied' ? 'Permissão de localização negada' : status === 'disabled' ? 'GPS desativado ou sem sinal' : 'GPS indisponível' }
function gpsMessage(status: GpsStatus) { if (status === 'active' || status === 'not_required') return ''; if (status === 'searching') return 'Vá para uma área aberta. Você pode iniciar enquanto buscamos sua localização.'; if (status === 'denied') return 'A atividade continua sem mapa. Altere a permissão do navegador para usar o GPS.'; if (status === 'disabled') return 'Ative a localização do aparelho. O tempo continuará sendo registrado.'; return 'Não conseguimos acessar sua localização. Você ainda pode registrar tempo e distância manualmente.' }

function distanceBetween(a: RoutePoint, b: RoutePoint) { const radius = 6371; const lat = degrees(b.latitude - a.latitude); const lon = degrees(b.longitude - a.longitude); const value = Math.sin(lat / 2) ** 2 + Math.cos(degrees(a.latitude)) * Math.cos(degrees(b.latitude)) * Math.sin(lon / 2) ** 2; return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)) }
function degrees(value: number) { return value * Math.PI / 180 }
function shareText(activity: ActivityRecord) { return `${configFor(activity.type).label} no MOVELYA · ${formatDistance(activity.distanceKm)} · ${formatDuration(activity.durationSeconds)} · ${formatPace(activity.averagePaceSeconds)}` }

async function createShareCard(activity: ActivityRecord) {
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1080
  const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas indisponível')
  const gradient = context.createLinearGradient(0, 0, 1080, 1080); gradient.addColorStop(0, '#07100b'); gradient.addColorStop(1, '#102a1d'); context.fillStyle = gradient; context.fillRect(0, 0, 1080, 1080)
  context.fillStyle = '#27d68f'; context.font = '700 34px sans-serif'; context.fillText('MOVELYA', 80, 105)
  context.fillStyle = '#8ca398'; context.font = '500 28px sans-serif'; context.fillText(configFor(activity.type).label.toUpperCase(), 80, 185)
  context.fillStyle = '#f4f8f6'; context.font = '800 132px sans-serif'; context.fillText(formatDistance(activity.distanceKm), 75, 400)
  context.strokeStyle = '#244134'; context.lineWidth = 2; context.beginPath(); context.moveTo(80, 475); context.lineTo(1000, 475); context.stroke()
  const stats = [[formatDuration(activity.durationSeconds), 'TEMPO'], [formatPace(activity.averagePaceSeconds), 'RITMO'], [`${Math.round(activity.calories)} kcal`, 'CALORIAS']]
  stats.forEach(([value, label], index) => { const x = 80 + index * 315; context.fillStyle = '#eff6f2'; context.font = '700 42px sans-serif'; context.fillText(value, x, 610); context.fillStyle = '#719082'; context.font = '600 20px sans-serif'; context.fillText(label, x, 650) })
  context.fillStyle = '#27d68f'; context.beginPath(); context.arc(915, 875, 82, 0, Math.PI * 2); context.fill(); context.fillStyle = '#052519'; context.font = '800 54px sans-serif'; context.textAlign = 'center'; context.fillText(`${activity.difficulty}/5`, 915, 892); context.textAlign = 'left'
  context.fillStyle = '#8ca398'; context.font = '500 25px sans-serif'; context.fillText('Seu movimento, no seu ritmo.', 80, 950)
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem')), 'image/png'))
}
