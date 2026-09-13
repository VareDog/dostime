import { requireAuth, json } from '../_lib/auth.js'

export async function onRequestGet({ request, env }) {
  if (!(await requireAuth(request, env))) return json({ error: '未登录' }, 401)
  const r = await fetch(`https://dostime-cron.doswowo.workers.dev/run?key=${env.CRON_SECRET}`)
  const text = await r.text()
  return new Response(text, { status: r.status, headers: { 'Content-Type': 'application/json' } })
}
