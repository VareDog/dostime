const BJ_OFFSET_MS = 8 * 3600 * 1000

export const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
export const FREQUENCY_LABELS = { daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' }

function bjParts(from = new Date()) {
  const bj = new Date(from.getTime() + BJ_OFFSET_MS)
  return {
    y: bj.getUTCFullYear(),
    mo: bj.getUTCMonth(),
    d: bj.getUTCDate(),
    day: bj.getUTCDay() === 0 ? 7 : bj.getUTCDay()
  }
}

function daysInMonth(y, mo) {
  return new Date(Date.UTC(y, mo + 1, 0)).getUTCDate()
}

export function parseTime(t) {
  const [h, m] = String(t || '08:00').split(':').map(Number)
  return { h: h || 0, m: m || 0 }
}

export function futureNextSendAt(job, from = new Date()) {
  const { h, m } = parseTime(job.send_time)
  const { y, mo, d, day } = bjParts(from)
  const at = (yy, mm, dd) => new Date(Date.UTC(yy, mm, dd, h - 8, m))
  if (job.frequency === 'daily') {
    let t = at(y, mo, d)
    if (t <= from) t = at(y, mo, d + 1)
    return t.toISOString()
  }
  if (job.frequency === 'weekly') {
    const diff = ((job.weekday || 1) - day + 7) % 7
    let t = at(y, mo, d + diff)
    if (t <= from) t = new Date(t.getTime() + 7 * 86400000)
    return t.toISOString()
  }
  if (job.frequency === 'yearly') {
    const md = Math.min(job.monthday || 1, daysInMonth(y, (job.month || 1) - 1))
    let t = at(y, (job.month || 1) - 1, md)
    if (t <= from) {
      const ny = y + 1
      const nmd = Math.min(job.monthday || 1, daysInMonth(ny, (job.month || 1) - 1))
      t = at(ny, (job.month || 1) - 1, nmd)
    }
    return t.toISOString()
  }
  const md = Math.min(job.monthday || 1, daysInMonth(y, mo))
  let t = at(y, mo, md)
  if (t <= from) {
    const nm = mo + 1
    const ny = nm > 11 ? y + 1 : y
    const nmo = nm % 12
    const nmd = Math.min(job.monthday || 1, daysInMonth(ny, nmo))
    t = at(ny, nmo, nmd)
  }
  return t.toISOString()
}

export function initialNextSendAt(job) {
  const { y, mo, d, day } = bjParts()
  const { h, m } = parseTime(job.send_time)
  const at = (yy, mm, dd) => new Date(Date.UTC(yy, mm, dd, h - 8, m)).toISOString()
  if (job.frequency === 'daily') return at(y, mo, d)
  if (job.frequency === 'weekly') return at(y, mo, d + ((job.weekday || 1) - day + 7) % 7)
  if (job.frequency === 'yearly') return at(y, (job.month || 1) - 1, Math.min(job.monthday || 1, daysInMonth(y, (job.month || 1) - 1)))
  return at(y, mo, Math.min(job.monthday || 1, daysInMonth(y, mo)))
}

export function describeSchedule(job) {
  const t = job.send_time
  if (job.frequency === 'daily') return `每天 ${t}`
  if (job.frequency === 'weekly') return `每周${WEEKDAY_LABELS[(job.weekday || 1) - 1]} ${t}`
  if (job.frequency === 'yearly') return `每年 ${job.month} 月 ${job.monthday} 日 ${t}`
  return `每月 ${job.monthday} 号 ${t}`
}

export function bjTodayStr(from = new Date()) {
  const bj = new Date(from.getTime() + BJ_OFFSET_MS)
  return bj.toISOString().slice(0, 10)
}

export function bjNowStr(from = new Date()) {
  return new Date(from.getTime() + BJ_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ')
}

export function bjAddDays(dateStr, days) {
  return new Date(Date.parse(dateStr + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10)
}

export function validateSchedule(body) {
  const freq = body.frequency
  const sendTime = String(body.send_time || '')
  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(freq)) return '周期类型无效'
  if (!/^\d{2}:\d{2}$/.test(sendTime)) return '发送时间格式应为 HH:MM'
  const content = String(body.content || '').trim()
  if (!content) return '邮件内容不能为空'
  if (freq === 'weekly') {
    const wd = Number(body.weekday)
    if (!(wd >= 1 && wd <= 7)) return '请选择周一至周日'
  }
  if (freq === 'monthly' || freq === 'yearly') {
    const md = Number(body.monthday)
    if (!(md >= 1 && md <= 31)) return '日期应为 1-31'
  }
  if (freq === 'yearly') {
    const mo = Number(body.month)
    if (!(mo >= 1 && mo <= 12)) return '月份应为 1-12'
  }
  return null
}
