const enc = new TextEncoder()

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function makeToken(env) {
  const exp = String(Date.now() + 7 * 86400 * 1000)
  const sig = await hmac(env.ADMIN_PASSWORD, exp)
  return `${exp}.${sig}`
}

export function getSession(request) {
  const cookie = request.headers.get('Cookie') || ''
  const m = cookie.match(/(?:^|;\s*)session=([^;]+)/)
  return m ? m[1] : null
}

export async function requireAuth(request, env) {
  const token = getSession(request)
  if (!token) return false
  const [exp, sig] = token.split('.')
  if (!exp || !sig) return false
  if (Number(exp) < Date.now()) return false
  const expect = await hmac(env.ADMIN_PASSWORD, exp)
  return sig === expect
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
  })
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}
