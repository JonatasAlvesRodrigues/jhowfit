import { supabase } from '../integrations/supabase'
import { activityStreakService } from './activityStreakService'

export type CommunityPostType = 'workout' | 'running' | 'walking' | 'food' | 'achievement' | 'general_fitness'

export interface CommunityPost {
  id: string
  userId: string
  type: CommunityPostType
  caption: string
  createdAt: string
  isPermanent: boolean
  expiresAt: string | null
  likedByMe: boolean
  likes: number
  comments: number
  profile: { name: string; avatarUrl: string | null }
  mediaUrl: string | null
  activity: { distanceKm: number; durationSeconds: number } | null
}

export interface CommunityRankingItem {
  userId: string
  name: string
  avatarUrl: string | null
  metric: number
  position: number
  isCurrentUser: boolean
}

export type CommunityRankingScope = 'global' | 'friends'
export type CommunityRankingCategory = 'streak' | 'workouts' | 'distance'

export interface CommunityRankingData {
  scope: CommunityRankingScope
  category: CommunityRankingCategory
  weekStart: string
  timezone: string
  entries: CommunityRankingItem[]
  myPosition: number | null
  myMetric: number | null
}

export interface CommunityClub {
  id: string
  name: string
  description: string
  avatarUrl: string | null
  coverUrl: string | null
  membersCount: number
  challengesCount: number
  joined: boolean
}

export interface CommunityClubChallenge {
  id: string
  title: string
  description: string
  metric: CommunityRankingCategory
  targetValue: number
  startsAt: string
  endsAt: string
  status: 'upcoming' | 'active'
  participantsCount: number
  joinedByMe: boolean
}

export interface CommunityClubDetail extends CommunityClub {
  state: 'available' | 'private' | 'not_found'
  privacy?: 'public' | 'private'
  role?: 'owner' | 'moderator' | 'member' | null
  challenges: CommunityClubChallenge[]
}

export interface CommunityComment {
  id: string
  userId: string
  content: string
  createdAt: string
  profile: { name: string; avatarUrl: string | null }
}

export interface CommunitySocialAchievement { id: string; title: string }

export interface CommunitySocialProfile {
  state: 'available' | 'private' | 'blocked' | 'not_found'
  userId?: string
  name?: string
  avatarUrl?: string | null
  username?: string | null
  bio?: string | null
  isOwnProfile?: boolean
  followingByMe?: boolean
  profileVisibility?: 'public' | 'private'
  activityVisibility?: 'public' | 'private'
  followersCount?: number
  followingCount?: number
  streak?: number | null
  workoutsCount?: number | null
  distanceKm?: number | null
  achievements?: CommunitySocialAchievement[]
}

export interface CommunityProfileSettings {
  profileVisibility: 'public' | 'private'
  activityVisibility: 'public' | 'private'
  shareDistance: boolean
  shareAchievements: boolean
}

export interface CommunityProfileEditor extends CommunityProfileSettings {
  username: string
  bio: string
  avatarUrl: string | null
  avatarSource: 'initials' | 'custom' | 'system'
  avatarKey: string | null
}

export interface CommunityProfileSearchResult {
  userId: string
  name: string
  username: string
  avatarUrl: string | null
  isPrivate: boolean
}

export const defaultCommunityProfileSettings: CommunityProfileSettings = {
  profileVisibility: 'public', activityVisibility: 'public', shareDistance: true, shareAchievements: true,
}

export interface CommunityData {
  summary: { streak: number; bestStreak: number; weeklyWorkouts: number; position: number | null }
  posts: CommunityPost[]
  ranking: CommunityRankingData
}

export interface RecentCommunityActivity {
  id: string
  label: string
  type: 'running' | 'walking'
}

export interface PreparedCommunityImage {
  image: Blob
  thumbnail: Blob
  width: number
  height: number
  previewUrl: string
}

export interface CreateCommunityPostInput {
  userId: string
  type: CommunityPostType
  caption: string
  activityId: string | null
  image: PreparedCommunityImage
  onProgress?: (progress: number, label: string) => void
}

type RawPost = {
  id: string; user_id: string; type: CommunityPostType; caption: string; created_at: string; is_permanent: boolean; expires_at: string | null
  post_media?: Array<{ storage_path: string }>
  outdoor_activities?: { distance_km: number | null; duration_seconds: number | null } | null
}

type EngagementRow = { post_id: string; likes_count: number; comments_count: number; liked_by_me: boolean }

export const communityService = {
  async load(userId: string): Promise<CommunityData> {
    if (!supabase || userId === 'development-preview') return emptyCommunityData()

    const weekStart = startOfWeek()
    const [postsResult, workoutsResult, streakSummary, ranking] = await Promise.all([
      supabase.from('posts').select('id,user_id,type,caption,created_at,is_permanent,expires_at,post_media(storage_path),outdoor_activities(distance_km,duration_seconds)').order('created_at', { ascending: false }).limit(40),
      supabase.from('workout_sessions').select('ended_at,started_at').eq('user_id', userId).eq('status', 'completed').gte('started_at', weekStart.toISOString()),
      activityStreakService.load(userId),
      loadCommunityRanking('global', 'streak', 10),
    ])
    if (postsResult.error) throw postsResult.error

    const posts = (postsResult.data ?? []) as unknown as RawPost[]
    const engagementResult = posts.length ? await supabase.rpc('community_feed_engagement', { target_post_ids: posts.map((post) => post.id) }) : { data: [], error: null }
    if (engagementResult.error) throw engagementResult.error
    const engagement = new Map<string, EngagementRow>((engagementResult.data ?? []).map((item: any) => [item.post_id, item]))
    const profiles = await loadProfiles([...new Set(posts.map((post) => post.user_id))])
    const hydratedPosts = await Promise.all(posts.map((post) => hydratePost(post, profiles, engagement.get(post.id), userId)))
    return {
      posts: hydratedPosts,
      ranking,
      summary: {
        streak: streakSummary.currentStreak,
        bestStreak: streakSummary.longestStreak,
        weeklyWorkouts: (workoutsResult.data ?? []).length,
        position: ranking.myPosition,
      },
    }
  },

  async loadRanking(scope: CommunityRankingScope, category: CommunityRankingCategory): Promise<CommunityRankingData> {
    return loadCommunityRanking(scope, category, 10)
  },

  async listClubs(): Promise<CommunityClub[]> {
    if (!supabase) return []
    const { data, error } = await supabase.rpc('community_club_directory')
    if (error) throw error
    return (data ?? []).map(mapCommunityClub)
  },

  async createClub(userId: string, input: { name: string; description: string; privacy: 'public' | 'private' }): Promise<string> {
    if (!supabase) throw new Error('A conexão com a Comunidade não está disponível.')
    const { data, error } = await supabase.from('clubs').insert({ owner_id: userId, name: input.name.trim(), description: input.description.trim(), privacy: input.privacy }).select('id').single()
    if (error || !data) throw error ?? new Error('Não foi possível criar o clube.')
    return String(data.id)
  },

  async loadClub(clubId: string): Promise<CommunityClubDetail> {
    if (!supabase) throw new Error('A conexão com a Comunidade não está disponível.')
    const { data, error } = await supabase.rpc('community_club_detail', { target_club_id: clubId })
    if (error || !data) throw error ?? new Error('Não foi possível abrir este clube.')
    const item = data as any
    return {
      ...mapCommunityClub(item), state: item.state === 'private' || item.state === 'not_found' ? item.state : 'available',
      privacy: item.privacy === 'private' ? 'private' : 'public', role: item.role === 'owner' || item.role === 'moderator' || item.role === 'member' ? item.role : null,
      challenges: Array.isArray(item.challenges) ? item.challenges.map((challenge: any) => ({
        id: String(challenge.id), title: String(challenge.title), description: String(challenge.description ?? ''),
        metric: challenge.metric === 'workouts' || challenge.metric === 'distance' ? challenge.metric : 'streak', targetValue: Number(challenge.target_value ?? 0),
        startsAt: String(challenge.starts_at), endsAt: String(challenge.ends_at), status: challenge.status === 'active' ? 'active' : 'upcoming',
        participantsCount: Number(challenge.participants_count ?? 0), joinedByMe: Boolean(challenge.joined_by_me),
      })) : [],
    }
  },

  async toggleClubMembership(clubId: string, joined: boolean) {
    if (!supabase) throw new Error('A conexão com a Comunidade não está disponível.')
    const { error } = await supabase.rpc(joined ? 'leave_community_club' : 'join_community_club', { target_club_id: clubId })
    if (error) throw error
  },

  async joinClubChallenge(challengeId: string) {
    if (!supabase) throw new Error('A conexão com a Comunidade não está disponível.')
    const { error } = await supabase.rpc('join_community_club_challenge', { target_challenge_id: challengeId })
    if (error) throw error
  },

  async loadClubRanking(clubId: string, category: CommunityRankingCategory): Promise<CommunityRankingData> {
    if (!supabase) return emptyCommunityRanking('global', category)
    const { data, error } = await supabase.rpc('community_club_rankings', { target_club_id: clubId, ranking_category: category, requested_limit: 10 })
    if (error) throw error
    return mapCommunityRanking(data, category)
  },

  async toggleLike(post: CommunityPost, userId: string) {
    if (!supabase) return post
    if (post.likedByMe) {
      const { error } = await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', userId)
      if (error) throw error
      return { ...post, likedByMe: false, likes: Math.max(0, post.likes - 1) }
    }
    const { error } = await supabase.from('post_likes').insert({ post_id: post.id, user_id: userId })
    if (error) throw error
    return { ...post, likedByMe: true, likes: post.likes + 1 }
  },

  async listComments(postId: string): Promise<CommunityComment[]> {
    if (!supabase) return []
    const { data, error } = await supabase.from('post_comments').select('id,user_id,content,created_at').eq('post_id', postId).eq('status', 'published').order('created_at', { ascending: true }).limit(100)
    if (error) throw error
    const rows = data ?? []
    const profiles = await loadProfiles([...new Set(rows.map((comment: any) => comment.user_id))])
    return rows.map((comment: any) => ({
      id: comment.id, userId: comment.user_id, content: comment.content, createdAt: comment.created_at,
      profile: profiles.get(comment.user_id) ?? { name: 'Membro MOVELYA', avatarUrl: null },
    }))
  },

  async createComment(postId: string, userId: string, content: string): Promise<CommunityComment> {
    if (!supabase) throw new Error('A conexão com a Comunidade não está disponível.')
    const normalizedContent = content.trim()
    if (!normalizedContent) throw new Error('Escreva um comentário antes de enviar.')
    const { data, error } = await supabase.from('post_comments').insert({ post_id: postId, user_id: userId, content: normalizedContent }).select('id,user_id,content,created_at').single()
    if (error || !data) throw error ?? new Error('Não foi possível enviar seu comentário.')
    const profiles = await loadProfiles([userId])
    return { id: data.id, userId: data.user_id, content: data.content, createdAt: data.created_at, profile: profiles.get(userId) ?? { name: 'Você', avatarUrl: null } }
  },

  async deleteComment(commentId: string, userId: string) {
    if (!supabase) throw new Error('A conexão com a Comunidade não está disponível.')
    const { error } = await supabase.from('post_comments').delete().eq('id', commentId).eq('user_id', userId)
    if (error) throw error
  },

  async reportComment(commentId: string, userId: string) {
    if (!supabase) throw new Error('A conexão com a Comunidade não está disponível.')
    const { error } = await supabase.from('reports').insert({ reporter_user_id: userId, target_type: 'comment', comment_id: commentId, reason: 'conteudo_inadequado' })
    if (error) throw error
  },

  async loadSocialProfile(targetUserId: string): Promise<CommunitySocialProfile> {
    if (!supabase) throw new Error('A conexão com a Comunidade não está disponível.')
    const { data, error } = await supabase.rpc('community_social_profile', { target_user_id: targetUserId })
    if (error || !data) throw error ?? new Error('Não foi possível carregar este perfil.')
    const item = data as any
    return {
      state: item.state,
      userId: item.user_id,
      name: item.name,
      avatarUrl: item.avatar_url ?? null,
      username: item.username ?? null,
      bio: item.bio ?? null,
      isOwnProfile: Boolean(item.is_own_profile),
      followingByMe: Boolean(item.following_by_me),
      profileVisibility: item.profile_visibility,
      activityVisibility: item.activity_visibility,
      followersCount: Number(item.followers_count ?? 0),
      followingCount: Number(item.following_count ?? 0),
      streak: item.streak === null || item.streak === undefined ? null : Number(item.streak),
      workoutsCount: item.workouts_count === null || item.workouts_count === undefined ? null : Number(item.workouts_count),
      distanceKm: item.distance_km === null || item.distance_km === undefined ? null : Number(item.distance_km),
      achievements: Array.isArray(item.achievements) ? item.achievements.map((achievement: any) => ({ id: String(achievement.id), title: String(achievement.title) })) : [],
    }
  },

  async loadMyProfileSettings(userId: string): Promise<CommunityProfileSettings> {
    if (!supabase) return defaultCommunityProfileSettings
    const { data, error } = await supabase.from('community_profile_settings').select('profile_visibility,activity_visibility,share_distance,share_achievements').eq('user_id', userId).maybeSingle()
    if (error) throw error
    return {
      profileVisibility: data?.profile_visibility === 'private' ? 'private' : 'public',
      activityVisibility: data?.activity_visibility === 'private' ? 'private' : 'public',
      shareDistance: data?.share_distance ?? true,
      shareAchievements: data?.share_achievements ?? true,
    }
  },

  async saveMyProfileSettings(userId: string, settings: CommunityProfileSettings) {
    if (!supabase) throw new Error('A conexão com a Comunidade não está disponível.')
    const { error } = await supabase.from('community_profile_settings').upsert({
      user_id: userId,
      profile_visibility: settings.profileVisibility,
      activity_visibility: settings.activityVisibility,
      share_distance: settings.shareDistance,
      share_achievements: settings.shareAchievements,
    }, { onConflict: 'user_id' })
    if (error) throw error
  },

  async loadMyProfileEditor(userId: string): Promise<CommunityProfileEditor> {
    if (!supabase) throw new Error('A conexão com a Comunidade não está disponível.')
    const [settingsResult, profileResult] = await Promise.all([
      supabase.from('community_profile_settings').select('username,bio,profile_visibility,activity_visibility,share_distance,share_achievements,avatar_source,avatar_key').eq('user_id', userId).maybeSingle(),
      supabase.from('profiles').select('avatar_url').eq('id', userId).maybeSingle(),
    ])
    if (settingsResult.error) throw settingsResult.error
    if (profileResult.error) throw profileResult.error
    const setting = settingsResult.data
    return {
      username: setting?.username ?? '', bio: setting?.bio ?? '', avatarUrl: profileResult.data?.avatar_url ?? null,
      profileVisibility: setting?.profile_visibility === 'private' ? 'private' : 'public',
      activityVisibility: setting?.activity_visibility === 'private' ? 'private' : 'public',
      shareDistance: setting?.share_distance ?? true, shareAchievements: setting?.share_achievements ?? true,
      avatarSource: setting?.avatar_source === 'custom' || setting?.avatar_source === 'system' ? setting.avatar_source : 'initials',
      avatarKey: setting?.avatar_key ?? null,
    }
  },

  async saveMyProfileEditor(userId: string, editor: CommunityProfileEditor) {
    if (!supabase) throw new Error('A conexão com a Comunidade não está disponível.')
    const username = editor.username.trim().replace(/^@+/, '').toLowerCase()
    const bio = editor.bio.trim()
    const { error } = await supabase.from('community_profile_settings').upsert({
      user_id: userId, username: username || null, bio: bio || null,
      profile_visibility: editor.profileVisibility, activity_visibility: editor.activityVisibility,
      share_distance: editor.shareDistance, share_achievements: editor.shareAchievements,
      avatar_source: editor.avatarSource, avatar_key: editor.avatarKey,
    }, { onConflict: 'user_id' })
    if (error) {
      if (error.code === '23505') throw new Error('Esse @ já está em uso. Escolha outro.')
      throw error
    }
  },

  async uploadMyProfileAvatar(userId: string, file: File, currentAvatarKey: string | null): Promise<{ avatarUrl: string; avatarKey: string }> {
    if (!supabase) throw new Error('A conexão com a Comunidade não está disponível.')
    const prepared = await prepareProfileAvatar(file)
    const avatarKey = `${userId}/avatar-${createUuid()}.webp`
    const { error: uploadError } = await supabase.storage.from('community-profile-avatars').upload(avatarKey, prepared, { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
    if (uploadError) throw uploadError
    const { data } = supabase.storage.from('community-profile-avatars').getPublicUrl(avatarKey)
    const avatarUrl = data.publicUrl
    const { error: profileError } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId)
    if (profileError) { await supabase.storage.from('community-profile-avatars').remove([avatarKey]); throw profileError }
    if (currentAvatarKey) void supabase.storage.from('community-profile-avatars').remove([currentAvatarKey])
    return { avatarUrl, avatarKey }
  },

  async searchProfiles(term: string): Promise<CommunityProfileSearchResult[]> {
    if (!supabase || term.trim().replace(/^@/, '').length < 2) return []
    const { data, error } = await supabase.rpc('community_search_profiles', { search_term: term })
    if (error) throw error
    return (data ?? []).map((item: any) => ({ userId: item.user_id, name: item.full_name, username: item.username, avatarUrl: item.avatar_url ?? null, isPrivate: Boolean(item.is_private) }))
  },

  async loadUserPosts(userId: string, viewerId: string): Promise<CommunityPost[]> {
    if (!supabase) return []
    const { data, error } = await supabase.from('posts').select('id,user_id,type,caption,created_at,is_permanent,expires_at,post_media(storage_path),outdoor_activities(distance_km,duration_seconds)').eq('user_id', userId).order('created_at', { ascending: false }).limit(40)
    if (error) throw error
    const posts = (data ?? []) as unknown as RawPost[]
    const engagementResult = posts.length ? await supabase.rpc('community_feed_engagement', { target_post_ids: posts.map((post) => post.id) }) : { data: [], error: null }
    if (engagementResult.error) throw engagementResult.error
    const engagement = new Map<string, EngagementRow>((engagementResult.data ?? []).map((item: any) => [item.post_id, item]))
    const profiles = await loadProfiles([userId])
    return Promise.all(posts.map((post) => hydratePost(post, profiles, engagement.get(post.id), viewerId)))
  },

  async toggleFollow(targetUserId: string, viewerId: string, following: boolean) {
    if (!supabase) throw new Error('A conexão com a Comunidade não está disponível.')
    if (targetUserId === viewerId) throw new Error('Você não pode seguir seu próprio perfil.')
    const { error } = following
      ? await supabase.from('follows').delete().eq('follower_id', viewerId).eq('following_id', targetUserId)
      : await supabase.from('follows').insert({ follower_id: viewerId, following_id: targetUserId })
    if (error) throw error
  },

  async listRecentActivities(userId: string, type: 'running' | 'walking'): Promise<RecentCommunityActivity[]> {
    if (!supabase) return []
    const activityTypes = type === 'running' ? ['run', 'treadmill'] : ['walk']
    const { data, error } = await supabase.from('outdoor_activities').select('id,type,started_at,distance_km,duration_seconds')
      .eq('user_id', userId).in('type', activityTypes).order('started_at', { ascending: false }).limit(8)
    if (error) throw error
    return (data ?? []).map((activity: any) => ({
      id: activity.id,
      type,
      label: `${type === 'running' ? 'Corrida' : 'Caminhada'} · ${Number(activity.distance_km ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km · ${formatMinutes(Number(activity.duration_seconds ?? 0))}`,
    }))
  },

  async createPost(input: CreateCommunityPostInput) {
    if (!supabase) throw new Error('A conexão com a Comunidade não está disponível.')
    const postId = createUuid()
    const objectKey = createUuid()
    const folder = `posts/${input.userId}/${postId}`
    const storagePath = `${folder}/image-${objectKey}.webp`
    const thumbnailPath = `${folder}/thumb-${objectKey}.webp`
    const notify = input.onProgress ?? (() => undefined)
    let postInserted = false

    try {
      notify(18, 'Enviando foto otimizada…')
      const originalUpload = await supabase.storage.from('community-media').upload(storagePath, input.image.image, {
        contentType: 'image/webp', cacheControl: '31536000', upsert: false,
      })
      if (originalUpload.error) throw originalUpload.error

      notify(55, 'Preparando miniatura…')
      const thumbnailUpload = await supabase.storage.from('community-media').upload(thumbnailPath, input.image.thumbnail, {
        contentType: 'image/webp', cacheControl: '31536000', upsert: false,
      })
      if (thumbnailUpload.error) throw thumbnailUpload.error

      notify(75, 'Criando publicação…')
      const { error: postError } = await supabase.from('posts').insert({
        id: postId, user_id: input.userId, type: input.type, caption: input.caption.trim(),
        activity_id: input.activityId, status: 'hidden', visibility: 'public',
      })
      if (postError) throw postError
      postInserted = true

      const { error: mediaError } = await supabase.from('post_media').insert({
        post_id: postId, storage_path: storagePath, thumbnail_path: thumbnailPath, media_type: 'image',
        width: input.image.width, height: input.image.height, size_bytes: input.image.image.size,
      })
      if (mediaError) throw mediaError

      const { error: publishError } = await supabase.from('posts').update({ status: 'published' }).eq('id', postId).eq('user_id', input.userId)
      if (publishError) throw publishError
      notify(100, 'Publicado')
      return postId
    } catch (error) {
      if (postInserted) await supabase.from('posts').delete().eq('id', postId).eq('user_id', input.userId)
      await supabase.storage.from('community-media').remove([storagePath, thumbnailPath])
      throw error
    }
  },
}

export async function prepareCommunityImage(file: File): Promise<PreparedCommunityImage> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha uma imagem para publicar.')
  if (file.size > 15 * 1024 * 1024) throw new Error('Escolha uma imagem de até 15 MB para que possamos otimizá-la.')
  const source = await loadImage(file)
  const image = await compress(source, 1080, 600 * 1024, 1258291)
  const thumbnail = await compress(source, 480, 96 * 1024, 300 * 1024)
  return { image: image.blob, thumbnail: thumbnail.blob, width: image.width, height: image.height, previewUrl: URL.createObjectURL(image.blob) }
}

async function prepareProfileAvatar(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha uma imagem para o perfil.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Escolha uma imagem de até 5 MB para o perfil.')
  const source = await loadImage(file)
  const avatar = await compress(source, 640, 180 * 1024, 450 * 1024)
  return avatar.blob
}

async function loadProfiles(userIds: string[]) {
  if (!supabase || !userIds.length) return new Map<string, { name: string; avatarUrl: string | null }>()
  const { data, error } = await supabase.from('community_profiles').select('id,full_name,avatar_url').in('id', userIds)
  if (error) throw error
  return new Map((data ?? []).map((profile: any) => [profile.id, { name: profile.full_name?.trim() || 'Membro MOVELYA', avatarUrl: profile.avatar_url ?? null }]))
}

async function hydratePost(post: RawPost, profiles: Map<string, { name: string; avatarUrl: string | null }>, engagement: EngagementRow | undefined, userId: string): Promise<CommunityPost> {
  const mediaPath = post.post_media?.[0]?.storage_path
  const client = supabase
  let mediaUrl: string | null = null
  if (mediaPath && client) {
    const signed = await client.storage.from('community-media').createSignedUrl(mediaPath, 60 * 30)
    mediaUrl = signed.data?.signedUrl ?? null
  }
  const activity = Array.isArray(post.outdoor_activities) ? post.outdoor_activities[0] : post.outdoor_activities
  return {
    id: post.id, userId: post.user_id, type: post.type, caption: post.caption, createdAt: post.created_at, isPermanent: post.is_permanent, expiresAt: post.expires_at,
    likedByMe: engagement?.liked_by_me ?? false, likes: Number(engagement?.likes_count ?? 0), comments: Number(engagement?.comments_count ?? 0),
    profile: profiles.get(post.user_id) ?? { name: 'Membro MOVELYA', avatarUrl: null }, mediaUrl,
    activity: activity ? { distanceKm: Number(activity.distance_km ?? 0), durationSeconds: Number(activity.duration_seconds ?? 0) } : null,
  }
}

function startOfWeek() { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return date }
function emptyCommunityData(): CommunityData { return { summary: { streak: 0, bestStreak: 0, weeklyWorkouts: 0, position: null }, posts: [], ranking: emptyCommunityRanking() } }

async function loadCommunityRanking(scope: CommunityRankingScope, category: CommunityRankingCategory, limit: number): Promise<CommunityRankingData> {
  if (!supabase) return emptyCommunityRanking(scope, category)
  const { data, error } = await supabase.rpc('community_rankings', { ranking_scope: scope, ranking_category: category, requested_limit: limit })
  if (error) throw error
  return mapCommunityRanking(data, category, scope)
}

function mapCommunityRanking(data: unknown, fallbackCategory: CommunityRankingCategory, fallbackScope: CommunityRankingScope = 'global'): CommunityRankingData {
  const item = (data ?? {}) as any
  return {
    scope: item.scope === 'friends' ? 'friends' : fallbackScope,
    category: item.category === 'workouts' || item.category === 'distance' ? item.category : fallbackCategory === 'workouts' || fallbackCategory === 'distance' ? fallbackCategory : 'streak',
    weekStart: String(item.week_start ?? ''), timezone: String(item.timezone ?? 'America/Sao_Paulo'),
    entries: Array.isArray(item.entries) ? item.entries.map((entry: any) => ({
      userId: String(entry.user_id), name: String(entry.name ?? 'Membro MOVELYA'), avatarUrl: entry.avatar_url ?? null,
      metric: Number(entry.metric ?? 0), position: Number(entry.position ?? 0), isCurrentUser: Boolean(entry.is_current_user),
    })) : [],
    myPosition: item.my_position === null || item.my_position === undefined ? null : Number(item.my_position),
    myMetric: item.my_metric === null || item.my_metric === undefined ? null : Number(item.my_metric),
  }
}

function mapCommunityClub(item: any): CommunityClub {
  return {
    id: String(item.id ?? ''), name: String(item.name ?? 'Clube MOVELYA'), description: String(item.description ?? ''),
    avatarUrl: item.avatar_url ?? null, coverUrl: item.cover_url ?? null, membersCount: Number(item.members_count ?? 0),
    challengesCount: Number(item.challenges_count ?? (Array.isArray(item.challenges) ? item.challenges.length : 0)), joined: Boolean(item.joined),
  }
}

function emptyCommunityRanking(scope: CommunityRankingScope = 'global', category: CommunityRankingCategory = 'streak'): CommunityRankingData {
  return { scope, category, weekStart: '', timezone: 'America/Sao_Paulo', entries: [], myPosition: null, myMetric: null }
}

function createUuid() { return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}` }
function formatMinutes(seconds: number) { return `${Math.max(1, Math.round(seconds / 60))} min` }

async function loadImage(file: File) {
  const sourceUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Não foi possível ler essa foto. Tente JPG, PNG ou WebP.')); image.src = sourceUrl })
    return image
  } finally { URL.revokeObjectURL(sourceUrl) }
}

async function compress(source: HTMLImageElement, maxSide: number, targetBytes: number, maxBytes: number) {
  const ratio = Math.min(1, maxSide / Math.max(source.naturalWidth, source.naturalHeight))
  let width = Math.max(1, Math.round(source.naturalWidth * ratio))
  let height = Math.max(1, Math.round(source.naturalHeight * ratio))
  let best: Blob | null = null
  for (let scaleAttempt = 0; scaleAttempt < 4; scaleAttempt += 1) {
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Não foi possível preparar essa foto.')
    context.drawImage(source, 0, 0, width, height)
    for (const quality of [.86, .8, .74, .68, .62]) {
      const blob = await canvasToWebp(canvas, quality)
      best = blob
      if (blob.size <= targetBytes) return { blob, width, height }
    }
    width = Math.max(1, Math.round(width * .84)); height = Math.max(1, Math.round(height * .84))
  }
  if (!best || best.size > maxBytes) throw new Error('Não foi possível otimizar a foto para um tamanho seguro. Escolha outra imagem.')
  return { blob: best, width, height }
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Seu navegador não conseguiu comprimir esta imagem.')), 'image/webp', quality))
}
