import { requireAuth, json } from '../_lib/auth.js'

export async function onRequestGet({ request, env }) {
  if (!(await requireAuth(request, env))) return json({ error: '未登录' }, 401)
  return json({
    keys: Object.keys(env || {}),
    guest_set: !!env.GUEST_PASSWORD,
    guest_len: (env.GUEST_PASSWORD || '').length
  })
}
