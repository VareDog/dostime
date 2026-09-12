import { makeToken, json } from '../_lib/auth.js'

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}))
  if (!body.password || body.password !== env.ADMIN_PASSWORD) {
    return json({ error: '密码错误' }, 401)
  }
  const token = await makeToken(env)
  return json({ ok: true }, 200, {
    'Set-Cookie': `session=${token}; HttpOnly; Secure; Path=/; Max-Age=604800; SameSite=Lax`
  })
}
