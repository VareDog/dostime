import { requireAuth, json } from '../../_lib/auth.js'
import { futureNextSendAt, validateSchedule, initialNextSendAt } from '../../_lib/schedule.js'

export async function onRequestPut({ request, params, env }) {
  if (!(await requireAuth(request, env))) return json({ error: '未登录' }, 401)
  const body = await request.json().catch(() => ({}))
  const existing = await env.DB.prepare('SELECT * FROM scheduled_emails WHERE id = ?').bind(params.id).first()
  if (!existing) return json({ error: '未找到' }, 404)

  if (typeof body.enabled === 'boolean') {
    const next = body.enabled ? futureNextSendAt(existing) : existing.next_send_at
    await env.DB.prepare('UPDATE scheduled_emails SET enabled = ?, next_send_at = ? WHERE id = ?')
      .bind(body.enabled ? 1 : 0, next, params.id)
      .run()
    return json({ ok: true, next_send_at: next })
  }

  const err = validateSchedule(body)
  if (err) return json({ error: err }, 400)
  const freq = body.frequency
  const job = {
    title: String(body.title || '').trim().slice(0, 100),
    content: String(body.content || '').trim(),
    frequency: freq,
    weekday: freq === 'weekly' ? Number(body.weekday) : null,
    monthday: freq === 'monthly' || freq === 'yearly' ? Number(body.monthday) : null,
    month: freq === 'yearly' ? Number(body.month) : null,
    send_time: String(body.send_time || '08:00')
  }
  const next = futureNextSendAt(job)
  await env.DB
    .prepare('UPDATE scheduled_emails SET title = ?, content = ?, frequency = ?, weekday = ?, monthday = ?, month = ?, send_time = ?, next_send_at = ? WHERE id = ?')
    .bind(job.title, job.content, job.frequency, job.weekday, job.monthday, job.month, job.send_time, next, params.id)
    .run()
  return json({ ok: true, next_send_at: next })
}

export async function onRequestDelete({ request, params, env }) {
  if (!(await requireAuth(request, env))) return json({ error: '未登录' }, 401)
  const r = await env.DB.prepare('DELETE FROM scheduled_emails WHERE id = ?').bind(params.id).run()
  if (!r.meta.changes) return json({ error: '未找到' }, 404)
  return json({ ok: true })
}
