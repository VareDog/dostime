import { requireAuth, json } from '../../_lib/auth.js'
import { bjTodayStr, bjAddDays, bjNowStr } from '../../_lib/schedule.js'

function diffDays(fromDate, toDate) {
  return Math.round((Date.parse(toDate + 'T00:00:00Z') - Date.parse(fromDate + 'T00:00:00Z')) / 86400000)
}

function validDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s || '')
}

function validTime(s) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s || '')
}

export async function onRequestGet({ env }) {
  const today = bjTodayStr()
  const { results } = await env.DB
    .prepare('SELECT * FROM tasks ORDER BY enabled DESC, next_date ASC, id DESC')
    .all()
  const tasks = (results || []).map(t => ({
    ...t,
    over_days: t.enabled && t.next_date < today ? diffDays(t.next_date, today) : 0,
    due_today: t.enabled && t.next_date === today
  }))
  return json({ tasks, today })
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAuth(request, env))) return json({ error: '未登录' }, 401)
  const body = await request.json().catch(() => ({}))
  const title = String(body.title || '').trim().slice(0, 100)
  const cycleDays = Number(body.cycle_days)
  const completeDate = String(body.complete_date || '').trim()
  const t1 = String(body.remind_time_1 || '').trim()
  const t2 = String(body.remind_time_2 || '').trim()
  if (!title) return json({ error: '任务内容不能为空' }, 400)
  if (!Number.isInteger(cycleDays) || cycleDays < 1 || cycleDays > 3650) return json({ error: '周期天数应为 1-3650 的整数' }, 400)
  if (!validDate(completeDate)) return json({ error: '完成日期格式应为 YYYY-MM-DD' }, 400)
  if (!validTime(t1)) return json({ error: '提醒时段1 格式应为 HH:MM' }, 400)
  if (t2 && !validTime(t2)) return json({ error: '提醒时段2 格式应为 HH:MM' }, 400)
  const nextDate = bjAddDays(completeDate, cycleDays)
  const r = await env.DB
    .prepare('INSERT INTO tasks (title, cycle_days, complete_date, next_date, remind_time_1, remind_time_2, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(title, cycleDays, completeDate, nextDate, t1, t2 || null, bjNowStr())
    .run()
  return json({ ok: true, id: r.meta.last_row_id, next_date: nextDate })
}
