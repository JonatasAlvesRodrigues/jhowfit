import { useEffect, useState } from 'react'
import { ArrowLeft, Dumbbell, Flame, Footprints, LoaderCircle, LockKeyhole, Medal, Target, Trophy, UsersRound } from 'lucide-react'
import { communityService, type ClubChallengeMetric, type CommunityClub, type CommunityClubChallenge, type CommunityClubDetail, type CommunityRankingCategory, type CommunityRankingData } from '../services/communityService'
import '../community.css'

export function CommunityClubsPanel({ userId }: { userId: string }) {
  const [clubs, setClubs] = useState<CommunityClub[]>([])
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [savingClub, setSavingClub] = useState(false)
  const [clubName, setClubName] = useState('')
  const [clubDescription, setClubDescription] = useState('')
  const [clubPrivacy, setClubPrivacy] = useState<'public' | 'private'>('public')

  function loadDirectory() { setLoading(true); setError(''); communityService.listClubs().then(setClubs).catch(() => setError('Não foi possível carregar os clubes agora.')).finally(() => setLoading(false)) }
  useEffect(() => { loadDirectory() }, [])

  async function createClub() {
    if (savingClub || clubName.trim().length < 3) return
    setSavingClub(true); setError('')
    try { setSelectedClubId(await communityService.createClub(userId, { name: clubName, description: clubDescription, privacy: clubPrivacy })) }
    catch (createError) { setError(createError instanceof Error ? createError.message : 'Não foi possível criar o clube.') }
    finally { setSavingClub(false) }
  }

  if (selectedClubId) return <ClubDetail clubId={selectedClubId} userId={userId} onBack={() => { setSelectedClubId(null); loadDirectory() }} />
  return <section className="community-clubs-panel">
    <header className="community-section-heading"><div><small>CLUBES</small><h2>Encontre seu ritmo em grupo</h2><p>Comunidades focadas em atividade, desafios e evolução — sem chat.</p></div><button className="community-club-create-trigger" onClick={() => setCreating((value) => !value)}>{creating ? 'Cancelar' : 'Criar clube'}</button></header>
    {creating && <section className="community-club-create"><div><small>NOVO CLUBE</small><h3>Comece uma comunidade de movimento</h3></div><label>Nome<input value={clubName} maxLength={60} placeholder="Ex.: Corredores da manhã" onChange={(event) => setClubName(event.target.value)} /></label><label>Descrição<textarea value={clubDescription} maxLength={500} placeholder="Qual é o foco do grupo?" onChange={(event) => setClubDescription(event.target.value)} /></label><label>Privacidade<select value={clubPrivacy} onChange={(event) => setClubPrivacy(event.target.value as 'public' | 'private')}><option value="public">Público</option><option value="private">Privado</option></select></label><button disabled={savingClub || clubName.trim().length < 3} onClick={() => void createClub()}>{savingClub ? <LoaderCircle size={15} className="is-spinning" /> : <UsersRound size={15} />}Criar clube</button><p>Você será o proprietário. Convites para clubes privados serão adicionados em uma próxima etapa.</p></section>}
    {loading ? <div className="community-club-loading"><span /><span /><span /></div> : error ? <div className="community-empty-inline"><UsersRound size={25} /><strong>{error}</strong><button onClick={loadDirectory}>Tentar novamente</button></div> : clubs.length ? <div className="community-club-grid">{clubs.map((club) => <ClubCard key={club.id} club={club} onOpen={() => setSelectedClubId(club.id)} />)}</div> : <div className="community-empty-inline"><UsersRound size={25} /><strong>Crie o primeiro clube.</strong><p>Junte pessoas em torno de um ritmo, uma modalidade ou um desafio.</p></div>}
  </section>
}

function ClubCard({ club, onOpen }: { club: CommunityClub; onOpen: () => void }) { return <article className="community-club-card"><button className="community-club-card__open" onClick={onOpen}><div className="community-club-card__cover">{club.coverUrl ? <img src={club.coverUrl} alt="" /> : <span><UsersRound size={23} /></span>}</div><div className="community-club-card__body"><span className="community-club-avatar">{club.avatarUrl ? <img src={club.avatarUrl} alt="" /> : club.name.slice(0, 1)}</span><div><h3>{club.name}</h3><p>{club.description || 'Atividade e consistência em comunidade.'}</p></div></div></button><footer><span><UsersRound size={14} /> {club.membersCount} membros</span><span><Target size={14} /> {club.challengesCount} desafios</span><button onClick={onOpen}>{club.joined ? 'Ver clube' : 'Conhecer'}</button></footer></article> }

function ClubDetail({ clubId, userId, onBack }: { clubId: string; userId: string; onBack: () => void }) {
  const [club, setClub] = useState<CommunityClubDetail | null>(null)
  const [ranking, setRanking] = useState<CommunityRankingData | null>(null)
  const [category, setCategory] = useState<CommunityRankingCategory>('streak')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [creatingChallenge, setCreatingChallenge] = useState(false)
  const [challengeTitle, setChallengeTitle] = useState('')
  const [challengeDescription, setChallengeDescription] = useState('')
  const [challengeMetric, setChallengeMetric] = useState<ClubChallengeMetric>('workouts')
  const [challengeTarget, setChallengeTarget] = useState('4')
  const [challengePeriod, setChallengePeriod] = useState<'week' | 'month'>('week')

  async function load() {
    setLoading(true); setMessage('')
    try {
      const [detail, rank] = await Promise.all([communityService.loadClub(clubId), communityService.loadClubRanking(clubId, category)])
      if (detail.state === 'available' && detail.joined) detail.challenges = await communityService.loadClubChallengeProgress(clubId)
      setClub(detail); setRanking(rank)
    } catch { setMessage('Não foi possível abrir este clube agora.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [clubId])
  useEffect(() => { if (!club || club.state !== 'available') return; communityService.loadClubRanking(clubId, category).then(setRanking).catch(() => setMessage('Não foi possível atualizar o ranking.')) }, [clubId, category])

  async function toggleMembership() {
    if (!club || busy || club.role === 'owner') return
    setBusy(true); setMessage('')
    try { await communityService.toggleClubMembership(club.id, club.joined); await load() }
    catch { setMessage(club.joined ? 'Não foi possível sair do clube agora.' : 'Não foi possível entrar no clube agora.') }
    finally { setBusy(false) }
  }
  async function joinChallenge(challengeId: string) {
    if (!club || busy) return
    setBusy(true); setMessage('')
    try { await communityService.joinClubChallenge(challengeId); await load() }
    catch { setMessage('Não foi possível participar do desafio agora.') }
    finally { setBusy(false) }
  }
  async function createChallenge() {
    if (!club || busy || challengeTitle.trim().length < 3 || Number(challengeTarget) <= 0) return
    const { startsAt, endsAt } = challengeDates(challengePeriod)
    setBusy(true); setMessage('')
    try { await communityService.createClubChallenge({ clubId, userId, title: challengeTitle, description: challengeDescription, metric: challengeMetric, targetValue: Number(challengeTarget), startsAt, endsAt }); setCreatingChallenge(false); setChallengeTitle(''); setChallengeDescription(''); await load() }
    catch { setMessage('Não foi possível criar o desafio. Confira os dados e tente novamente.') }
    finally { setBusy(false) }
  }

  if (loading) return <section className="community-club-detail"><button className="community-profile-back" onClick={onBack}><ArrowLeft size={16} /> Clubes</button><div className="community-club-loading"><span /><span /><span /></div></section>
  if (!club || club.state !== 'available') return <section className="community-club-detail"><button className="community-profile-back" onClick={onBack}><ArrowLeft size={16} /> Clubes</button><div className="community-empty-inline"><LockKeyhole size={25} /><strong>{club?.state === 'private' ? 'Este clube é privado.' : 'Clube indisponível.'}</strong><p>{club?.state === 'private' ? 'Você precisa receber acesso antes de ver as atividades do grupo.' : message || 'Tente novamente mais tarde.'}</p></div></section>
  const canManage = club.role === 'owner' || club.role === 'moderator'
  return <section className="community-club-detail">
    <button className="community-profile-back" onClick={onBack}><ArrowLeft size={16} /> Clubes</button>
    <header className="community-club-hero">{club.coverUrl ? <img src={club.coverUrl} alt="" /> : <div className="community-club-hero__pattern" />}<div><span className="community-club-avatar">{club.avatarUrl ? <img src={club.avatarUrl} alt="" /> : club.name.slice(0, 1)}</span><div><small>{club.privacy === 'private' ? 'CLUBE PRIVADO' : 'CLUBE PÚBLICO'}</small><h2>{club.name}</h2><p>{club.description || 'Atividade e consistência em comunidade.'}</p></div><button className={`community-club-membership ${club.joined ? 'is-joined' : ''}`} disabled={busy || club.role === 'owner'} onClick={() => void toggleMembership()}>{busy ? <LoaderCircle size={15} className="is-spinning" /> : club.joined ? 'Sair do clube' : 'Entrar no clube'}</button></div><footer><span><UsersRound size={15} /> {club.membersCount} membros</span><span><Target size={15} /> {club.challenges.length} desafios</span></footer></header>
    {message && <p className="community-club-message">{message}</p>}
    <section className="community-club-ranking"><div className="community-section-heading"><div><small>RANKING DO CLUBE</small><h2>Consistência compartilhada</h2></div></div><div className="community-ranking-categories"><ClubRankingButton icon={Flame} label="Sequência" active={category === 'streak'} onClick={() => setCategory('streak')} /><ClubRankingButton icon={Dumbbell} label="Treinos" active={category === 'workouts'} onClick={() => setCategory('workouts')} /><ClubRankingButton icon={Footprints} label="Km" active={category === 'distance'} onClick={() => setCategory('distance')} /></div>{ranking?.entries.length ? <ol className="community-ranking-list">{ranking.entries.slice(0, 5).map((item) => <li key={item.userId} className={item.position <= 3 ? 'is-podium' : ''}><b>#{item.position}</b><span>{item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : item.name.slice(0, 1)}</span><div><strong>{item.isCurrentUser ? 'Você' : item.name}</strong><small>{item.isCurrentUser ? 'Sua posição no clube' : 'Membro do clube'}</small></div><em>{rankingMetric(category, item.metric)}</em></li>)}</ol> : <div className="community-empty-inline"><Medal size={23} /><strong>O ranking começa com o primeiro movimento válido.</strong></div>}</section>
    <section className="community-club-challenges"><div className="community-section-heading"><div><small>DESAFIOS</small><h2>Um objetivo por vez</h2><p>Seu progresso é validado automaticamente pelas atividades reais.</p></div>{canManage && <button className="community-challenge-create-trigger" onClick={() => setCreatingChallenge((value) => !value)}>{creatingChallenge ? 'Cancelar' : 'Criar desafio'}</button>}</div>{creatingChallenge && <ChallengeCreator title={challengeTitle} description={challengeDescription} metric={challengeMetric} target={challengeTarget} period={challengePeriod} busy={busy} onTitle={setChallengeTitle} onDescription={setChallengeDescription} onMetric={setChallengeMetric} onTarget={setChallengeTarget} onPeriod={setChallengePeriod} onCreate={() => void createChallenge()} />}{club.challenges.length ? <div className="community-challenge-list">{club.challenges.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} member={club.joined} busy={busy} onJoin={() => void joinChallenge(challenge.id)} />)}</div> : <div className="community-empty-inline"><Target size={23} /><strong>Novos desafios serão publicados em breve.</strong><p>{canManage ? 'Crie uma meta semanal ou mensal para o clube.' : 'Acompanhe esta área para entrar no próximo desafio.'}</p></div>}</section>
  </section>
}

function ChallengeCard({ challenge, member, busy, onJoin }: { challenge: CommunityClubChallenge; member: boolean; busy: boolean; onJoin: () => void }) {
  const progress = Math.min(100, challenge.targetValue > 0 ? challenge.progressValue / challenge.targetValue * 100 : 0)
  const days = Math.max(0, Math.ceil((new Date(challenge.endsAt).getTime() - Date.now()) / 86_400_000))
  return <article className={`community-challenge-card ${challenge.completedByMe ? 'is-completed' : ''}`}><span><Target size={19} /></span><div><small>{challenge.status === 'active' ? '🔥 DESAFIO EM ANDAMENTO' : 'PRÓXIMO DESAFIO'} · {formatChallengeMetric(challenge.metric, challenge.targetValue)}</small><strong>{challenge.title}</strong><p>{challenge.description || 'Uma meta criada pela moderação do clube.'}</p>{challenge.joinedByMe && challenge.status === 'active' && <><div className="community-challenge-progress"><b>{formatProgress(challenge.metric, challenge.progressValue)} / {formatProgress(challenge.metric, challenge.targetValue)}</b><span><i style={{ width: `${progress}%` }} /></span></div><footer><span>{challenge.completedByMe ? <><Trophy size={13} /> Conquista desbloqueada</> : `${days} ${days === 1 ? 'dia restante' : 'dias restantes'}`}</span><span>{challenge.participantsCount} participantes · {challenge.completedCount} concluíram</span></footer></>} {!challenge.joinedByMe && <footer><span>{challenge.participantsCount} participantes</span><span>{challenge.completedCount} concluíram</span></footer>}</div>{!challenge.joinedByMe && <button disabled={busy || !member || challenge.status !== 'active'} onClick={onJoin}>{member ? 'Participar' : 'Entre no clube'}</button>}</article>
}

function ChallengeCreator({ title, description, metric, target, period, busy, onTitle, onDescription, onMetric, onTarget, onPeriod, onCreate }: { title: string; description: string; metric: ClubChallengeMetric; target: string; period: 'week' | 'month'; busy: boolean; onTitle: (value: string) => void; onDescription: (value: string) => void; onMetric: (value: ClubChallengeMetric) => void; onTarget: (value: string) => void; onPeriod: (value: 'week' | 'month') => void; onCreate: () => void }) { return <div className="community-challenge-create"><label>Título<input value={title} maxLength={100} placeholder="Ex.: Treine 4 vezes esta semana" onChange={(event) => onTitle(event.target.value)} /></label><label>Tipo<select value={metric} onChange={(event) => onMetric(event.target.value as ClubChallengeMetric)}><option value="workouts">Treinos concluídos</option><option value="distance">Quilômetros</option><option value="activities">Atividades concluídas</option><option value="streak">Dias consecutivos</option></select></label><label>Meta<input value={target} type="number" min="1" step={metric === 'distance' ? '.1' : '1'} onChange={(event) => onTarget(event.target.value)} /></label><label>Período<select value={period} onChange={(event) => onPeriod(event.target.value as 'week' | 'month')}><option value="week">Esta semana</option><option value="month">Este mês</option></select></label><label className="community-challenge-create__description">Descrição<textarea value={description} maxLength={500} placeholder="Uma mensagem curta para motivar o clube." onChange={(event) => onDescription(event.target.value)} /></label><button disabled={busy || title.trim().length < 3 || Number(target) <= 0} onClick={onCreate}>{busy ? <LoaderCircle size={14} className="is-spinning" /> : <Target size={14} />}Criar desafio</button></div> }

function ClubRankingButton({ icon: Icon, label, active, onClick }: { icon: typeof Flame; label: string; active: boolean; onClick: () => void }) { return <button className={active ? 'is-active' : ''} onClick={onClick}><Icon size={14} /> {label}</button> }
function rankingMetric(category: CommunityRankingCategory, metric: number) { return category === 'distance' ? `${metric.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km` : category === 'workouts' ? `${metric} treinos` : `${metric} dias` }
function formatChallengeMetric(metric: ClubChallengeMetric, target: number) { return metric === 'distance' ? `${target} km` : metric === 'workouts' ? `${target} treinos` : metric === 'activities' ? `${target} atividades` : `${target} dias de sequência` }
function formatProgress(metric: ClubChallengeMetric, value: number) { return metric === 'distance' ? value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' km' : `${Math.floor(value)}` }
function challengeDates(period: 'week' | 'month') { const now = new Date(); const start = new Date(now); const end = new Date(now); if (period === 'week') { start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); start.setHours(0, 0, 0, 0); end.setTime(start.getTime()); end.setDate(start.getDate() + 7) } else { start.setDate(1); start.setHours(0, 0, 0, 0); end.setFullYear(start.getFullYear(), start.getMonth() + 1, 1); end.setHours(0, 0, 0, 0) } return { startsAt: start.toISOString(), endsAt: end.toISOString() } }
