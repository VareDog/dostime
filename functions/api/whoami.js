import { requireAuth, json } from '../_lib/auth.js'

export async function onRequestGet({ request, env }) {
  return json({ authed: await requireAuth(request, env) })
}
