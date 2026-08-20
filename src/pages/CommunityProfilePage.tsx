import { useEffect, useState } from 'react'
import { ArrowLeft, Award, Dumbbell, Flame, Heart, LoaderCircle, LockKeyhole, MapPin, MessageCircle, UserRound, UsersRound } from 'lucide-react'
import { communityService, type CommunityPost, type CommunitySocialProfile } from '../services/communityService'
import '../community.css'

type ProfileTab = 'posts' | 'achievements'

export function CommunityProfilePage({ viewerId, targetUserId, onNavigate }: { viewerId: string; targetUserId: string; onNavigate: (path: string) => void }) {
  const [profile, setProfile] = useState<CommunitySocialProfile | null>(null)
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [tab, setTab] = useState<ProfileTab>('posts')
  const [error, setError] = useState('')
  const [following, setFollowing] = useState(false)

  useEffect(() => {
    if (!targetUserId) { setError('Perfil inválido.'); return }
    let active = true
    setProfile(null); setPosts([]); setError(''); setTab('posts')
    communityService.loadSocialProfile(targetUserId).then(async (result) => {
      if (!active) return
      setProfile(result)
      if (result.state === 'available') {
        try { const items = await communityService.loadUserPosts(targetUserId, viewerId); if (active) setPosts(items) }
        catch { if (active) setError('Não foi possível carregar as publicações agora.') }
      }
    }).catch(() => active && setError('Não foi possível carregar este perfil agora.'))
    return () => { active = false }
  }, [targetUserId, viewerId])

  async function toggleFollow() {
    if (!profile || profile.isOwnProfile || following) return
    const wasFollowing = Boolean(profile.followingByMe)
    setFollowing(true)
    setProfile({ ...profile, followingByMe: !wasFollowing, followersCount: Math.max(0, Number(profile.followersCount ?? 0) + (wasFollowing ? -1 : 1)) })
    try { await communityService.toggleFollow(targetUserId, viewerId, wasFollowing) }
    catch { setProfile(profile); setError('Não foi possível atualizar o seguimento agora.') }
    finally { setFollowing(false) }
  }

  if (error && !profile) return <section className="community-profile-state"><UsersRound size={28} /><h1>Perfil indisponível</h1><p>{error}</p><button onClick={() => onNavigate('/comunidade')}>Voltar para a Comunidade</button></section>
  if (!profile) return <ProfileLoading />
  if (profile.state !== 'available') return <ProfileRestricted state={profile.state} onBack={() => onNavigate('/comunidade')} />

  const initials = (profile.name ?? 'Membro MOVELYA').split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const isOwn = Boolean(profile.isOwnProfile)
  return <section className="community-profile-page">
    <button className="community-profile-back" onClick={() => onNavigate('/comunidade')}><ArrowLeft size={16} /> Comunidade</button>
    <header className="community-profile-hero">
      <span className="community-profile-avatar">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials}</span>
      <div className="community-profile-identity"><span className="page-eyebrow">PERFIL DA COMUNIDADE</span><h1>{profile.name}</h1>{profile.username && <p className="community-profile-handle">@{profile.username}</p>}{profile.bio && <p className="community-profile-bio">{profile.bio}</p>}</div>
      {!isOwn && <button className={`community-follow-button ${profile.followingByMe ? 'is-following' : ''}`} disabled={following} onClick={() => void toggleFollow()}>{following ? <LoaderCircle size={15} className="is-spinning" /> : <UsersRound size={15} />}{profile.followingByMe ? 'Seguindo' : 'Seguir'}</button>}
    </header>

    <section className="community-profile-counts" aria-label="Conexões na comunidade"><div><strong>{formatCount(profile.followersCount ?? 0)}</strong><span>seguidores</span></div><div><strong>{formatCount(profile.followingCount ?? 0)}</strong><span>seguindo</span></div><div><strong>{profile.achievements?.length ?? 0}</strong><span>conquistas</span></div></section>
    <section className="community-profile-metrics" aria-label="Resumo compartilhado">
      <ProfileMetric icon={Flame} label="Sequência atual" value={profile.streak === null ? 'Privada' : `${profile.streak ?? 0} dias`} />
      <ProfileMetric icon={Dumbbell} label="Treinos" value={profile.workoutsCount === null ? 'Privado' : formatCount(profile.workoutsCount ?? 0)} />
      <ProfileMetric icon={MapPin} label="Distância acumulada" value={profile.distanceKm === null ? 'Não compartilhada' : `${formatDistance(profile.distanceKm)} km`} />
    </section>

    <div className="community-profile-tabs" role="tablist"><button className={tab === 'posts' ? 'is-active' : ''} onClick={() => setTab('posts')} role="tab" aria-selected={tab === 'posts'}>Publicações <span>{posts.length}</span></button><button className={tab === 'achievements' ? 'is-active' : ''} onClick={() => setTab('achievements')} role="tab" aria-selected={tab === 'achievements'}>Conquistas <span>{profile.achievements?.length ?? 0}</span></button></div>
    {error && <p className="community-profile-inline-error">{error}</p>}
    {tab === 'posts' ? <section className="community-profile-posts">{posts.length ? posts.map((post) => <ProfilePost key={post.id} post={post} />) : <div className="community-profile-empty"><UserRound size={24} /><strong>Ainda não há publicações visíveis.</strong><p>Quando houver um movimento compartilhado, ele aparece aqui.</p></div>}</section> : <section className="community-profile-achievements">{profile.achievements?.length ? profile.achievements.map((achievement) => <article key={achievement.id}><span><Award size={18} /></span><strong>{achievement.title}</strong><small>Conquista compartilhada</small></article>) : <div className="community-profile-empty"><Award size={24} /><strong>Nenhuma conquista compartilhada.</strong><p>As conquistas aparecem aqui quando a pessoa decide compartilhá-las.</p></div>}</section>}
  </section>
}

function ProfileMetric({ icon: Icon, label, value }: { icon: typeof Flame; label: string; value: string }) { return <article><span><Icon size={17} /></span><div><small>{label}</small><strong>{value}</strong></div></article> }
function ProfilePost({ post }: { post: CommunityPost }) { return <article className="community-profile-post"><div className="community-profile-post__media">{post.mediaUrl ? <img src={post.mediaUrl} alt="Publicação compartilhada" loading="lazy" /> : <Dumbbell size={25} />}</div><div><p>{post.caption || 'Atividade compartilhada na comunidade.'}</p><footer><span><Heart size={14} /> {post.likes}</span><span><MessageCircle size={14} /> {post.comments}</span></footer></div></article> }
function ProfileRestricted({ state, onBack }: { state: CommunitySocialProfile['state']; onBack: () => void }) { const blocked = state === 'blocked'; return <section className="community-profile-state"><span><LockKeyhole size={25} /></span><h1>{blocked ? 'Perfil indisponível' : 'Este perfil é privado'}</h1><p>{blocked ? 'Este perfil não está disponível para você.' : 'Siga esta pessoa para ver o que ela escolheu compartilhar.'}</p><button onClick={onBack}>Voltar para a Comunidade</button></section> }
function ProfileLoading() { return <section className="community-profile-loading" aria-label="Carregando perfil"><span /><div /><div /><div /></section> }
function formatCount(value: number) { return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value) }
function formatDistance(value: number | null | undefined) { return Number(value ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) }
