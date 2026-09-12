const $ = s => document.querySelector(s)
let images = []
let editingId = null

function resetEditor() {
  editingId = null
  images = []
  $('#title').value = ''
  $('#content').value = ''
  $('#thumbs').innerHTML = ''
  $('#editor-title-text')
  $('#publish-btn').textContent = '发 表'
}

async function whoami() {
  const res = await fetch('/api/whoami')
  const { authed } = await res.json()
  $('#login-box').classList.toggle('hidden', authed)
  $('#editor-box').classList.toggle('hidden', !authed)
  $('#logout-link').classList.toggle('hidden', !authed)
  if (authed) loadManage()
}

async function login() {
  $('#login-err').textContent = ''
  const password = $('#password').value
  if (!password) return ($('#login-err').textContent = '请输入密码')
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  })
  if (res.ok) {
    $('#password').value = ''
    whoami()
  } else {
    const { error } = await res.json()
    $('#login-err').textContent = error || '登录失败'
  }
}

async function uploadFiles(files) {
  const status = $('#upload-status')
  for (const file of files) {
    if (images.length >= 20) {
      status.textContent = '最多 20 张图片'
      break
    }
    status.textContent = `上传中：${file.name}`
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok) {
      images.push(data.url)
      renderThumbs()
    } else {
      status.textContent = data.error || '上传失败'
      await new Promise(r => setTimeout(r, 1500))
    }
  }
  status.textContent = images.length ? `已添加 ${images.length} 张图片` : ''
  $('#file').value = ''
}

function renderThumbs() {
  $('#thumbs').innerHTML = images
    .map((u, i) => `<div class="thumb"><img src="${u}" alt="" /><button class="rm" data-i="${i}">×</button></div>`)
    .join('')
  $('#thumbs').querySelectorAll('.rm').forEach(b =>
    b.addEventListener('click', () => {
      images.splice(Number(b.dataset.i), 1)
      renderThumbs()
      $('#upload-status').textContent = images.length ? `已添加 ${images.length} 张图片` : ''
    })
  )
}

async function publish() {
  const title = $('#title').value.trim()
  const content = $('#content').value.trim()
  const msg = $('#pub-msg')
  msg.className = 'err'
  msg.textContent = ''
  if (!title) return (msg.textContent = '标题不能为空')
  if (!content) return (msg.textContent = '内容不能为空')
  const btn = $('#publish-btn')
  btn.disabled = true
  btn.textContent = editingId ? '保存中…' : '发表中…'
  try {
    const url = editingId ? `/api/posts/${editingId}` : '/api/posts'
    const method = editingId ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, images })
    })
    const data = await res.json()
    if (res.ok) {
      msg.className = 'ok-msg'
      msg.textContent = data.email && data.email.sent
        ? '发表成功，通知邮件已发送到你的邮箱'
        : `已保存，邮件发送失败：${data.email && data.email.reason ? data.email.reason : '未知原因'}`
      resetEditor()
      loadManage()
    } else {
      msg.textContent = data.error || '操作失败'
    }
  } catch (e) {
    msg.textContent = '网络错误，请重试'
  }
  btn.disabled = false
  btn.textContent = '发 表'
}

async function loadManage() {
  const box = $('#manage-list')
  try {
    const res = await fetch('/api/posts')
    const { posts } = await res.json()
    if (!posts || !posts.length) {
      box.innerHTML = '<div class="empty">还没有日记。</div>'
      return
    }
    box.innerHTML = posts
      .map(
        p => `<div class="manage-item">
          <div>
            <div>${p.title.replace(/</g, '&lt;')}</div>
            <div class="d">${(p.created_at || '').slice(0, 16)}</div>
          </div>
          <div class="acts">
            <button class="edit" data-id="${p.id}">编辑</button>
            <button class="danger" data-id="${p.id}">删除</button>
          </div>
        </div>`
      )
      .join('')
    box.querySelectorAll('.danger').forEach(b =>
      b.addEventListener('click', async () => {
        if (!confirm('确定删除这篇日记？图片也会一并删除。')) return
        await fetch(`/api/posts/${b.dataset.id}`, { method: 'DELETE' })
        loadManage()
      })
    )
    box.querySelectorAll('.edit').forEach(b =>
      b.addEventListener('click', async () => {
        const res = await fetch(`/api/posts/${b.dataset.id}`)
        const { post } = await res.json()
        editingId = post.id
        images = post.images || []
        $('#title').value = post.title
        $('#content').value = post.content
        renderThumbs()
        $('#publish-btn').textContent = '保存修改'
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    )
  } catch (e) {
    box.innerHTML = '<div class="empty">加载失败。</div>'
  }
}

$('#login-btn').addEventListener('click', login)
$('#password').addEventListener('keydown', e => e.key === 'Enter' && login())
$('#file').addEventListener('change', e => e.target.files.length && uploadFiles([...e.target.files]))
$('#publish-btn').addEventListener('click', publish)
$('#logout-link').addEventListener('click', async e => {
  e.preventDefault()
  await fetch('/api/logout', { method: 'POST' })
  location.reload()
})

whoami()
