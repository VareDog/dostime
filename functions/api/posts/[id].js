import { requireAuth, json } from '../../_lib/auth.js'

function autoTitle(title, content) {
  const t = (title || '').trim()
  if (t) return t.slice(0, 100)
  return Array.from(content.trim().replace(/\s+/g, ' ')).slice(0, 12).join('') || '无题'
}

export async function onRequestGet({ params, env }) {
  const post = await env.DB
    .prepare('SELECT id, title, content, images, pinned, created_at, updated_at FROM posts WHERE id = ?')
    .bind(params.id)
    .first()
  if (!post) return json({ error: '未找到' }, 404)
  post.images = JSON.parse(post.images || '[]')
  return json({ post })
}

export async function onRequestPut({ request, params, env }) {
  if (!(await requireAuth(request, env))) return json({ error: '未登录' }, 401)
  const body = await request.json().catch(() => ({}))
  const title = autoTitle(body.title, body.content || '')
  const content = (body.content || '').trim()
  const images = Array.isArray(body.images) ? body.images.slice(0, 20) : []
  const pinned = body.pinned ? 1 : 0
  if (!content) return json({ error: '内容不能为空' }, 400)
  const r = await env.DB
    .prepare("UPDATE posts SET title = ?, content = ?, images = ?, pinned = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
    .bind(title, content, JSON.stringify(images), pinned, params.id)
    .run()
  if (!r.meta.changes) return json({ error: '未找到' }, 404)
  return json({ ok: true })
}

export async function onRequestDelete({ request, params, env }) {
  if (!(await requireAuth(request, env))) return json({ error: '未登录' }, 401)
  const post = await env.DB.prepare('SELECT images FROM posts WHERE id = ?').bind(params.id).first()
  if (!post) return json({ error: '未找到' }, 404)
  await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(params.id).run()
  for (const url of JSON.parse(post.images || '[]')) {
    const key = url.split('/api/images/')[1]
    if (key) await env.R2.delete(key)
  }
  return json({ ok: true })
}
