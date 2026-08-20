type ExpiredPost = { post_id: string; storage_path: string | null; thumbnail_path: string | null }
const batchSize = 50
const maxBatchesPerRun = 6

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  const cronSecret = Deno.env.get('COMMUNITY_CLEANUP_CRON_SECRET')
  if (!cronSecret || request.headers.get('x-movelya-cron-secret') !== cronSecret) return json({ error: 'Não autorizado.' }, 401)
  const baseUrl = Deno.env.get('SUPABASE_URL'), serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!baseUrl || !serviceKey) return json({ error: 'Limpeza da Comunidade não configurada.' }, 503)

  let deletedPosts = 0, deletedFiles = 0
  try {
    for (let batch = 0; batch < maxBatchesPerRun; batch += 1) {
      const expired = await rpc<ExpiredPost[]>(baseUrl, serviceKey, 'list_expired_community_posts', { batch_size: batchSize })
      if (!expired.ok) return json({ error: 'Não foi possível localizar publicações expiradas.' }, 502)
      const expiredPosts = expired.data ?? []
      if (!expiredPosts.length) break
      const paths = [...new Set(expiredPosts.flatMap((post) => [post.storage_path, post.thumbnail_path]).filter((path): path is string => Boolean(path)))]
      if (paths.length) {
        const storage = await fetch(`${baseUrl}/storage/v1/object/community-media`, { method: 'DELETE', headers: { ...headers(serviceKey), 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: paths }) })
        if (!storage.ok) return json({ error: 'Não foi possível remover os arquivos expirados; nenhuma publicação foi apagada.' }, 502)
        deletedFiles += paths.length
      }
      const ids = [...new Set(expiredPosts.map((post) => post.post_id))]
      const removed = await rpc<number>(baseUrl, serviceKey, 'delete_expired_community_posts', { target_post_ids: ids })
      if (!removed.ok) return json({ error: 'Os arquivos foram removidos, mas a finalização será tentada novamente.' }, 502)
      deletedPosts += Number(removed.data ?? 0)
      if (expiredPosts.length < batchSize) break
    }
    return json({ deleted_posts: deletedPosts, deleted_files: deletedFiles })
  } catch (error) {
    console.error('community expiration cleanup failed', error)
    return json({ error: 'Não foi possível concluir a limpeza de publicações expiradas.' }, 500)
  }
})

async function rpc<T>(baseUrl: string, serviceKey: string, name: string, body: Record<string, unknown>) {
  const result = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers: { ...headers(serviceKey), 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { ok: result.ok, data: result.ok ? await result.json() as T : null }
}
function headers(key: string) { return { apikey: key, Authorization: `Bearer ${key}` } }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } }) }
