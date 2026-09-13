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
            <h2><a href="/post.html?id=${p.id}">${p.pinned ? '<span class="pin-tag">置顶</span>' : ''}${escapeHtml(t)}</a></h2>
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
    document.title = `${post.title || '无题'} · DosDay`
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
    renderComments(id)
    bindCommentForm(id)
  } catch (e) {
    box.innerHTML = '<div class="empty">加载失败，请刷新重试。</div>'
  }
}

async function renderComments(postId) {
  const box = $('#comments')
  try {
    const res = await fetch(`/api/posts/${postId}/comments`)
    const { comments } = await res.json()
    box.innerHTML = !comments || !comments.length
      ? '<div class="empty">还没有评论，来说两句吧。</div>'
      : comments
          .map(c => `<div class="comment"><div class="comment-head"><b>${escapeHtml(c.name)}</b>${c.phone ? `<span class="c-phone">${escapeHtml(c.phone)}</span>` : ''}<span class="date">${fmtDate(c.created_at)}</span></div><p>${escapeHtml(c.content)}</p></div>`)
          .join('')
  } catch (e) {
    box.innerHTML = '<div class="empty">评论加载失败。</div>'
  }
}

function bindCommentForm(postId) {
  const form = $('#comment-form')
  if (!form || form.dataset.bound) return
  form.dataset.bound = '1'
  form.addEventListener('submit', async e => {
    e.preventDefault()
    const status = $('#c-status')
    const name = $('#c-name').value.trim()
    const phone = $('#c-phone').value.trim()
    const content = $('#c-content').value.trim()
    if (!name || !content) return
    status.textContent = '提交中…'
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, content })
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        $('#c-content').value = ''
        status.textContent = ''
        renderComments(postId)
      } else {
        status.textContent = data.error || '提交失败'
      }
    } catch (err) {
      status.textContent = '提交失败，请重试'
    }
  })
}

if ($('#post')) renderPost()
else renderList()
