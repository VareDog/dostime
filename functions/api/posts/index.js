import { requireAuth, json, escapeHtml } from '../../_lib/auth.js'

async function sendEmail(env, { title, content, images, createdAt }) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_EMAIL) return { sent: false, reason: '邮件服务未配置' }
  const imgHtml = images
    .map(u => `<p style="margin:16px 0"><img src="https://dostime.pages.dev${escapeHtml(u)}" style="max-width:100%;border-radius:8px" alt="" /></p>`)
    .join('')
  const html = `<div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;color:#333">
    <h2 style="margin-bottom:4px">${escapeHtml(title)}</h2>
    <p style="color:#999;font-size:13px;margin-top:0">${escapeHtml(createdAt)}</p>
    <div style="font-size:15px;line-height:1.9;white-space:normal">${escapeHtml(content).replace(/\n/g, '<br/>')}</div>
    ${imgHtml}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0 12px"/>
    <p style="color:#aaa;font-size:12px">本邮件由 dostime.pages.dev 自动发送</p>
  </div>`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Dostime <onboarding@resend.dev>',
      to: [env.NOTIFY_EMAIL],
      subject: `【dostime】新日记：${title}`,
      html
    })
  })
  if (!res.ok) return { sent: false, reason: (await res.text()).slice(0, 200) }
  return { sent: true }
}

export async function onRequestGet({ env }) {
  const { results } = await env.DB
    .prepare('SELECT id, title, substr(content, 1, 160) AS summary, images, created_at FROM posts ORDER BY id DESC')
    .all()
  const posts = (results || []).map(p => ({ ...p, images: JSON.parse(p.images || '[]') }))
  return json({ posts })
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAuth(request, env))) return json({ error: '未登录' }, 401)
  const body = await request.json().catch(() => ({}))
  const title = (body.title || '').trim()
  const content = (body.content || '').trim()
  const images = Array.isArray(body.images) ? body.images.slice(0, 20) : []
  if (!title) return json({ error: '标题不能为空' }, 400)
  if (!content) return json({ error: '内容不能为空' }, 400)
  const r = await env.DB
    .prepare('INSERT INTO posts (title, content, images) VALUES (?, ?, ?)')
    .bind(title, content, JSON.stringify(images))
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
