import { requireGuest, requireAuth, json } from '../_lib/auth.js'

export async function onRequestGet({ request, env }) {
  if ((await requireGuest(request, env)) || (await requireAuth(request, env))) return json({ ok: true })
  return json({ error: '需要访问密码' }, 401)
}
