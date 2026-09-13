import { json } from '../../../_lib/auth.js'
import { bjNowStr } from '../../../_lib/schedule.js'

const NOTIFY_URL = 'https://dostime-cron.doswowo.workers.dev/notify'

function badRequest(msg) {
  return json({ error: msg }, 400)
}

export async function onRequestGet({ params, env }) {
  const postId = Number(params.id)
  if (!Number.isInteger(postId) || postId <= 0) return badRequest('参数错误')
  const { results } = await env.DB
    .prepare('SELECT id, name, phone, content, created_at FROM comments WHERE post_id = ? ORDER BY id ASC')
    .bind(postId)
    .all()
  return json({ comments: results || [] })
}

export async function onRequestPost({ request, params, env, ctx }) {
  const postId = Number(params.id)
  if (!Number.isInteger(postId) || postId <= 0) return badRequest('参数错误')
  const body = await request.json().catch(() => ({}))
  const name = String(body.name || '').trim().slice(0, 30)
  const phone = String(body.phone || '').trim().slice(0, 20)
  const content = String(body.content || '').trim().slice(0, 1000)
  if (!name) return badRequest('请填写姓名')
  if (!phone) return badRequest('请填写电话')
  if (!/^[0-9+\-\s()]{5,20}$/.test(phone)) return badRequest('电话格式不正确')
  if (!content) return badRequest('请填写评论内容')
  const post = await env.DB.prepare('SELECT id, title, content FROM posts WHERE id = ?').bind(postId).first()
  if (!post) return json({ error: '日记不存在' }, 404)
  const r = await env.DB
    .prepare('INSERT INTO comments (post_id, name, phone, content, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(postId, name, phone, content, bjNowStr())
    .run()
  const row = await env.DB
    .prepare('SELECT id, name, phone, content, created_at FROM comments WHERE id = ?')
    .bind(r.meta.last_row_id)
    .first()
  let notify = { sent: false, reason: '未配置通知' }
  if (env.CRON_SECRET) {
    try {
      const res = await fetch(NOTIFY_URL, {
        method: 'POST',
        headers: { 'X-Cron-Key': env.CRON_SECRET, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'comment',
          post: { title: post.title, content: post.content },
          comment: { name, phone, content, createdAt: row.created_at }
        })
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) notify = { sent: true, via: data.via }
      else notify = { sent: false, reason: `status=${res.status} via=${data.via || 'unknown'}` }
    } catch (e) {
      notify = { sent: false, reason: String(e && e.message ? e.message : e).slice(0, 200) }
    }
  }
  return json({ ok: true, comment: row, notify })
}
