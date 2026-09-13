import { EmailMessage } from 'cloudflare:email'
import { createMimeMessage } from 'mimetext'

const BJ_OFFSET_MS = 8 * 3600 * 1000
const SITE = 'https://dostime.pages.dev'
const MAIL_FROM = 'noreply@dosday.dpdns.org'
const FROM_NAME = 'Dostime'

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

function parseTime(t) {
  const [h, m] = String(t || '08:00').split(':').map(Number)
  return { h: h || 0, m: m || 0 }
}

function futureNextSendAt(job, from = new Date()) {
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

function bjTodayStr(from = new Date()) {
  const bj = new Date(from.getTime() + BJ_OFFSET_MS)
  return bj.toISOString().slice(0, 10)
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function wrapHtml(inner) {
  return `<div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;color:#333">${inner}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0 12px"/>
    <p style="color:#aaa;font-size:12px">本邮件由 dostime.pages.dev 自动发送</p>
  </div>`
}

async function sendViaCF(env, subject, html) {
  const msg = createMimeMessage()
  msg.setSender({ name: FROM_NAME, addr: MAIL_FROM })
  msg.setRecipient(env.NOTIFY_EMAIL)
  msg.setSubject(subject)
  msg.addMessage({ contentType: 'text/html', data: html })
  const message = new EmailMessage(MAIL_FROM, env.NOTIFY_EMAIL, msg.asRaw())
  await env.SEND_EMAIL.send(message)
  return 'cf'
}

async function sendViaResend(env, subject, html) {
  if (!env.RESEND_API_KEY) return false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Dostime <onboarding@resend.dev>', to: [env.NOTIFY_EMAIL], subject, html })
  })
  return res.ok ? 'resend' : false
}

async function sendWithFallback(env, subject, html) {
  try {
    return await sendViaCF(env, subject, html)
  } catch (e) {
    return await sendViaResend(env, subject, html)
  }
}

async function processScheduledEmails(env) {
  const now = new Date().toISOString()
  const { results } = await env.DB
    .prepare('SELECT * FROM scheduled_emails WHERE enabled = 1 AND next_send_at IS NOT NULL AND next_send_at <= ?')
    .bind(now)
    .all()
  if (!results || !results.length) return 'no due emails'
  let sent = 0
  const errors = []
  for (const job of results) {
    const subject = job.title ? `【dostime】定时邮件：${job.title}` : '【dostime】定时邮件'
    const html = wrapHtml(`
      <h2 style="margin-bottom:4px">${escapeHtml(job.title || '定时邮件')}</h2>
      <p style="color:#999;font-size:13px;margin-top:0">${bjTodayStr()}</p>
      <div style="font-size:15px;line-height:1.9">${escapeHtml(job.content).replace(/\n/g, '<br/>')}</div>`)
    const via = await sendWithFallback(env, subject, html)
    if (via) {
      sent++
      await env.DB.prepare('UPDATE scheduled_emails SET next_send_at = ? WHERE id = ?')
        .bind(futureNextSendAt(job), job.id)
        .run()
    } else {
      errors.push(`id=${job.id}`)
    }
  }
  return `sent=${sent}${errors.length ? ' errors=' + errors.join(',') : ''}`
}

async function processTasks(env) {
  const today = bjTodayStr()
  const { results } = await env.DB
    .prepare("SELECT * FROM tasks WHERE completed = 0 AND due_date <= ? AND (last_notified_date IS NULL OR last_notified_date < ?)")
    .bind(today, today)
    .all()
  if (!results || !results.length) return 'no due tasks'
  let sent = 0
  for (const task of results) {
    const overdue = task.due_date < today
    const kind = overdue ? '任务已过期' : '今日到期任务'
    const subject = `【dostime】${kind}：${task.title}`
    const rec = { once: '单次', daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' }[task.recurrence] || task.recurrence
    const html = wrapHtml(`
      <h2 style="margin-bottom:4px">${escapeHtml(task.title)}</h2>
      <p style="color:#b4443c;font-size:13px;margin-top:0">${kind} · 截止日期 ${escapeHtml(task.due_date)} · 周期 ${rec}</p>
      ${task.note ? `<div style="font-size:15px;line-height:1.9">${escapeHtml(task.note).replace(/\n/g, '<br/>')}</div>` : ''}
      <p style="font-size:13px;color:#666;margin-top:16px">完成后请到 <a href="${SITE}/admin.html">${SITE} 后台</a> 勾选完成；周期任务完成后会自动顺延到下一期。</p>`)
    const via = await sendWithFallback(env, subject, html)
    if (via) {
      sent++
      await env.DB.prepare('UPDATE tasks SET last_notified_date = ? WHERE id = ?').bind(today, task.id).run()
    }
  }
  return `notified=${sent}`
}

async function runAll(env) {
  const emails = await processScheduledEmails(env)
  const tasks = await processTasks(env)
  return { emails, tasks }
}

async function sendDiaryNotify(env, body) {
  const title = String(body.title || '').slice(0, 120)
  const content = String(body.content || '')
  const images = Array.isArray(body.images) ? body.images.slice(0, 20) : []
  const createdAt = String(body.createdAt || bjTodayStr())
  const subject = `【dostime】新日记：${title || content.slice(0, 20)}`
  const imgHtml = images
    .map(u => `<p style="margin:16px 0"><img src="https://dostime.pages.dev${escapeHtml(u)}" style="max-width:100%;border-radius:8px" alt="" /></p>`)
    .join('')
  const html = wrapHtml(`
    ${title ? `<h2 style="margin-bottom:4px">${escapeHtml(title)}</h2>` : ''}
    <p style="color:#999;font-size:13px;margin-top:0">${escapeHtml(createdAt)}</p>
    <div style="font-size:15px;line-height:1.9;white-space:normal">${escapeHtml(content).replace(/\n/g, '<br/>')}</div>
    ${imgHtml}`)
  const via = await sendWithFallback(env, subject, html)
  return { ok: Boolean(via), via: via || 'none' }
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAll(env))
  },
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/run' && request.method === 'GET') {
      if (!env.CRON_SECRET || request.headers.get('X-Cron-Key') !== env.CRON_SECRET) {
        return new Response('unauthorized', { status: 401 })
      }
      const result = await runAll(env)
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
    }
    if (url.pathname === '/notify' && request.method === 'POST') {
      if (!env.CRON_SECRET || request.headers.get('X-Cron-Key') !== env.CRON_SECRET) {
        return new Response('unauthorized', { status: 401 })
      }
      const body = await request.json().catch(() => ({}))
      const result = await sendDiaryNotify(env, body)
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
    }
    if (url.pathname === '/test' && request.method === 'GET') {
      if (!env.CRON_SECRET || url.searchParams.get('key') !== env.CRON_SECRET) {
        return new Response('unauthorized', { status: 401 })
      }
      const subject = '【dostime】邮件通道测试'
      const html = wrapHtml(`
        <h2 style="margin-bottom:4px">邮件通道测试</h2>
        <p style="color:#999;font-size:13px;margin-top:0">${bjTodayStr()}</p>
        <div style="font-size:15px;line-height:1.9">如果你收到这封邮件，说明邮件发送链路正常。请查看发件人地址：若为 noreply@dosday.dpdns.org 则表示 Cloudflare 自建通道工作正常。</div>`)
      let via = 'none'
      let cfError = ''
      try {
        await sendViaCF(env, subject, html)
        via = 'cf'
      } catch (e) {
        cfError = String(e && e.message ? e.message : e).slice(0, 200)
        try {
          await sendViaResend(env, subject, html)
          via = 'resend'
        } catch (e2) {
          via = 'error:' + String(e2 && e2.message ? e2.message : e2).slice(0, 100)
        }
      }
      await env.DB.prepare('INSERT INTO mail_channel_log (via, ok, tested_at) VALUES (?, ?, ?)').bind(cfError ? 'cf_fail:' + cfError : via, via === 'cf' || via === 'resend' ? 1 : 0, new Date().toISOString()).run()
      return new Response(JSON.stringify({ ok: via === 'cf' || via === 'resend', via, cfError: cfError || undefined }), { headers: { 'Content-Type': 'application/json' } })
    }
    return new Response('dostime cron worker is running', { status: 200 })
  }
}
