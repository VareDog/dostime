import { requireAuth, json } from '../../_lib/auth.js'
import { bjTodayStr, bjAddDays } from '../../_lib/schedule.js'

function validDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s || '')
}

function validTime(s) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s || '')
}

export async function onRequestPut({ request, params, env }) {
  if (!(await requireAuth(request, env))) return json({ error: '未登录' }, 401)
  const body = await request.json().catch(() => ({}))
  const task = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(params.id).first()
  if (!task) return json({ error: '未找到' }, 404)

  if (body.action === 'complete') {
    const completeDate = validDate(body.complete_date) ? body.complete_date : bjTodayStr()
    const next = bjAddDays(completeDate, task.cycle_days)
    await env.DB.prepare('UPDATE tasks SET complete_date = ?, next_date = ?, last_slot1_date = NULL, last_slot2_date = NULL WHERE id = ?')
      .bind(completeDate, next, params.id)
      .run()
    return json({ ok: true, complete_date: completeDate, next_date: next, rolled: true })
  }

  if (body.action === 'toggle') {
    const enabled = task.enabled ? 0 : 1
    await env.DB.prepare('UPDATE tasks SET enabled = ? WHERE id = ?').bind(enabled, params.id).run()
    return json({ ok: true, enabled })
  }

  const title = body.title !== undefined ? String(body.title).trim().slice(0, 100) : task.title
  const cycleDays = body.cycle_days !== undefined ? Number(body.cycle_days) : task.cycle_days
  const completeDate = body.complete_date !== undefined ? String(body.complete_date).trim() : task.complete_date
  const t1 = body.remind_time_1 !== undefined ? String(body.remind_time_1).trim() : task.remind_time_1
  const t2 = body.remind_time_2 !== undefined ? String(body.remind_time_2).trim() : task.remind_time_2
  if (!title) return json({ error: '任务内容不能为空' }, 400)
  if (!Number.isInteger(cycleDays) || cycleDays < 1 || cycleDays > 3650) return json({ error: '周期天数应为 1-3650 的整数' }, 400)
  if (!validDate(completeDate)) return json({ error: '完成日期格式应为 YYYY-MM-DD' }, 400)
  if (!validTime(t1)) return json({ error: '提醒时段1 格式应为 HH:MM' }, 400)
  if (t2 && !validTime(t2)) return json({ error: '提醒时段2 格式应为 HH:MM' }, 400)
  const nextDate = bjAddDays(completeDate, cycleDays)
  const changed = cycleDays !== task.cycle_days || completeDate !== task.complete_date || nextDate !== task.next_date
  const slotChanged = t1 !== task.remind_time_1 || (t2 || null) !== (task.remind_time_2 || null)
  await env.DB.prepare('UPDATE tasks SET title = ?, cycle_days = ?, complete_date = ?, next_date = ?, remind_time_1 = ?, remind_time_2 = ?, last_slot1_date = ?, last_slot2_date = ? WHERE id = ?')
    .bind(
      title,
      cycleDays,
      completeDate,
      nextDate,
      t1,
      t2 || null,
      changed || slotChanged ? null : task.last_slot1_date,
      changed || slotChanged ? null : task.last_slot2_date,
      params.id
    )
    .run()
  return json({ ok: true, next_date: nextDate })
}

export async function onRequestDelete({ request, params, env }) {
  if (!(await requireAuth(request, env))) return json({ error: '未登录' }, 401)
  const r = await env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(params.id).run()
  if (!r.meta.changes) return json({ error: '未找到' }, 404)
  return json({ ok: true })
}
