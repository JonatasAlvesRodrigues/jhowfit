import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Award, Check, ChevronRight, Crown, Droplets, Dumbbell, Flame, Footprints, Goal, LoaderCircle, LockKeyhole, Medal, Send, Share2, Sparkles, Star, Target, Trophy, X } from 'lucide-react'
import { achievementService, type Achievement, type AchievementIcon, type AchievementSummary } from '../services/achievementService'
import { communityService } from '../services/communityService'
import { createAchievementShareImage } from '../services/achievementShareService'

const icons: Record<AchievementIcon, typeof Sparkles> = { spark: Sparkles, five: Dumbbell, steps: Footprints, water: Droplets, record: Trophy, month: Crown, goal: Goal }

export function AchievementsPage({ userId }: { userId: string }) {
  const [summary, setSummary] = useState<AchievementSummary | null>(null)
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'progress'>('all')
  const [error, setError] = useState('')
  const [celebration, setCelebration] = useState<Achievement | null>(null)
  const [shareAchievement, setShareAchievement] = useState<Achievement | null>(null)

  useEffect(() => {
    let active = true
    achievementService.load(userId).then((data) => {
      if (!active) return
      setSummary(data)
      const recent = [...data.achievements].reverse().find((item) => item.unlockedAt && Date.now() - new Date(item.unlockedAt).getTime() < 86400000)
      if (recent) setCelebration(recent)
    }).catch(() => active && setError('Não foi possível carregar suas conquistas agora. Tente novamente em instantes.'))
    return () => { active = false }
  }, [userId])

  const visible = useMemo(() => summary?.achievements.filter((item) => filter === 'all' || (filter === 'unlocked' ? item.unlocked : !item.unlocked)) ?? [], [summary, filter])

  if (error) return <div className="achievement-state"><Award size={28} /><h1>Suas conquistas estão a salvo</h1><p>{error}</p></div>
  if (!summary) return <div className="achievement-loading" aria-label="Carregando conquistas"><span /><span /><span /></div>

  const unlocked = summary.achievements.filter((item) => item.unlocked).sort((a, b) => String(b.unlockedAt).localeCompare(String(a.unlockedAt)))
  const next = summary.achievements.filter((item) => !item.unlocked).sort((a, b) => (b.progress / b.target) - (a.progress / a.target))[0]
  const levelPercent = Math.min(100, (summary.currentLevelXp / summary.nextLevelXp) * 100)
  const shareable = unlocked[0] ?? null

  return <div className="achievements-page">
    {celebration && <aside className="achievement-unlock" role="status">
      <span><Sparkles size={18} /></span><div><small>CONQUISTA DESBLOQUEADA</small><strong>{celebration.title}</strong><p>+{celebration.xp} XP · Seu progresso continua com você.</p></div>
      <button onClick={() => setCelebration(null)} aria-label="Fechar celebração"><X size={16} /></button>
      <button className="achievement-unlock__share" onClick={() => setShareAchievement(celebration)}><Share2 size={14} /> Compartilhar</button>
    </aside>}

    <header className="achievement-hero">
      <div className="achievement-hero__copy"><span className="page-eyebrow">CONQUISTAS E CONSISTÊNCIA</span><h1>Seu ritmo merece ser celebrado.</h1><p>Cada movimento conta. Pausas fazem parte — suas medalhas e seu progresso nunca são perdidos.</p></div>
      <div className="level-medallion"><span><Crown size={25} /></span><small>NÍVEL {summary.level}</small><strong>{summary.levelName}</strong></div>
    </header>

    {shareable && <section className="achievement-quick-share">
      <span className="achievement-quick-share__icon"><Share2 size={20} /></span>
      <div><small>COMUNIDADE</small><strong>Compartilhe sua conquista</strong><p>{shareable.title} · seu card é criado na hora.</p></div>
      <button onClick={() => setShareAchievement(shareable)}><span>Compartilhar</span><Send size={16} /></button>
    </section>}

    <section className="achievement-overview">
      <div className="xp-card">
        <div className="xp-card__top"><span><Star size={18} /></span><div><small>SUA JORNADA</small><h2>{summary.xp.toLocaleString('pt-BR')} XP acumulados</h2></div><b>Nível {summary.level}</b></div>
        <div className="xp-track"><i style={{ width: `${levelPercent}%` }} /></div>
        <div className="xp-card__footer"><span>{summary.currentLevelXp} XP neste nível</span><span>{summary.level === 5 ? 'Nível máximo alcançado' : `${summary.nextLevelXp - summary.currentLevelXp} XP para o próximo`}</span></div>
      </div>
      <div className="streak-card"><span><Flame size={23} /></span><div><small>SEQUÊNCIA ATUAL</small><strong>{summary.streak} dias</strong><p>Se você pausar, recomeça quando quiser. Nada é perdido.</p></div></div>
    </section>

    <section className="consistency-grid" aria-label="Resumo de consistência">
      <Metric icon={Target} value={`${summary.activeDays}/30`} label="Dias ativos" note="nos últimos 30 dias" />
      <Metric icon={Award} value={`${summary.consistency}%`} label="Consistência" note="no período observado" />
      <Metric icon={Trophy} value={`${summary.bestWeek} dias`} label="Melhor semana" note="seu melhor ritmo" />
      <Metric icon={Sparkles} value={`${summary.evolution >= 0 ? '+' : ''}${summary.evolution}%`} label="Evolução acumulada" note="comparada aos 30 dias anteriores" positive={summary.evolution >= 0} />
    </section>

    {next && <section className="next-achievement">
      <span className="next-achievement__icon"><Medal size={23} /></span><div><small>PRÓXIMA CONQUISTA</small><h3>{next.title}</h3><p>{next.description}</p><div className="mini-progress"><i style={{ width: `${Math.min(100, next.progress / next.target * 100)}%` }} /></div></div>
      <strong>{formatProgress(next)}</strong><ChevronRight size={18} />
    </section>}

    <section className="achievement-section">
      <div className="achievement-section__heading"><div><small>COLEÇÃO</small><h2>Suas medalhas</h2><p>{unlocked.length} de {summary.achievements.length} desbloqueadas</p></div><div className="achievement-filters" role="group" aria-label="Filtrar medalhas">
        <button className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>Todas</button>
        <button className={filter === 'unlocked' ? 'is-active' : ''} onClick={() => setFilter('unlocked')}>Conquistadas</button>
        <button className={filter === 'progress' ? 'is-active' : ''} onClick={() => setFilter('progress')}>Em progresso</button>
      </div></div>
      <div className="medal-grid">{visible.map((item) => <MedalCard achievement={item} key={item.id} onShare={() => setShareAchievement(item)} />)}</div>
    </section>

    <section className="achievement-bottom-grid">
      <div className="achievement-history"><div className="achievement-section__heading"><div><small>LINHA DO TEMPO</small><h2>Histórico de conquistas</h2></div></div>
        {unlocked.length ? <div className="history-list">{unlocked.map((item) => { const Icon = icons[item.icon]; return <article key={item.id}><span><Icon size={17} /></span><div><strong>{item.title}</strong><small>{formatDate(item.unlockedAt)}</small></div><b>+{item.xp} XP</b></article>})}</div> : <p className="empty-history">Sua primeira conquista já está a caminho.</p>}
      </div>
      <div className="accumulated-card"><small>EVOLUÇÃO ACUMULADA</small><h2>O que você já construiu</h2><div><span><Dumbbell size={17} /><b>{summary.totals.workouts}</b><small>treinos</small></span><span><Footprints size={17} /><b>{compact(summary.totals.steps)}</b><small>passos</small></span><span><Droplets size={17} /><b>{summary.totals.waterLiters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</b><small>de água</small></span></div><p><Check size={15} /> Toda atividade soma. Nenhuma pausa apaga o caminho percorrido.</p></div>
    </section>
    {shareAchievement && <AchievementShareModal userId={userId} achievement={shareAchievement} displayName={summary.displayName} onClose={() => setShareAchievement(null)} />}
  </div>
}

function Metric({ icon: Icon, value, label, note, positive }: { icon: typeof Target; value: string; label: string; note: string; positive?: boolean }) {
  return <article className="consistency-card"><span><Icon size={18} /></span><div><strong className={positive ? 'is-positive' : ''}>{value}</strong><b>{label}</b><small>{note}</small></div></article>
}

function MedalCard({ achievement, onShare }: { achievement: Achievement; onShare: () => void }) {
  const Icon = icons[achievement.icon]
  return <article className={`medal-card ${achievement.unlocked ? 'is-unlocked' : ''}`}>
    <div className="medal-card__top"><span className="medal-icon"><Icon size={25} /></span>{achievement.unlocked ? <i><Check size={12} /> Conquistada</i> : <i className="is-locked"><LockKeyhole size={11} /> Em progresso</i>}</div>
    <small>+{achievement.xp} XP</small><h3>{achievement.title}</h3><p>{achievement.description}</p>
    {achievement.unlocked ? <><time dateTime={achievement.unlockedAt ?? undefined}>{formatDate(achievement.unlockedAt)}</time><button className="medal-card__share" onClick={onShare}><Share2 size={13} /> Compartilhar</button></> : <><div className="mini-progress"><i style={{ width: `${Math.min(100, achievement.progress / achievement.target * 100)}%` }} /></div><time>{formatProgress(achievement)}</time></>}
  </article>
}

function AchievementShareModal({ userId, achievement, displayName, onClose }: { userId: string; achievement: Achievement; displayName: string; onClose: () => void }) {
  const [caption, setCaption] = useState('')
  const [status, setStatus] = useState<'idle' | 'creating' | 'publishing' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function publish() {
    if (status === 'creating' || status === 'publishing') return
    setStatus('creating'); setMessage('Montando seu card de conquista…')
    try {
      const image = await createAchievementShareImage(achievement, displayName)
      setStatus('publishing'); setMessage('Publicando na Comunidade…')
      await communityService.createPost({ userId, type: 'achievement', caption: caption.trim(), activityId: null, image })
      URL.revokeObjectURL(image.previewUrl)
      setStatus('success'); setMessage('Conquista compartilhada na Comunidade.')
    } catch (cause) {
      setStatus('error'); setMessage(cause instanceof Error ? cause.message : 'Não foi possível compartilhar agora. Tente novamente.')
    }
  }

  if (typeof document === 'undefined') return null
  return createPortal(<div className="achievement-share-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && status !== 'publishing' && onClose()}>
    <section className="achievement-share-modal" role="dialog" aria-modal="true" aria-labelledby="achievement-share-title">
      <button className="achievement-share-modal__close" onClick={onClose} disabled={status === 'creating' || status === 'publishing'} aria-label="Fechar"><X size={18} /></button>
      <div className="achievement-share-modal__badge"><Trophy size={20} /></div>
      <small>COMPARTILHAR CONQUISTA</small><h2 id="achievement-share-title">{achievement.title}</h2>
      <p>Vamos criar um card exclusivo para a Comunidade. Ele só será publicado quando você confirmar.</p>
      <label>Legenda opcional <span>{caption.length}/280</span><textarea value={caption} maxLength={280} onChange={(event) => setCaption(event.target.value)} placeholder="Conte como foi chegar até aqui…" disabled={status === 'creating' || status === 'publishing'} /></label>
      {message && <p className={`achievement-share-modal__message is-${status}`} role="status">{(status === 'creating' || status === 'publishing') && <LoaderCircle size={15} />} {message}</p>}
      {status === 'success' ? <button className="achievement-share-modal__action" onClick={onClose}><Check size={17} /> Pronto</button> : <button className="achievement-share-modal__action" onClick={publish} disabled={status === 'creating' || status === 'publishing'}>{(status === 'creating' || status === 'publishing') ? <LoaderCircle size={17} /> : <Send size={17} />} Compartilhar na Comunidade</button>}
      {status !== 'success' && <button className="achievement-share-modal__cancel" onClick={onClose} disabled={status === 'creating' || status === 'publishing'}>Agora não</button>}
    </section>
  </div>, document.body)
}

function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Conquistada' }
function formatProgress(item: Achievement) { return `${item.progress.toLocaleString('pt-BR')} de ${item.target.toLocaleString('pt-BR')} ${item.unit}` }
function compact(value: number) { return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value) }
