const $ = s => document.querySelector(s)
const $$ = s => document.querySelectorAll(s)
let images = []
let editingId = null

function resetEditor() {
  editingId = null
  images = []
  $('#title').value = ''
  $('#content').value = ''
  $('#pinned').checked = false
  $('#private').checked = false
  $('#thumbs').innerHTML = ''
  $('#publish-btn').textContent = '发 表'
}

async function whoami() {
  const res = await fetch('/api/whoami')
  const { authed } = await res.json()
  $('#login-box').classList.toggle('hidden', authed)
  $('#editor-box').classList.toggle('hidden', !authed)
  $('#logout-link').classList.toggle('hidden', !authed)
  if (authed) {
    loadManage()
    loadSchedule()
    loadTasks()
  }
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
      status.textContent = res.status === 401 ? '登录已失效，请刷新页面重新登录' : (data.error || '上传失败')
      await new Promise(r => setTimeout(r, 2500))
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
      body: JSON.stringify({ title, content, images, pinned: $('#pinned').checked ? 1 : 0, private: $('#private').checked ? 1 : 0 })
    })
    const data = await res.json()
    if (res.ok) {
      const isEdit = method === 'PUT'
      const okText = isEdit ? '已保存，更新邮件已发送到你的邮箱' : '发表成功，通知邮件已发送到你的邮箱'
      const failText = isEdit ? '已保存，更新邮件发送失败：' : '已保存，通知邮件发送失败：'
      msg.className = 'ok-msg'
      msg.textContent = data.email && data.email.sent
        ? okText
        : `${failText}${data.email && data.email.reason ? data.email.reason : '未知原因'}`
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
      .map(p => {
        const t = p.title || (p.summary || '').slice(0, 24) || '无题'
        return `<div class="manage-item">
          <div>
            <div>${p.pinned ? '<span class="pin-tag">置顶</span>' : ''}${p.private ? '<span class="pri-tag">私密</span>' : ''}${t.replace(/</g, '&lt;')}</div>
            <div class="d">${(p.created_at || '').slice(0, 16)}</div>
          </div>
          <div class="acts">
            <button class="edit" data-id="${p.id}">编辑</button>
            <button class="danger" data-id="${p.id}">删除</button>
          </div>
        </div>`
      })
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
        $('#pinned').checked = !!post.pinned
        $('#private').checked = !!post.private
        renderThumbs()
        $('#publish-btn').textContent = '保存修改'
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    )
  } catch (e) {
    box.innerHTML = '<div class="empty">加载失败。</div>'
  }
}

const WD = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const FREQ = { daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' }

function scDescribe(job) {
  if (job.frequency === 'daily') return `每天 ${job.send_time}`
  if (job.frequency === 'weekly') return `每周${WD[(job.weekday || 1) - 1]} ${job.send_time}`
  if (job.frequency === 'yearly') return `每年 ${job.month} 月 ${job.monthday} 日 ${job.send_time}`
  return `每月 ${job.monthday} 号 ${job.send_time}`
}

function scSyncFields() {
  const f = $('#sc-frequency').value
  $('#sc-weekday').classList.toggle('hidden', f !== 'weekly')
  $('#sc-monthday').classList.toggle('hidden', !(f === 'monthly' || f === 'yearly'))
  $('#sc-month').classList.toggle('hidden', f !== 'yearly')
  const f2 = $('#sc-frequency2').value
  $('#sc-weekday2').classList.toggle('hidden', f2 !== 'weekly')
  $('#sc-monthday2').classList.toggle('hidden', !(f2 === 'monthly' || f2 === 'yearly'))
  $('#sc-month2').classList.toggle('hidden', f2 !== 'yearly')
  $('#sc-time2').disabled = !f2
}

function scDescribe2(j) {
  if (!j.frequency2) return ''
  if (j.frequency2 === 'daily') return `每天 ${j.send_time2}`
  if (j.frequency2 === 'weekly') return `每周${WD[(j.weekday2 || 1) - 1]} ${j.send_time2}`
  if (j.frequency2 === 'yearly') return `每年 ${j.month2} 月 ${j.monthday2} 日 ${j.send_time2}`
  return `每月 ${j.monthday2} 号 ${j.send_time2}`
}

async function loadSchedule() {
  const box = $('#schedule-list')
  try {
    const res = await fetch('/api/schedule')
    const { jobs } = await res.json()
    if (!jobs || !jobs.length) {
      box.innerHTML = '<div class="empty">还没有定时邮件。</div>'
      return
    }
    box.innerHTML = jobs
      .map(j => {
        const next = j.next_send_at ? new Date(j.next_send_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '—'
        const next2 = j.next_send_at2 ? new Date(j.next_send_at2).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '—'
        const line2 = j.frequency2 ? `<div class="d">周期2：${scDescribe2(j)} · 下次发送 ${j.enabled ? next2 : '已停用'}</div>` : ''
        return `<div class="manage-item">
          <div>
            <div>${(j.title || j.content.slice(0, 24)).replace(/</g, '&lt;')}</div>
            <div class="d">周期1：${scDescribe(j)} · 下次发送 ${j.enabled ? next : '已停用'}</div>
            ${line2}
          </div>
          <div class="acts">
            <button class="sc-toggle" data-id="${j.id}" data-en="${j.enabled}">${j.enabled ? '停用' : '启用'}</button>
            <button class="danger sc-del" data-id="${j.id}">删除</button>
          </div>
        </div>`
      })
      .join('')
    box.querySelectorAll('.sc-toggle').forEach(b =>
      b.addEventListener('click', async () => {
        await fetch(`/api/schedule/${b.dataset.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: b.dataset.en !== 'true' })
        })
        loadSchedule()
      })
    )
    box.querySelectorAll('.sc-del').forEach(b =>
      b.addEventListener('click', async () => {
        if (!confirm('确定删除这条定时邮件？')) return
        await fetch(`/api/schedule/${b.dataset.id}`, { method: 'DELETE' })
        loadSchedule()
      })
    )
  } catch (e) {
    box.innerHTML = '<div class="empty">加载失败。</div>'
  }
}

async function createSchedule() {
  const msg = $('#sc-msg')
  msg.className = 'err'
  msg.textContent = ''
  const payload = {
    title: $('#sc-title').value.trim(),
    content: $('#sc-content').value.trim(),
    frequency: $('#sc-frequency').value,
    weekday: $('#sc-weekday').value,
    monthday: $('#sc-monthday').value,
    month: $('#sc-month').value,
    send_time: $('#sc-time').value || '08:00',
    frequency2: $('#sc-frequency2').value || '',
    weekday2: $('#sc-weekday2').value,
    monthday2: $('#sc-monthday2').value,
    month2: $('#sc-month2').value,
    send_time2: $('#sc-time2').value || '20:00'
  }
  if (!payload.content) return (msg.textContent = '邮件内容不能为空')
  const res = await fetch('/api/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await res.json()
  if (res.ok) {
    msg.className = 'ok-msg'
    const next = data.next_send_at ? new Date(data.next_send_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : ''
    const next2 = data.next_send_at2 ? new Date(data.next_send_at2).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : ''
    msg.textContent = `创建成功，周期1 首次发送：${next}${next2 ? `；周期2 首次发送：${next2}` : ''}`
    $('#sc-title').value = ''
    $('#sc-content').value = ''
    loadSchedule()
  } else {
    msg.textContent = data.error || '创建失败'
  }
}

let editingTaskId = null

function bjTodayLocal() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

function addDaysLocal(dateStr, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return ''
  return new Date(Date.parse(dateStr + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10)
}

function updateNextPreview() {
  const next = addDaysLocal($('#tk-complete').value, Number($('#tk-cycle').value))
  if (!next) {
    $('#tk-next-preview').textContent = '—'
    return
  }
  const t2 = $('#tk-t2').value
  $('#tk-next-preview').textContent = `${next} ${$('#tk-t1').value || '--:--'}${t2 ? ` / ${t2}` : ''}`
}

function resetTaskForm() {
  editingTaskId = null
  $('#tk-title').value = ''
  $('#tk-cycle').value = 28
  $('#tk-complete').value = bjTodayLocal()
  $('#tk-t1').value = '08:00'
  $('#tk-t2').value = '20:00'
  $('#tk-form-title').textContent = '新建任务'
  $('#tk-create-btn').textContent = '创建任务'
  $('#tk-cancel-btn').classList.add('hidden')
  updateNextPreview()
}

async function loadTasks() {
  const box = $('#tasks-list')
  try {
    const res = await fetch('/api/tasks')
    const { tasks, today } = await res.json()
    if (!tasks || !tasks.length) {
      box.innerHTML = '<div class="empty">还没有任务。</div>'
      return
    }
    box.innerHTML = tasks
      .map(t => {
        let badge = ''
        if (!t.enabled) badge = '<span class="badge">已停用</span>'
        else if (t.over_days > 0) badge = `<span class="badge over">已超期 ${t.over_days} 天</span>`
        else if (t.due_today) badge = '<span class="badge today">今天到期</span>'
        else badge = '<span class="badge">监测中</span>'
        return `<div class="manage-item ${t.enabled ? '' : 'item-done'}">
          <div>
            <div>${t.title.replace(/</g, '&lt;')} ${badge}</div>
            <div class="d">每 ${t.cycle_days} 天 · 完成 ${t.complete_date || '—'} · 下次 ${t.next_date} · 提醒 ${t.remind_time_1}${t.remind_time_2 ? ` / ${t.remind_time_2}` : ''}</div>
          </div>
          <div class="acts">
            <button class="tk-done" data-id="${t.id}">完成本期</button>
            <button class="tk-edit" data-id="${t.id}">编辑</button>
            <button class="tk-toggle" data-id="${t.id}">${t.enabled ? '停用' : '启用'}</button>
            <button class="danger tk-del" data-id="${t.id}">删除</button>
          </div>
        </div>`
      })
      .join('')
    box.querySelectorAll('.tk-done').forEach(b =>
      b.addEventListener('click', async () => {
        const res = await fetch(`/api/tasks/${b.dataset.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'complete' })
        })
        const data = await res.json()
        if (res.ok && data.rolled) {
          $('#tk-msg').className = 'ok-msg'
          $('#tk-msg').textContent = `完成日期已记为 ${data.complete_date}，下次日期顺延至：${data.next_date}`
        }
        loadTasks()
      })
    )
    box.querySelectorAll('.tk-edit').forEach(b =>
      b.addEventListener('click', async () => {
        const t = tasks.find(x => String(x.id) === b.dataset.id)
        editingTaskId = t.id
        $('#tk-title').value = t.title
        $('#tk-cycle').value = t.cycle_days
        $('#tk-complete').value = t.complete_date || bjTodayLocal()
        $('#tk-t1').value = t.remind_time_1
        $('#tk-t2').value = t.remind_time_2 || ''
        $('#tk-form-title').textContent = '编辑任务'
        $('#tk-create-btn').textContent = '保存修改'
        $('#tk-cancel-btn').classList.remove('hidden')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    )
    box.querySelectorAll('.tk-toggle').forEach(b =>
      b.addEventListener('click', async () => {
        await fetch(`/api/tasks/${b.dataset.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'toggle' })
        })
        loadTasks()
      })
    )
    box.querySelectorAll('.tk-del').forEach(b =>
      b.addEventListener('click', async () => {
        if (!confirm('确定删除这个任务？')) return
        await fetch(`/api/tasks/${b.dataset.id}`, { method: 'DELETE' })
        loadTasks()
      })
    )
  } catch (e) {
    box.innerHTML = '<div class="empty">加载失败。</div>'
  }
}

async function createTask() {
  const msg = $('#tk-msg')
  msg.className = 'err'
  msg.textContent = ''
  const payload = {
    title: $('#tk-title').value.trim(),
    cycle_days: Number($('#tk-cycle').value),
    complete_date: $('#tk-complete').value,
    remind_time_1: $('#tk-t1').value,
    remind_time_2: $('#tk-t2').value
  }
  if (!payload.title) return (msg.textContent = '任务内容不能为空')
  if (!payload.complete_date) return (msg.textContent = '请选择完成日期')
  const res = await fetch(editingTaskId ? `/api/tasks/${editingTaskId}` : '/api/tasks', {
    method: editingTaskId ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await res.json()
  if (res.ok) {
    msg.className = 'ok-msg'
    msg.textContent = editingTaskId ? `任务已更新，下次日期：${data.next_date}` : `任务创建成功（下次日期 ${data.next_date || '自动生成'}），到达或超过下次日期后每天按提醒时段发邮件`
    resetTaskForm()
    loadTasks()
  } else {
    msg.textContent = data.error || '操作失败'
  }
}

$$('.tab').forEach(t =>
  t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.remove('active'))
    t.classList.add('active')
    $$('.panel').forEach(p => p.classList.add('hidden'))
    $('#panel-' + t.dataset.tab).classList.remove('hidden')
  })
)

$('#sc-frequency').addEventListener('change', scSyncFields)
$('#sc-frequency2').addEventListener('change', scSyncFields)
scSyncFields()
$('#login-btn').addEventListener('click', login)
$('#password').addEventListener('keydown', e => e.key === 'Enter' && login())
$('#file').addEventListener('change', e => e.target.files.length && uploadFiles([...e.target.files]))
$('#publish-btn').addEventListener('click', publish)
$('#sc-create-btn').addEventListener('click', createSchedule)
$('#tk-create-btn').addEventListener('click', createTask)
$('#tk-cycle').addEventListener('input', updateNextPreview)
$('#tk-complete').addEventListener('change', updateNextPreview)
$('#tk-t1').addEventListener('change', updateNextPreview)
$('#tk-t2').addEventListener('change', updateNextPreview)
$('#tk-cancel-btn').addEventListener('click', () => {
  resetTaskForm()
  $('#tk-msg').textContent = ''
  $('#tk-msg').className = 'err'
})
$('#logout-link').addEventListener('click', async e => {
  e.preventDefault()
  await fetch('/api/logout', { method: 'POST' })
  location.reload()
})

resetTaskForm()
whoami()
