import { useEffect, useState } from 'react'
import { ArrowLeft, Dumbbell, Flame, Footprints, LoaderCircle, LockKeyhole, Medal, Target, UsersRound } from 'lucide-react'
import { communityService, type CommunityClub, type CommunityClubDetail, type CommunityRankingCategory, type CommunityRankingData } from '../services/communityService'
import '../community.css'

export function CommunityClubsPanel() {
  const [clubs, setClubs] = useState<CommunityClub[]>([])
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function loadDirectory() {
    setLoading(true); setError('')
    communityService.listClubs().then(setClubs).catch(() => setError('Não foi possível carregar os clubes agora.')).finally(() => setLoading(false))
  }

  useEffect(() => { loadDirectory() }, [])
  if (selectedClubId) return <ClubDetail clubId={selectedClubId} onBack={() => { setSelectedClubId(null); loadDirectory() }} />
  return <section className="community-clubs-panel"><header className="community-section-heading"><div><small>CLUBES</small><h2>Encontre seu ritmo em grupo</h2><p>Comunidades focadas em atividade, desafios e evolução — sem chat.</p></div></header>{loading ? <div className="community-club-loading"><span /><span /><span /></div> : error ? <div className="community-empty-inline"><UsersRound size={25} /><strong>{error}</strong><button onClick={loadDirectory}>Tentar novamente</button></div> : clubs.length ? <div className="community-club-grid">{clubs.map((club) => <ClubCard key={club.id} club={club} onOpen={() => setSelectedClubId(club.id)} />)}</div> : <div className="community-empty-inline"><UsersRound size={25} /><strong>Os primeiros clubes estão chegando.</strong><p>A estrutura já está pronta para clubes públicos e privados, desafios e moderação.</p></div>}</section>
}

function ClubCard({ club, onOpen }: { club: CommunityClub; onOpen: () => void }) { return <article className="community-club-card"><button className="community-club-card__open" onClick={onOpen}><div className="community-club-card__cover">{club.coverUrl ? <img src={club.coverUrl} alt="" /> : <span><UsersRound size={23} /></span>}</div><div className="community-club-card__body"><span className="community-club-avatar">{club.avatarUrl ? <img src={club.avatarUrl} alt="" /> : club.name.slice(0, 1)}</span><div><h3>{club.name}</h3><p>{club.description || 'Atividade e consistência em comunidade.'}</p></div></div></button><footer><span><UsersRound size={14} /> {club.membersCount} {club.membersCount === 1 ? 'membro' : 'membros'}</span><span><Target size={14} /> {club.challengesCount} {club.challengesCount === 1 ? 'desafio' : 'desafios'}</span><button onClick={onOpen}>{club.joined ? 'Ver clube' : 'Conhecer'}</button></footer></article> }

function ClubDetail({ clubId, onBack }: { clubId: string; onBack: () => void }) {
  const [club, setClub] = useState<CommunityClubDetail | null>(null)
  const [ranking, setRanking] = useState<CommunityRankingData | null>(null)
  const [category, setCategory] = useState<CommunityRankingCategory>('streak')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  function load() {
    setLoading(true); setMessage('')
    Promise.all([communityService.loadClub(clubId), communityService.loadClubRanking(clubId, category)]).then(([detail, rank]) => { setClub(detail); setRanking(rank) }).catch(() => setMessage('Não foi possível abrir este clube agora.')).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [clubId])
  useEffect(() => { if (!club || club.state !== 'available') return; communityService.loadClubRanking(clubId, category).then(setRanking).catch(() => setMessage('Não foi possível atualizar o ranking.')) }, [clubId, category])

  async function toggleMembership() {
    if (!club || busy || club.role === 'owner') return
    const joined = club.joined
    setBusy(true); setMessage('')
    try { await communityService.toggleClubMembership(club.id, joined); setClub({ ...club, joined: !joined, membersCount: Math.max(0, club.membersCount + (joined ? -1 : 1)), role: joined ? null : 'member' }) }
    catch { setMessage(joined ? 'Não foi possível sair do clube agora.' : 'Não foi possível entrar no clube agora.') }
    finally { setBusy(false) }
  }
  async function joinChallenge(challengeId: string) {
    if (!club || busy) return
    setBusy(true); setMessage('')
    try { await communityService.joinClubChallenge(challengeId); setClub({ ...club, challenges: club.challenges.map((item) => item.id === challengeId ? { ...item, joinedByMe: true, participantsCount: item.participantsCount + 1 } : item) }) }
    catch { setMessage('Entre no clube antes de participar do desafio.') }
    finally { setBusy(false) }
  }

  if (loading) return <section className="community-club-detail"><button className="community-profile-back" onClick={onBack}><ArrowLeft size={16} /> Clubes</button><div className="community-club-loading"><span /><span /><span /></div></section>
  if (!club || club.state !== 'available') return <section className="community-club-detail"><button className="community-profile-back" onClick={onBack}><ArrowLeft size={16} /> Clubes</button><div className="community-empty-inline"><LockKeyhole size={25} /><strong>{club?.state === 'private' ? 'Este clube é privado.' : 'Clube indisponível.'}</strong><p>{club?.state === 'private' ? 'Você precisa receber acesso antes de ver as atividades do grupo.' : message || 'Tente novamente mais tarde.'}</p></div></section>
  return <section className="community-club-detail"><button className="community-profile-back" onClick={onBack}><ArrowLeft size={16} /> Clubes</button><header className="community-club-hero">{club.coverUrl ? <img src={club.coverUrl} alt="" /> : <div className="community-club-hero__pattern" />}<div><span className="community-club-avatar">{club.avatarUrl ? <img src={club.avatarUrl} alt="" /> : club.name.slice(0, 1)}</span><div><small>{club.privacy === 'private' ? 'CLUBE PRIVADO' : 'CLUBE PÚBLICO'}</small><h2>{club.name}</h2><p>{club.description || 'Atividade e consistência em comunidade.'}</p></div><button className={`community-club-membership ${club.joined ? 'is-joined' : ''}`} disabled={busy || club.role === 'owner'} onClick={() => void toggleMembership()}>{busy ? <LoaderCircle size={15} className="is-spinning" /> : club.joined ? 'Sair do clube' : 'Entrar no clube'}</button></div><footer><span><UsersRound size={15} /> {club.membersCount} membros</span><span><Target size={15} /> {club.challenges.length} desafios ativos</span></footer></header>{message && <p className="community-club-message">{message}</p>}<section className="community-club-ranking"><div className="community-section-heading"><div><small>RANKING DO CLUBE</small><h2>Consistência compartilhada</h2></div></div><div className="community-ranking-categories"><ClubRankingButton icon={Flame} label="Sequência" active={category === 'streak'} onClick={() => setCategory('streak')} /><ClubRankingButton icon={Dumbbell} label="Treinos" active={category === 'workouts'} onClick={() => setCategory('workouts')} /><ClubRankingButton icon={Footprints} label="Km" active={category === 'distance'} onClick={() => setCategory('distance')} /></div>{ranking?.entries.length ? <ol className="community-ranking-list">{ranking.entries.slice(0, 5).map((item) => <li key={item.userId} className={item.position <= 3 ? 'is-podium' : ''}><b>#{item.position}</b><span>{item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : item.name.slice(0, 1)}</span><div><strong>{item.isCurrentUser ? 'Você' : item.name}</strong><small>{item.isCurrentUser ? 'Sua posição no clube' : 'Membro do clube'}</small></div><em>{rankingMetric(category, item.metric)}</em></li>)}</ol> : <div className="community-empty-inline"><Medal size={23} /><strong>O ranking começa com o primeiro movimento válido.</strong></div>}</section><section className="community-club-challenges"><div className="community-section-heading"><div><small>DESAFIOS</small><h2>Um objetivo por vez</h2><p>Participe e acompanhe a evolução dentro do clube.</p></div></div>{club.challenges.length ? <div>{club.challenges.map((challenge) => <article key={challenge.id}><span><Target size={18} /></span><div><small>{challenge.status === 'active' ? 'EM ANDAMENTO' : 'EM BREVE'} · {formatChallengeMetric(challenge.metric, challenge.targetValue)}</small><strong>{challenge.title}</strong><p>{challenge.description || 'Um desafio criado pela moderação do clube.'}</p><footer><span>{challenge.participantsCount} participantes</span><span>até {new Date(challenge.endsAt).toLocaleDateString('pt-BR')}</span></footer></div><button disabled={busy || challenge.joinedByMe || !club.joined} onClick={() => void joinChallenge(challenge.id)}>{challenge.joinedByMe ? 'Participando' : club.joined ? 'Participar' : 'Entre no clube'}</button></article>)}</div> : <div className="community-empty-inline"><Target size={23} /><strong>Novos desafios serão publicados em breve.</strong><p>Moderadores poderão criar desafios de sequência, treinos ou distância.</p></div>}</section></section>
}

function ClubRankingButton({ icon: Icon, label, active, onClick }: { icon: typeof Flame; label: string; active: boolean; onClick: () => void }) { return <button className={active ? 'is-active' : ''} onClick={onClick}><Icon size={14} /> {label}</button> }
function rankingMetric(category: CommunityRankingCategory, metric: number) { return category === 'distance' ? `${metric.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km` : category === 'workouts' ? `${metric} treinos` : `${metric} dias` }
function formatChallengeMetric(metric: CommunityRankingCategory, target: number) { return metric === 'distance' ? `${target} km` : metric === 'workouts' ? `${target} treinos` : `${target} dias de sequência` }
