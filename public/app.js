const $ = s => document.querySelector(s)

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function fmtDate(s) {
  return (s || '').replace('T', ' ').slice(0, 16)
}

async function renderList() {
  const box = $('#posts')
  try {
    const res = await fetch('/api/posts')
    const { posts } = await res.json()
    if (!posts || !posts.length) {
      box.innerHTML = '<div class="empty">还没有日记，写下第一篇吧。</div>'
      return
    }
    box.innerHTML = posts
      .map(p => {
        const cover = p.images && p.images[0]
        const t = p.title || (p.summary || '').slice(0, 24) || '无题'
        return `<div class="post-card">
          <div class="meta">
            <h2><a href="/post.html?id=${p.id}">${escapeHtml(t)}</a></h2>
            <div class="date">${fmtDate(p.created_at)}</div>
            <p class="summary">${escapeHtml(p.summary || '')}</p>
          </div>
          ${cover ? `<img class="cover" src="${escapeHtml(cover)}" alt="" loading="lazy" />` : ''}
        </div>`
      })
      .join('')
  } catch (e) {
    box.innerHTML = '<div class="empty">加载失败，请刷新重试。</div>'
  }
}

async function renderPost() {
  const box = $('#post')
  const id = new URLSearchParams(location.search).get('id')
  if (!id) {
    box.innerHTML = '<div class="empty">缺少参数。</div>'
    return
  }
  try {
    const res = await fetch(`/api/posts/${id}`)
    if (!res.ok) {
      box.innerHTML = '<div class="empty">日记不存在或已被删除。</div>'
      return
    }
    const { post } = await res.json()
    document.title = `${post.title || '无题'} · Dostime`
    const paras = escapeHtml(post.content)
      .split('\n')
      .filter(l => l.trim())
      .map(l => `<p>${l}</p>`)
      .join('')
    const imgs = (post.images || [])
      .map(u => `<img src="${escapeHtml(u)}" alt="" loading="lazy" />`)
      .join('')
    box.innerHTML = `
      ${post.title ? `<h1>${escapeHtml(post.title)}</h1>` : ''}
      <div class="date">${fmtDate(post.created_at)}${post.updated_at && post.updated_at !== post.created_at ? ' · 编辑于 ' + fmtDate(post.updated_at) : ''}</div>
      <div class="content">${paras}${imgs}</div>`
  } catch (e) {
    box.innerHTML = '<div class="empty">加载失败，请刷新重试。</div>'
  }
}

if ($('#post')) renderPost()
else renderList()
