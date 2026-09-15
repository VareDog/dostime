import { requireAuth, json } from '../../_lib/auth.js'
import { sendNotify } from '../../_lib/notify.js'
import { bjNowStr } from '../../_lib/schedule.js'

function autoTitle(title, content) {
  const t = (title || '').trim()
  if (t) return t.slice(0, 100)
  return Array.from(content.trim().replace(/\s+/g, ' ')).slice(0, 12).join('') || '无题'
}

export async function onRequestGet({ env }) {
  const { results } = await env.DB
    .prepare('SELECT id, title, substr(content, 1, 160) AS summary, images, pinned, private, created_at FROM posts ORDER BY pinned DESC, id DESC')
    .all()
  const posts = (results || []).map(p => ({ ...p, images: JSON.parse(p.images || '[]') }))
  return json({ posts })
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAuth(request, env))) return json({ error: '未登录' }, 401)
  const body = await request.json().catch(() => ({}))
  const title = autoTitle(body.title, body.content || '')
  const content = (body.content || '').trim()
  const images = Array.isArray(body.images) ? body.images.slice(0, 20) : []
  const pinned = body.pinned ? 1 : 0
  const priv = body.private ? 1 : 0
  if (!content) return json({ error: '内容不能为空' }, 400)
  const createdAt = bjNowStr()
  const r = await env.DB
    .prepare('INSERT INTO posts (title, content, images, pinned, private, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(title, content, JSON.stringify(images), pinned, priv, createdAt)
    .run()
  let email = { sent: false, reason: '未知' }
  try {
    email = await sendNotify(env, {
      title,
      content,
      images,
      createdAt: createdAt.slice(0, 16)
    })
  } catch (e) {
    email = { sent: false, reason: String(e && e.message ? e.message : e).slice(0, 200) }
  }
  return json({ ok: true, id: r.meta.last_row_id, title, email })
}
