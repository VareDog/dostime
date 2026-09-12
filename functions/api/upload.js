import { requireAuth, json } from '../_lib/auth.js'

const OK_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif' }

export async function onRequestPost({ request, env }) {
  if (!(await requireAuth(request, env))) return json({ error: '未登录' }, 401)
  const form = await request.formData()
  const file = form.get('file')
  if (!file || typeof file === 'string') return json({ error: '缺少文件' }, 400)
  if (!OK_TYPES.includes(file.type)) return json({ error: '仅支持 jpg/png/gif/webp/avif 图片' }, 400)
  if (file.size > 10 * 1024 * 1024) return json({ error: '图片不能超过 10MB' }, 400)
  const key = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${EXT[file.type]}`
  await env.R2.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
  return json({ url: `/api/images/${key}`, key })
}
