import { supabase } from '../integrations/supabase'

export type CommunityPostType = 'workout' | 'running' | 'walking' | 'food' | 'achievement' | 'general_fitness'

export interface CommunityPost {
  id: string
  userId: string
  type: CommunityPostType
  caption: string
  createdAt: string
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
  activeDays: number
  position: number
}

export interface CommunityData {
  summary: { streak: number; weeklyWorkouts: number; position: number | null }
  posts: CommunityPost[]
  ranking: CommunityRankingItem[]
}

type RawPost = {
  id: string; user_id: string; type: CommunityPostType; caption: string; created_at: string
  post_media?: Array<{ storage_path: string }>
  post_likes?: Array<{ user_id?: string }>
  post_comments?: Array<{ id: string }>
  outdoor_activities?: { distance_km: number | null; duration_seconds: number | null } | null
}

export const communityService = {
  async load(userId: string): Promise<CommunityData> {
    if (!supabase || userId === 'development-preview') return emptyCommunityData()

    const weekStart = startOfWeek()
    const activeSince = new Date()
    activeSince.setDate(activeSince.getDate() - 89)
    const [postsResult, dailyStatsResult, workoutsResult, activitiesResult, mealsResult] = await Promise.all([
      supabase.from('posts').select('id,user_id,type,caption,created_at,post_media(storage_path),post_likes(user_id),post_comments(id),outdoor_activities(distance_km,duration_seconds)').order('created_at', { ascending: false }).limit(40),
      supabase.from('daily_stats').select('date').eq('user_id', userId).gte('date', dayKey(activeSince)),
      supabase.from('workout_sessions').select('ended_at,started_at').eq('user_id', userId).eq('status', 'completed').gte('started_at', activeSince.toISOString()),
      supabase.from('outdoor_activities').select('started_at').eq('user_id', userId).gte('started_at', activeSince.toISOString()),
      supabase.from('meals').select('date').eq('user_id', userId).gte('date', dayKey(activeSince)),
    ])
    if (postsResult.error) throw postsResult.error

    const posts = (postsResult.data ?? []) as unknown as RawPost[]
    const profiles = await loadProfiles([...new Set(posts.map((post) => post.user_id))])
    const hydratedPosts = await Promise.all(posts.map((post) => hydratePost(post, profiles, userId)))
    const ranking = buildRanking(posts, profiles, weekStart)
    const activeDates = new Set<string>()
    ;(dailyStatsResult.data ?? []).forEach((row: any) => activeDates.add(row.date))
    ;(workoutsResult.data ?? []).forEach((row: any) => activeDates.add(dayKey(row.ended_at ?? row.started_at)))
    ;(activitiesResult.data ?? []).forEach((row: any) => activeDates.add(dayKey(row.started_at)))
    ;(mealsResult.data ?? []).forEach((row: any) => activeDates.add(row.date))

    return {
      posts: hydratedPosts,
      ranking,
      summary: {
        streak: calculateStreak(activeDates),
        weeklyWorkouts: (workoutsResult.data ?? []).filter((row: any) => new Date(row.ended_at ?? row.started_at) >= weekStart).length,
        position: ranking.find((item) => item.userId === userId)?.position ?? null,
      },
    }
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
}

async function loadProfiles(userIds: string[]) {
  if (!supabase || !userIds.length) return new Map<string, { name: string; avatarUrl: string | null }>()
  const { data, error } = await supabase.from('community_profiles').select('id,full_name,avatar_url').in('id', userIds)
  if (error) throw error
  return new Map((data ?? []).map((profile: any) => [profile.id, { name: profile.full_name?.trim() || 'Membro MOVELYA', avatarUrl: profile.avatar_url ?? null }]))
}

async function hydratePost(post: RawPost, profiles: Map<string, { name: string; avatarUrl: string | null }>, userId: string): Promise<CommunityPost> {
  const mediaPath = post.post_media?.[0]?.storage_path
  const client = supabase
  let mediaUrl: string | null = null
  if (mediaPath && client) {
    const signed = await client.storage.from('community-media').createSignedUrl(mediaPath, 60 * 30)
    mediaUrl = signed.data?.signedUrl ?? null
  }
  const activity = Array.isArray(post.outdoor_activities) ? post.outdoor_activities[0] : post.outdoor_activities
  const likes = post.post_likes ?? []
  return {
    id: post.id, userId: post.user_id, type: post.type, caption: post.caption, createdAt: post.created_at,
    likedByMe: likes.some((like) => like.user_id === userId), likes: likes.length, comments: post.post_comments?.length ?? 0,
    profile: profiles.get(post.user_id) ?? { name: 'Membro MOVELYA', avatarUrl: null }, mediaUrl,
    activity: activity ? { distanceKm: Number(activity.distance_km ?? 0), durationSeconds: Number(activity.duration_seconds ?? 0) } : null,
  }
}

function buildRanking(posts: RawPost[], profiles: Map<string, { name: string; avatarUrl: string | null }>, weekStart: Date): CommunityRankingItem[] {
  const activeDays = new Map<string, Set<string>>()
  posts.filter((post) => new Date(post.created_at) >= weekStart).forEach((post) => {
    const days = activeDays.get(post.user_id) ?? new Set<string>()
    days.add(dayKey(post.created_at)); activeDays.set(post.user_id, days)
  })
  return [...activeDays.entries()].map(([userId, days]) => ({ userId, name: profiles.get(userId)?.name ?? 'Membro MOVELYA', avatarUrl: profiles.get(userId)?.avatarUrl ?? null, activeDays: days.size, position: 0 }))
    .sort((first, second) => second.activeDays - first.activeDays || first.name.localeCompare(second.name, 'pt-BR')).map((item, index) => ({ ...item, position: index + 1 }))
}

function calculateStreak(activeDates: Set<string>) { const cursor = new Date(); if (!activeDates.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1); let streak = 0; while (activeDates.has(dayKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1) } return streak }
function startOfWeek() { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return date }
function dayKey(value: string | Date) { const date = typeof value === 'string' ? new Date(value) : value; return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function emptyCommunityData(): CommunityData { return { summary: { streak: 0, weeklyWorkouts: 0, position: null }, posts: [], ranking: [] } }
