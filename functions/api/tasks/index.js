import { requireAuth, json } from '../../_lib/auth.js'
import { bjTodayStr } from '../../_lib/schedule.js'

export async function onRequestGet({ request, env }) {
  if (!(await requireAuth(request, env))) return json({ error: '未登录' }, 401)
  const today = bjTodayStr()
  const { results } = await env.DB
    .prepare('SELECT * FROM tasks ORDER BY completed ASC, due_date ASC, id DESC')
    .all()
  const tasks = (results || []).map(t => ({
    ...t,
    overdue: !t.completed && t.due_date < today,
    due_today: !t.completed && t.due_date === today
  }))
  return json({ tasks, today })
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAuth(request, env))) return json({ error: '未登录' }, 401)
  const body = await request.json().catch(() => ({}))
  const title = String(body.title || '').trim().slice(0, 100)
  const note = String(body.note || '').trim().slice(0, 2000)
  const dueDate = String(body.due_date || '').trim()
  const recurrence = ['once', 'daily', 'weekly', 'monthly', 'yearly'].includes(body.recurrence) ? body.recurrence : 'once'
  if (!title) return json({ error: '任务内容不能为空' }, 400)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return json({ error: '任务日期格式应为 YYYY-MM-DD' }, 400)
  const r = await env.DB
    .prepare('INSERT INTO tasks (title, note, due_date, recurrence) VALUES (?, ?, ?, ?)')
    .bind(title, note, dueDate, recurrence)
    .run()
  return json({ ok: true, id: r.meta.last_row_id })
}
