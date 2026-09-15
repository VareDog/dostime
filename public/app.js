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
        return `<div class="post-card${p.private ? ' is-private' : ''}">
          <div class="meta">
            <h2><a href="/post.html?id=${p.id}">${p.pinned ? '<span class="pin-tag">置顶</span>' : ''}${escapeHtml(t)}</a></h2>
            <div class="date">${fmtDate(p.created_at)}</div>
            <p class="summary">${escapeHtml(p.summary || '')}</p>
          </div>
          ${cover ? `<img class="cover" src="${escapeHtml(cover)}" alt="" loading="lazy" />` : ''}
          ${p.private ? `<a class="private-mask" href="/post.html?id=${p.id}"><span>🔒 私密日记 · 点开需访问密码</span></a>` : ''}
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
    if (res.status === 401) {
      const data = await res.json().catch(() => ({}))
      if (data.private) {
        showPostGate()
        return
      }
    }
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
    if (!name || !phone || !content) return
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

function showPostGate() {
  if ($('#guest-gate')) return
  const box = $('#post')
  if (box) box.innerHTML = ''
  const wrap = document.createElement('div')
  wrap.id = 'guest-gate'
  wrap.style.cssText = 'position:fixed;inset:0;background:#f5f1ea;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px'
  wrap.innerHTML = `
    <div style="background:#fff;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.12);padding:34px 30px;width:100%;max-width:330px;text-align:center">
      <div style="font-size:34px;margin-bottom:6px">🔒</div>
      <h2 style="margin:0 0 6px;font-size:19px">私密日记</h2>
      <p style="color:#888;font-size:13px;margin:0 0 16px">这篇日记是私密的，请输入访问密码</p>
      <input type="password" id="gate-pwd" placeholder="访问密码" style="width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #ddd;border-radius:8px;font-size:15px;text-align:center" />
      <button id="gate-btn" style="width:100%;margin-top:12px;padding:11px 0;border:0;border-radius:8px;background:#4a7c59;color:#fff;font-size:15px;cursor:pointer">解 锁</button>
      <p id="gate-msg" style="color:#c0392b;font-size:13px;min-height:18px;margin:10px 0 0"></p>
      <p style="margin:12px 0 0"><a href="/" style="color:#999;font-size:13px">返回日记列表</a></p>
    </div>`
  document.body.appendChild(wrap)
  const submit = async () => {
    const msg = $('#gate-msg')
    const pwd = $('#gate-pwd').value
    if (!pwd) return (msg.textContent = '请输入密码')
    msg.textContent = ''
    $('#gate-btn').textContent = '验证中…'
    try {
      const res = await fetch('/api/guest-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd })
      })
      if (res.ok) {
        location.reload()
      } else {
        const data = await res.json().catch(() => ({}))
        msg.textContent = data.error || '密码不正确'
        $('#gate-btn').textContent = '解 锁'
      }
    } catch (e) {
      msg.textContent = '网络异常，请重试'
      $('#gate-btn').textContent = '解 锁'
    }
  }
  $('#gate-btn').addEventListener('click', submit)
  $('#gate-pwd').addEventListener('keydown', e => e.key === 'Enter' && submit())
  $('#gate-pwd').focus()
}

if ($('#post')) {
  renderPost()
} else {
  renderList()
}
