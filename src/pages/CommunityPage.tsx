import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Dumbbell, Ellipsis, Flame, Footprints, Heart, LoaderCircle, Medal, MessageCircle, Salad, Search, Send, Trophy, UserRound, UsersRound, X } from 'lucide-react'
import { communityService, type CommunityComment, type CommunityData, type CommunityPost, type CommunityPostType, type CommunityProfileSearchResult, type CommunityRankingCategory, type CommunityRankingData, type CommunityRankingScope } from '../services/communityService'
import { CreateCommunityPostModal } from '../components/CreateCommunityPostModal'
import { CommunityClubsPanel } from '../components/CommunityClubsPanel'
import '../community.css'

type CommunityTab = 'feed' | 'ranking' | 'clubs'

export function CommunityPage({ userId, onNavigate }: { userId: string; onNavigate: (path: string) => void }) {
  const [data, setData] = useState<CommunityData | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<CommunityTab>('feed')
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CommunityProfileSearchResult[]>([])
  const [searchingProfiles, setSearchingProfiles] = useState(false)
  const [notice, setNotice] = useState('')
  const [composerType, setComposerType] = useState<CommunityPostType | null>(null)
  const [pendingLikes, setPendingLikes] = useState<Record<string, boolean>>({})
  const pendingLikeIds = useRef(new Set<string>())

  useEffect(() => {
    let mounted = true
    communityService.load(userId).then((result) => mounted && setData(result)).catch(() => mounted && setError('Não foi possível atualizar a comunidade agora.'))
    return () => { mounted = false }
  }, [userId])

  useEffect(() => {
    const term = query.trim()
    if (term.replace(/^@/, '').length < 2) { setSearchResults([]); setSearchingProfiles(false); return }
    let active = true
    const timer = window.setTimeout(() => {
      setSearchingProfiles(true)
      communityService.searchProfiles(term).then((items) => active && setSearchResults(items)).catch(() => active && setSearchResults([])).finally(() => active && setSearchingProfiles(false))
    }, 230)
    return () => { active = false; window.clearTimeout(timer) }
  }, [query])

  const visiblePosts = useMemo(() => data?.posts.filter((post) => {
    const term = query.trim().toLocaleLowerCase('pt-BR')
    return !term || post.caption.toLocaleLowerCase('pt-BR').includes(term) || post.profile.name.toLocaleLowerCase('pt-BR').includes(term)
  }) ?? [], [data?.posts, query])

  async function toggleLike(post: CommunityPost) {
    if (pendingLikeIds.current.has(post.id)) return
    const optimistic = { ...post, likedByMe: !post.likedByMe, likes: Math.max(0, post.likes + (post.likedByMe ? -1 : 1)) }
    pendingLikeIds.current.add(post.id)
    setPendingLikes((items) => ({ ...items, [post.id]: true }))
    setData((current) => current ? { ...current, posts: current.posts.map((item) => item.id === post.id ? optimistic : item) } : current)
    try {
      const updated = await communityService.toggleLike(post, userId)
      setData((current) => current ? { ...current, posts: current.posts.map((item) => item.id === post.id ? updated : item) } : current)
    } catch {
      setData((current) => current ? { ...current, posts: current.posts.map((item) => item.id === post.id ? post : item) } : current)
      setNotice('Não foi possível registrar sua curtida agora.')
    } finally {
      pendingLikeIds.current.delete(post.id)
      setPendingLikes((items) => { const next = { ...items }; delete next[post.id]; return next })
    }
  }

  function retry() { setError(''); setData(null); communityService.load(userId).then(setData).catch(() => setError('Não foi possível atualizar a comunidade agora.')) }

  if (error) return <section className="community-state"><UsersRound size={28} /><h1>Comunidade indisponível</h1><p>{error}</p><button onClick={retry}>Tentar novamente</button></section>

  return <section className="community-page">
    <header className="community-heading">
      <div><span className="page-eyebrow">EM MOVIMENTO</span><h1>Comunidade</h1><p>Troque inspiração por consistência, no seu ritmo.</p></div>
      <div className="community-heading-actions"><button className="community-my-profile" onClick={() => onNavigate(`/perfil-social?user=${encodeURIComponent(userId)}`)}><UserRound size={16} /><span>Meu perfil</span></button><button className={`community-search ${searchOpen ? 'is-open' : ''}`} onClick={() => setSearchOpen((value) => !value)} aria-label={searchOpen ? 'Fechar pesquisa' : 'Pesquisar na comunidade'}>{searchOpen ? <X size={18} /> : <Search size={18} />}<span>Pesquisar</span></button></div>
    </header>

    {searchOpen && <div className="community-search-wrap"><label className="community-search-field"><Search size={16} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Publicação ou @usuário" /><button onClick={() => setQuery('')} aria-label="Limpar pesquisa"><X size={14} /></button></label>{(searchingProfiles || searchResults.length > 0) && <div className="community-profile-search-results">{searchingProfiles ? <span><LoaderCircle size={14} className="is-spinning" /> Buscando perfis…</span> : searchResults.map((item) => <button key={item.userId} onClick={() => onNavigate(`/perfil-social?user=${encodeURIComponent(item.userId)}`)}><i>{item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : item.name.slice(0, 1)}</i><span><strong>{item.name}</strong><small>@{item.username}{item.isPrivate ? ' · perfil privado' : ''}</small></span></button>)}</div>}</div>}
    <div className="community-tabs" role="tablist" aria-label="Seções da comunidade"><Tab label="Feed" active={tab === 'feed'} onClick={() => setTab('feed')} /><Tab label="Ranking" active={tab === 'ranking'} onClick={() => setTab('ranking')} /><Tab label="Clubes" active={tab === 'clubs'} onClick={() => setTab('clubs')} /></div>

    {!data ? <CommunityLoading /> : <>
      {tab === 'feed' && <>
        <section className="community-summary" aria-label="Seu resumo na comunidade">
          <SummaryCard icon={Flame} label="Sua sequência" value={data.summary.streak ? `${data.summary.streak} ${data.summary.streak === 1 ? 'dia' : 'dias'}` : 'Comece hoje'} tone="orange" />
          <SummaryCard icon={Medal} label="Maior sequência" value={`${data.summary.bestStreak} ${data.summary.bestStreak === 1 ? 'dia' : 'dias'}`} tone="orange" />
          <SummaryCard icon={Trophy} label="Sua posição" value={data.summary.position ? `#${data.summary.position} semanal` : 'Sem posição'} tone="green" />
          <SummaryCard icon={Dumbbell} label="Treinos na semana" value={String(data.summary.weeklyWorkouts)} tone="blue" />
        </section>
        <PublishActivity onOpen={setComposerType} />
        <div className="community-content-grid">
          <div className="community-feed" aria-label="Feed da comunidade">
            <div className="community-section-heading"><div><small>FEED</small><h2>O que move a comunidade</h2></div>{query && <span>{visiblePosts.length} resultado{visiblePosts.length === 1 ? '' : 's'}</span>}</div>
            {visiblePosts.length ? visiblePosts.map((post) => <PostCard key={post.id} post={post} viewerId={userId} liking={Boolean(pendingLikes[post.id])} onLike={() => void toggleLike(post)} onOpenProfile={() => onNavigate(`/perfil-social?user=${encodeURIComponent(post.userId)}`)} onCommentAdded={() => setData((current) => current ? { ...current, posts: current.posts.map((item) => item.id === post.id ? { ...item, comments: item.comments + 1 } : item) } : current)} onCommentRemoved={() => setData((current) => current ? { ...current, posts: current.posts.map((item) => item.id === post.id ? { ...item, comments: Math.max(0, item.comments - 1) } : item) } : current)} onMenu={() => setNotice('As opções da publicação serão disponibilizadas em breve.')} />) : <FeedEmpty searched={Boolean(query)} onNavigate={onNavigate} />}
          </div>
          <WeeklyRanking ranking={data.ranking} onMore={() => setTab('ranking')} />
        </div>
      </>}
      {tab === 'ranking' && <RankingPanel initialRanking={data.ranking} onOpenProfile={(targetUserId) => onNavigate(`/perfil-social?user=${encodeURIComponent(targetUserId)}`)} />}
      {tab === 'clubs' && <CommunityClubsPanel />}
    </>}
    {notice && <button className="community-toast" onClick={() => setNotice('')} role="status">{notice}<X size={14} /></button>}
    {composerType && <CreateCommunityPostModal userId={userId} initialType={composerType} onClose={() => setComposerType(null)} onPublished={() => { setComposerType(null); setData(null); communityService.load(userId).then(setData).catch(() => setError('A publicação foi criada, mas não foi possível atualizar o feed.')) }} />}
  </section>
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) { return <button role="tab" aria-selected={active} className={active ? 'is-active' : ''} onClick={onClick}>{label}</button> }
function SummaryCard({ icon: Icon, label, value, tone }: { icon: typeof Flame; label: string; value: string; tone: string }) { return <article className={`community-summary-card is-${tone}`}><span><Icon size={18} /></span><div><small>{label}</small><strong>{value}</strong></div></article> }

function PublishActivity({ onOpen }: { onOpen: (type: CommunityPostType) => void }) {
  return <section className="community-publish"><button className="community-publish__intro" onClick={() => onOpen('general_fitness')}><span><UsersRound size={18} /></span><div><small>COMPARTILHE SUA ATIVIDADE</small><h2>Seu movimento pode inspirar alguém.</h2></div></button><nav aria-label="Escolher atividade para compartilhar"><button onClick={() => onOpen('workout')}><Dumbbell size={16} />Treino</button><button onClick={() => onOpen('running')}><Footprints size={16} />Corrida</button><button onClick={() => onOpen('food')}><Salad size={16} />Refeição</button></nav></section>
}

function PostCard({ post, viewerId, liking, onLike, onOpenProfile, onCommentAdded, onCommentRemoved, onMenu }: { post: CommunityPost; viewerId: string; liking: boolean; onLike: () => void; onOpenProfile: () => void; onCommentAdded: () => void; onCommentRemoved: () => void; onMenu: () => void }) {
  const initials = post.profile.name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const Icon = postIcon(post.type)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [comment, setComment] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [sendingComment, setSendingComment] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)

  async function openComments() {
    const nextOpen = !commentsOpen
    setCommentsOpen(nextOpen)
    if (!nextOpen || comments.length || loadingComments) return
    setLoadingComments(true); setCommentError('')
    try { setComments(await communityService.listComments(post.id)) }
    catch { setCommentError('Não foi possível carregar os comentários agora.') }
    finally { setLoadingComments(false) }
  }

  async function sendComment() {
    if (!comment.trim() || sendingComment) return
    setSendingComment(true); setCommentError('')
    try {
      const created = await communityService.createComment(post.id, viewerId, comment.slice(0, 500))
      setComments((items) => [...items, created]); setComment(''); onCommentAdded()
    } catch (error) { setCommentError(error instanceof Error ? error.message : 'Não foi possível enviar seu comentário.') }
    finally { setSendingComment(false) }
  }

  async function deleteComment(commentId: string) {
    setDeletingCommentId(commentId); setCommentError('')
    try { await communityService.deleteComment(commentId, viewerId); setComments((items) => items.filter((item) => item.id !== commentId)); onCommentRemoved() }
    catch { setCommentError('Não foi possível excluir o comentário agora.') }
    finally { setDeletingCommentId(null) }
  }

  async function reportComment(commentId: string) {
    setReportingCommentId(commentId); setCommentError('')
    try { await communityService.reportComment(commentId, viewerId); setCommentError('Denúncia enviada para análise.') }
    catch { setCommentError('Não foi possível enviar a denúncia agora.') }
    finally { setReportingCommentId(null) }
  }
  return <article className="community-post">
    <header><button className="community-post__author" onClick={onOpenProfile} aria-label={`Abrir perfil de ${post.profile.name}`}><span className="community-avatar">{post.profile.avatarUrl ? <img src={post.profile.avatarUrl} alt="" /> : initials}</span><span><strong>{post.profile.name}</strong><small><Flame size={12} fill="currentColor" /> atividade compartilhada</small></span></button><button onClick={onMenu} aria-label={`Opções da publicação de ${post.profile.name}`}><Ellipsis size={19} /></button></header>
    {post.mediaUrl ? <img className="community-post__image" src={post.mediaUrl} alt="Publicação compartilhada pela comunidade" loading="lazy" /> : <div className="community-post__missing-media"><Icon size={28} /><span>{postTypeLabel(post.type)}</span></div>}
    <div className="community-post__body"><p>{post.caption || 'Atividade compartilhada na comunidade.'}</p><div className="community-post__activity"><span><Icon size={14} /></span>{activityCopy(post)}</div></div>
    <footer><button className={`${post.likedByMe ? 'is-liked' : ''} ${post.likedByMe && !liking ? 'is-like-pop' : ''}`} onClick={onLike} disabled={liking} aria-label={post.likedByMe ? 'Remover curtida' : 'Curtir publicação'}><Heart size={18} fill={post.likedByMe ? 'currentColor' : 'none'} /><b>{post.likes}</b></button><button className={commentsOpen ? 'is-commenting' : ''} onClick={() => void openComments()} aria-expanded={commentsOpen} aria-label="Ver e adicionar comentários"><MessageCircle size={18} /><b>{post.comments}</b></button><time>{relativeDate(post.createdAt)}</time></footer>
    {commentsOpen && <section className="community-comments" aria-label="Comentários"><header><strong>Comentários</strong><button onClick={() => setCommentsOpen(false)} aria-label="Fechar comentários"><X size={15} /></button></header><div className="community-comments__list">{loadingComments ? <span className="community-comments__loading"><LoaderCircle size={14} className="is-spinning" /> Carregando comentários…</span> : comments.length ? comments.map((item) => <article key={item.id}><span className="community-comment-avatar">{item.profile.avatarUrl ? <img src={item.profile.avatarUrl} alt="" /> : item.profile.name.slice(0, 1)}</span><div><strong>{item.profile.name}</strong><p>{item.content}</p><small>{relativeDate(item.createdAt)}</small>{item.userId === viewerId ? <button className="community-comment-action" disabled={deletingCommentId === item.id} onClick={() => void deleteComment(item.id)}>{deletingCommentId === item.id ? 'Excluindo…' : 'Excluir'}</button> : <button className="community-comment-action" disabled={reportingCommentId === item.id} onClick={() => void reportComment(item.id)}>{reportingCommentId === item.id ? 'Enviando…' : 'Denunciar'}</button>}</div></article>) : <p className="community-comments__empty">Seja o primeiro a comentar.</p>}</div><div className="community-comment-form"><input value={comment} maxLength={500} disabled={sendingComment} placeholder="Adicionar comentário..." onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendComment() } }} /><button onClick={() => void sendComment()} disabled={!comment.trim() || sendingComment} aria-label="Enviar comentário">{sendingComment ? <LoaderCircle size={15} className="is-spinning" /> : <Send size={15} />}</button></div>{commentError && <p className="community-comments__error">{commentError}</p>}</section>}
    {!post.isPermanent && post.expiresAt && <PostExpiration expiresAt={post.expiresAt} isOwner={post.userId === viewerId} />}
  </article>
}

function WeeklyRanking({ ranking, onMore }: { ranking: CommunityData['ranking']; onMore: () => void }) { return <aside className="community-ranking-card"><header><div><small>SEQUÊNCIAS ATIVAS</small><h2>Ritmo em destaque</h2></div><Trophy size={19} /></header>{ranking.entries.length ? <ol>{ranking.entries.slice(0, 3).map((item) => <li key={item.userId}><b>{item.position}</b><span className="ranking-avatar">{item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : item.name.slice(0, 1)}</span><div><strong>{item.name}</strong><small>{formatRankingMetric('streak', item.metric)}</small></div></li>)}</ol> : <p>O ranking aparece após o primeiro movimento válido na Comunidade.</p>}<button onClick={onMore}>Ver ranking <ArrowRight size={15} /></button></aside> }

function RankingPanel({ initialRanking, onOpenProfile }: { initialRanking: CommunityRankingData; onOpenProfile: (userId: string) => void }) {
  const [scope, setScope] = useState<CommunityRankingScope>('global')
  const [category, setCategory] = useState<CommunityRankingCategory>('streak')
  const [ranking, setRanking] = useState<CommunityRankingData>(initialRanking)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    communityService.loadRanking(scope, category).then((result) => { if (active) setRanking(result) }).catch(() => { if (active) setError('Não foi possível atualizar este ranking agora.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [scope, category])

  return <section className="community-ranking-panel">
    <div className="community-section-heading"><div><small>RANKINGS SEMANAIS</small><h2>Ritmo que inspira</h2><p>{rankingWeekLabel(ranking.weekStart)} · reinicia toda segunda-feira.</p></div></div>
    <div className="community-ranking-filters" aria-label="Escopo do ranking"><button className={scope === 'friends' ? 'is-active' : ''} onClick={() => setScope('friends')}>Amigos</button><button disabled title="Os clubes chegarão em breve">Clube <small>em breve</small></button><button className={scope === 'global' ? 'is-active' : ''} onClick={() => setScope('global')}>Global</button></div>
    <div className="community-ranking-categories" role="tablist" aria-label="Categoria do ranking"><RankingCategoryButton icon={Flame} label="Sequência ativa" active={category === 'streak'} onClick={() => setCategory('streak')} /><RankingCategoryButton icon={Dumbbell} label="Mais treinos" active={category === 'workouts'} onClick={() => setCategory('workouts')} /><RankingCategoryButton icon={Footprints} label="Mais quilômetros" active={category === 'distance'} onClick={() => setCategory('distance')} /></div>
    {loading ? <div className="community-ranking-loading"><span /><span /><span /></div> : error ? <div className="community-empty-inline"><Medal size={25} /><strong>{error}</strong><button onClick={() => { setError(''); setLoading(true); communityService.loadRanking(scope, category).then(setRanking).catch(() => setError('Não foi possível atualizar este ranking agora.')).finally(() => setLoading(false)) }}>Tentar novamente</button></div> : ranking.entries.length ? <><ol className="community-ranking-list">{ranking.entries.map((item) => <li key={item.userId} className={`${item.position <= 3 ? `is-podium is-place-${item.position}` : ''} ${item.isCurrentUser ? 'is-current-user' : ''}`}><b>#{item.position}</b><button onClick={() => onOpenProfile(item.userId)} aria-label={`Abrir perfil de ${item.name}`}>{item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : item.name.slice(0, 1)}</button><button className="community-ranking-list__name" onClick={() => onOpenProfile(item.userId)}><strong>{item.isCurrentUser ? 'Você' : item.name}</strong><small>{item.isCurrentUser ? 'Sua posição nesta categoria' : rankingScopeLabel(scope)}</small></button><em>{formatRankingMetric(category, item.metric)}</em></li>)}</ol>{ranking.myPosition && !ranking.entries.some((item) => item.isCurrentUser) && <div className="community-ranking-you"><span><UserRound size={17} /></span><div><small>SUA POSIÇÃO</small><strong>Você está em #{ranking.myPosition}</strong></div><b>{formatRankingMetric(category, ranking.myMetric ?? 0)}</b></div>}</> : <div className="community-empty-inline"><Medal size={25} /><strong>{scope === 'friends' ? 'Nenhum amigo entrou neste ranking ainda.' : 'O ranking está esperando o primeiro movimento.'}</strong><p>{category === 'streak' ? 'Conclua uma atividade física válida para entrar na sequência ativa.' : 'O ranking considera apenas atividades concluídas e válidas nesta semana.'}</p></div>}
  </section>
}

function RankingCategoryButton({ icon: Icon, label, active, onClick }: { icon: typeof Flame; label: string; active: boolean; onClick: () => void }) { return <button role="tab" aria-selected={active} className={active ? 'is-active' : ''} onClick={onClick}><Icon size={15} />{label}</button> }
function formatRankingMetric(category: CommunityRankingCategory, metric: number) { if (category === 'distance') return `${metric.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`; if (category === 'workouts') return `${metric} ${metric === 1 ? 'treino' : 'treinos'}`; return `${metric} ${metric === 1 ? 'dia' : 'dias'}` }
function rankingScopeLabel(scope: CommunityRankingScope) { return scope === 'friends' ? 'Amigos em comum' : 'Comunidade global' }
function rankingWeekLabel(weekStart: string) { if (!weekStart) return 'Semana atual'; const start = new Date(`${weekStart}T12:00:00`); const end = new Date(start); end.setDate(end.getDate() + 6); return `${start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} — ${end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}` }
function ClubsPlaceholder() { return <section className="community-clubs-placeholder"><span><UsersRound size={25} /></span><small>CLUBES</small><h2>Encontre seu ritmo em grupo.</h2><p>Os clubes serão a próxima etapa da Comunidade. Por enquanto, acompanhe o feed e celebre cada movimento compartilhado.</p></section> }
function FeedEmpty({ searched, onNavigate }: { searched: boolean; onNavigate: (path: string) => void }) { return <div className="community-empty-feed"><span><Flame size={24} /></span><h3>{searched ? 'Nada encontrado por aqui.' : 'A comunidade começa com o primeiro movimento.'}</h3><p>{searched ? 'Tente um nome ou termo diferente.' : 'Conclua um treino, corrida ou refeição e compartilhe quando estiver pronto.'}</p>{!searched && <button onClick={() => onNavigate('/treinos')}>Ir para treinos <ArrowRight size={15} /></button>}</div> }
function CommunityLoading() { return <div className="community-loading" aria-label="Carregando comunidade"><span /><span /><span /><div /><div /></div> }
function postIcon(type: CommunityPostType) { return type === 'workout' ? Dumbbell : type === 'food' ? Salad : type === 'achievement' ? Medal : type === 'general_fitness' ? Flame : Footprints }
function postTypeLabel(type: CommunityPostType) { return ({ workout: 'Treino', running: 'Corrida', walking: 'Caminhada', food: 'Refeição', achievement: 'Conquista', general_fitness: 'Fitness' } as Record<CommunityPostType, string>)[type] }
function activityCopy(post: CommunityPost) { if (post.activity) return `${postTypeLabel(post.type)} • ${post.activity.distanceKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km${post.activity.durationSeconds ? ` • ${Math.round(post.activity.durationSeconds / 60)} min` : ''}`; return `${postTypeLabel(post.type)} compartilhado` }
function relativeDate(value: string) { const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000)); return minutes < 1 ? 'agora' : minutes < 60 ? `${minutes} min` : minutes < 1440 ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 1440)} d` }
function daysUntil(value: string) { return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000)) }
function PostExpiration({ expiresAt, isOwner }: { expiresAt: string; isOwner: boolean }) { const days = daysUntil(expiresAt); return <p className={`community-post__expiration ${days <= 1 ? 'is-soon' : ''}`}>{days <= 1 && isOwner ? 'Sua publicação será removida em breve. No Pro, suas publicações permanecem salvas.' : `Expira em ${days} ${days === 1 ? 'dia' : 'dias'}`}</p> }
