import { json } from '../../../_lib/auth.js'

const NOTIFY_URL = 'https://dostime-cron.doswowo.workers.dev/notify'

function badRequest(msg) {
  return json({ error: msg }, 400)
}

export async function onRequestGet({ params, env }) {
  const postId = Number(params.id)
  if (!Number.isInteger(postId) || postId <= 0) return badRequest('参数错误')
  const { results } = await env.DB
    .prepare('SELECT id, name, content, created_at FROM comments WHERE post_id = ? ORDER BY id ASC')
    .bind(postId)
    .all()
  return json({ comments: results || [] })
}

export async function onRequestPost({ request, params, env, ctx }) {
  const postId = Number(params.id)
  if (!Number.isInteger(postId) || postId <= 0) return badRequest('参数错误')
  const body = await request.json().catch(() => ({}))
  const name = String(body.name || '').trim().slice(0, 30)
  const content = String(body.content || '').trim().slice(0, 1000)
  if (!name) return badRequest('请填写姓名')
  if (!content) return badRequest('请填写评论内容')
  const post = await env.DB.prepare('SELECT id, title, content FROM posts WHERE id = ?').bind(postId).first()
  if (!post) return json({ error: '日记不存在' }, 404)
  const r = await env.DB
    .prepare('INSERT INTO comments (post_id, name, content) VALUES (?, ?, ?)')
    .bind(postId, name, content)
    .run()
  const row = await env.DB
    .prepare('SELECT id, name, content, created_at FROM comments WHERE id = ?')
    .bind(r.meta.last_row_id)
    .first()
  if (ctx && ctx.waitUntil && env.CRON_SECRET) {
    ctx.waitUntil(
      fetch(NOTIFY_URL, {
        method: 'POST',
        headers: { 'X-Cron-Key': env.CRON_SECRET, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'comment',
          post: { title: post.title, content: post.content },
          comment: { name, content, createdAt: row.created_at }
        })
      }).then(r => r.json()).catch(() => {})
    )
  }
  return json({ ok: true, comment: row })
}
