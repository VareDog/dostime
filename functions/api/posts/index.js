import { requireAuth, json } from '../../_lib/auth.js'

const NOTIFY_URL = 'https://dostime-cron.doswowo.workers.dev/notify'

async function sendEmail(env, { title, content, images, createdAt }) {
  if (!env.CRON_SECRET) return { sent: false, reason: '通知密钥未配置' }
  try {
    const res = await fetch(NOTIFY_URL, {
      method: 'POST',
      headers: { 'X-Cron-Key': env.CRON_SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, images, createdAt })
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.ok) return { sent: true, via: data.via }
    return { sent: false, reason: `via=${data.via || 'unknown'} status=${res.status}` }
  } catch (e) {
    return { sent: false, reason: String(e && e.message ? e.message : e).slice(0, 200) }
  }
}

export async function onRequestGet({ env }) {
  const { results } = await env.DB
    .prepare('SELECT id, title, substr(content, 1, 160) AS summary, images, pinned, created_at FROM posts ORDER BY pinned DESC, id DESC')
    .all()
  const posts = (results || []).map(p => ({ ...p, images: JSON.parse(p.images || '[]') }))
  return json({ posts })
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAuth(request, env))) return json({ error: '未登录' }, 401)
  const body = await request.json().catch(() => ({}))
  const title = (body.title || '').trim().slice(0, 100)
  const content = (body.content || '').trim()
  const images = Array.isArray(body.images) ? body.images.slice(0, 20) : []
  const pinned = body.pinned ? 1 : 0
  if (!content) return json({ error: '内容不能为空' }, 400)
  const r = await env.DB
    .prepare('INSERT INTO posts (title, content, images, pinned) VALUES (?, ?, ?, ?)')
    .bind(title, content, JSON.stringify(images), pinned)
    .run()
  let email = { sent: false, reason: '未知' }
  try {
    email = await sendEmail(env, {
      title,
      content,
      images,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
    })
  } catch (e) {
    email = { sent: false, reason: String(e && e.message ? e.message : e).slice(0, 200) }
  }
  return json({ ok: true, id: r.meta.last_row_id, email })
}
