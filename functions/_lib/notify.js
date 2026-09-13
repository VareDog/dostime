const NOTIFY_URL = 'https://dostime-cron.doswowo.workers.dev/notify'

export async function sendNotify(env, payload) {
  if (!env.CRON_SECRET) return { sent: false, reason: '通知密钥未配置' }
  try {
    const res = await fetch(NOTIFY_URL, {
      method: 'POST',
      headers: { 'X-Cron-Key': env.CRON_SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.ok) return { sent: true, via: data.via }
    return { sent: false, reason: `via=${data.via || 'unknown'} status=${res.status}` }
  } catch (e) {
    return { sent: false, reason: String(e && e.message ? e.message : e).slice(0, 200) }
  }
}
