import { requireAuth, json } from '../../_lib/auth.js'
import { nextDueDate } from '../../_lib/schedule.js'

export async function onRequestPut({ request, params, env }) {
  if (!(await requireAuth(request, env))) return json({ error: '未登录' }, 401)
  const body = await request.json().catch(() => ({}))
  const task = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(params.id).first()
  if (!task) return json({ error: '未找到' }, 404)

  if (body.action === 'complete') {
    if (task.recurrence && task.recurrence !== 'once') {
      const next = nextDueDate(task.due_date, task.recurrence)
      await env.DB.prepare('UPDATE tasks SET due_date = ?, completed = 0, last_notified_date = NULL WHERE id = ?').bind(next, params.id).run()
      return json({ ok: true, due_date: next, rolled: true })
    }
    await env.DB.prepare('UPDATE tasks SET completed = 1 WHERE id = ?').bind(params.id).run()
    return json({ ok: true, completed: true })
  }

  if (body.action === 'reopen') {
    await env.DB.prepare('UPDATE tasks SET completed = 0, last_notified_date = NULL WHERE id = ?').bind(params.id).run()
    return json({ ok: true })
  }

  const title = body.title !== undefined ? String(body.title).trim().slice(0, 100) : task.title
  const note = body.note !== undefined ? String(body.note).trim().slice(0, 2000) : task.note
  const dueDate = body.due_date !== undefined ? String(body.due_date).trim() : task.due_date
  const recurrence = body.recurrence !== undefined && ['once', 'daily', 'weekly', 'monthly', 'yearly'].includes(body.recurrence) ? body.recurrence : task.recurrence
  if (!title) return json({ error: '任务内容不能为空' }, 400)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return json({ error: '任务日期格式应为 YYYY-MM-DD' }, 400)
  await env.DB.prepare('UPDATE tasks SET title = ?, note = ?, due_date = ?, recurrence = ? WHERE id = ?')
    .bind(title, note, dueDate, recurrence, params.id)
    .run()
  return json({ ok: true })
}

export async function onRequestDelete({ request, params, env }) {
  if (!(await requireAuth(request, env))) return json({ error: '未登录' }, 401)
  const r = await env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(params.id).run()
  if (!r.meta.changes) return json({ error: '未找到' }, 404)
  return json({ ok: true })
}
