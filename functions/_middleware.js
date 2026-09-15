import { requireGuest, requireAuth } from './_lib/auth.js'
import { json } from './_lib/auth.js'

const PUBLIC_PATHS = ['/api/guest-login', '/api/guest-check', '/api/login', '/api/logout']

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/api/')) return next()
  if (PUBLIC_PATHS.includes(url.pathname)) return next()
  if ((await requireGuest(request, env)) || (await requireAuth(request, env))) return next()
  return json({ error: '需要访问密码' }, 401)
}
