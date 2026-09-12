import { json } from '../_lib/auth.js'

export async function onRequestPost() {
  return json({ ok: true }, 200, {
    'Set-Cookie': 'session=; HttpOnly; Secure; Path=/; Max-Age=0; SameSite=Lax'
  })
}
