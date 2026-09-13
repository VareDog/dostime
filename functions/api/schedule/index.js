import { requireAuth, json } from '../../_lib/auth.js'
import { initialNextSendAt, validateSchedule, describeSchedule, bjNowStr } from '../../_lib/schedule.js'

function shape(body) {
  const freq = body.frequency
  return {
    title: String(body.title || '').trim().slice(0, 100),
    content: String(body.content || '').trim(),
    frequency: freq,
    weekday: freq === 'weekly' ? Number(body.weekday) : null,
    monthday: freq === 'monthly' || freq === 'yearly' ? Number(body.monthday) : null,
    month: freq === 'yearly' ? Number(body.month) : null,
    send_time: String(body.send_time || '08:00')
  }
}

export async function onRequestGet({ request, env }) {
  if (!(await requireAuth(request, env))) return json({ error: '未登录' }, 401)
  const { results } = await env.DB.prepare('SELECT * FROM scheduled_emails ORDER BY id DESC').all()
  return json({ jobs: results || [] })
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAuth(request, env))) return json({ error: '未登录' }, 401)
  const body = await request.json().catch(() => ({}))
  const err = validateSchedule(body)
  if (err) return json({ error: err }, 400)
  const job = shape(body)
  const next = initialNextSendAt(job)
  const r = await env.DB
    .prepare('INSERT INTO scheduled_emails (title, content, frequency, weekday, monthday, month, send_time, enabled, next_send_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)')
    .bind(job.title, job.content, job.frequency, job.weekday, job.monthday, job.month, job.send_time, next, bjNowStr())
    .run()
  return json({ ok: true, id: r.meta.last_row_id, next_send_at: next })
}
