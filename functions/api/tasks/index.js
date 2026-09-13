import { requireAuth, json } from '../../_lib/auth.js'
import { bjTodayStr } from '../../_lib/schedule.js'

function diffDays(fromDate, toDate) {
  return Math.round((Date.parse(toDate + 'T00:00:00Z') - Date.parse(fromDate + 'T00:00:00Z')) / 86400000)
}

function validDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s || '')
}

function validTime(s) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s || '')
}

function parseBody(body, partial) {
  const out = {}
  if (!partial || body.title !== undefined) {
    out.title = String(body.title || '').trim().slice(0, 100)
    if (!out.title) return { error: '任务内容不能为空' }
  }
  if (!partial || body.cycle_days !== undefined) {
    out.cycle_days = Number(body.cycle_days)
    if (!Number.isInteger(out.cycle_days) || out.cycle_days < 1 || out.cycle_days > 3650) return { error: '周期天数应为 1-3650 的整数' }
  }
  if (!partial || body.next_date !== undefined) {
    out.next_date = String(body.next_date || '').trim()
    if (!validDate(out.next_date)) return { error: '下次日期格式应为 YYYY-MM-DD' }
  }
  if (!partial || body.remind_time_1 !== undefined) {
    out.remind_time_1 = String(body.remind_time_1 || '').trim()
    if (!validTime(out.remind_time_1)) return { error: '提醒时段1 格式应为 HH:MM' }
  }
  if (!partial || body.remind_time_2 !== undefined) {
    out.remind_time_2 = String(body.remind_time_2 || '').trim()
    if (out.remind_time_2 && !validTime(out.remind_time_2)) return { error: '提醒时段2 格式应为 HH:MM' }
  }
  return out
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
  const p = parseBody(body, false)
  if (p.error) return json({ error: p.error }, 400)
  const r = await env.DB
    .prepare('INSERT INTO tasks (title, cycle_days, next_date, remind_time_1, remind_time_2) VALUES (?, ?, ?, ?, ?)')
    .bind(p.title, p.cycle_days, p.next_date, p.remind_time_1, p.remind_time_2 || null)
    .run()
  return json({ ok: true, id: r.meta.last_row_id })
}
