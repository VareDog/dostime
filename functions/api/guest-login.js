import { makeGuestToken, json } from '../_lib/auth.js'

export async function onRequestPost({ request, env }) {
  if (!env.GUEST_PASSWORD) return json({ ok: true })
  const body = await request.json().catch(() => ({}))
  if (String(body.password || '') !== env.GUEST_PASSWORD) return json({ error: '访问密码不正确' }, 401)
  const token = await makeGuestToken(env)
  return json(
    { ok: true },
    200,
    { 'Set-Cookie': `guest=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=15552000` }
  )
}
