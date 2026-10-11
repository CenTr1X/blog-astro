const form = document.querySelector('#book-form')
const submitButton = document.querySelector('#submit-button')
const message = document.querySelector('#form-message')
const finishedDateField = document.querySelector('#finished-date-field')
const finishedDateInput = document.querySelector('#finished-date')
const coverInput = document.querySelector('#cover')
const coverPicker = document.querySelector('#cover-picker')
const coverFileName = document.querySelector('#cover-file-name')
const previewCover = document.querySelector('#preview-cover')
const previewPlaceholder = document.querySelector('#preview-placeholder')
const previewStatus = document.querySelector('#preview-status')
const previewTitle = document.querySelector('#preview-title')
const previewAuthor = document.querySelector('#preview-author')
const previewMeta = document.querySelector('#preview-meta')
const previewTags = document.querySelector('#preview-tags')
const previewNote = document.querySelector('#preview-note')
const sessionToken = document.querySelector('meta[name="book-manager-token"]').content

const statusLabels = {
  planned: '想读',
  reading: '在读',
  read: '已读'
}

let previewObjectUrl

function selectedStatus() {
  return form.elements.status.value
}

function updateStatus() {
  const status = selectedStatus()
  const isRead = status === 'read'
  finishedDateField.hidden = !isRead
  finishedDateInput.required = isRead
  if (!isRead) finishedDateInput.value = ''
  previewStatus.dataset.status = status
  previewStatus.setAttribute('aria-label', statusLabels[status])
  updatePreviewMeta()
}

function formatWordCount(value) {
  const count = Number(value)
  if (!Number.isFinite(count) || count <= 0) return ''
  if (count >= 10000) return `${Number((count / 10000).toFixed(1))}万`
  return `${count}字`
}

function updatePreviewMeta() {
  const parts = [statusLabels[selectedStatus()]]
  const wordCount = formatWordCount(form.elements.wordCount.value)
  const rating = form.elements.rating.value
  if (wordCount) parts.push(wordCount)
  if (rating) parts.push(`${rating} / 5`)
  previewMeta.textContent = parts.join(' · ')
}

function updatePreviewTags() {
  const tags = form.elements.tags.value
    .split(/[,，\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean)

  previewTags.replaceChildren(
    ...tags.slice(0, 6).map((tag) => {
      const item = document.createElement('span')
      item.textContent = tag
      return item
    })
  )
}

function updateCoverPreview() {
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl)
  const [file] = coverInput.files
  coverPicker.classList.toggle('has-file', Boolean(file))
  coverFileName.textContent = file ? file.name : 'JPG、PNG、WebP 或 AVIF，不超过 10 MB'

  if (!file) {
    previewCover.hidden = true
    previewCover.removeAttribute('src')
    previewPlaceholder.hidden = false
    return
  }

  previewObjectUrl = URL.createObjectURL(file)
  previewCover.src = previewObjectUrl
  previewCover.hidden = false
  previewPlaceholder.hidden = true
}

function resetMessage() {
  message.textContent = ''
  message.classList.remove('error', 'warning')
}

async function loadStats() {
  try {
    const response = await fetch('/api/stats')
    const stats = await response.json()
    for (const key of ['total', 'reading', 'read', 'planned']) {
      document.querySelector(`#stat-${key}`).textContent = stats[key]
    }
  } catch {
    // Statistics are helpful context, but a failure should not block data entry.
  }
}

form.addEventListener('input', (event) => {
  resetMessage()
  if (event.target.name === 'status') updateStatus()
  if (event.target.name === 'title') previewTitle.textContent = event.target.value.trim() || '书名'
  if (event.target.name === 'author')
    previewAuthor.textContent = event.target.value.trim() || '作者'
  if (event.target.name === 'tags') updatePreviewTags()
  if (event.target.name === 'note') {
    previewNote.textContent = event.target.value.trim() || '书籍记录会在这里预览。'
  }
  if (['wordCount', 'rating'].includes(event.target.name)) updatePreviewMeta()
})

coverInput.addEventListener('change', updateCoverPreview)

form.addEventListener('reset', () => {
  const preserveMessage = form.dataset.preserveMessage === 'true'
  delete form.dataset.preserveMessage

  window.setTimeout(() => {
    if (!preserveMessage) resetMessage()
    updateStatus()
    updateCoverPreview()
    previewTitle.textContent = '书名'
    previewAuthor.textContent = '作者'
    previewTags.replaceChildren()
    previewNote.textContent = '书籍记录会在这里预览。'
    document.querySelector('#title').focus()
  })
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  resetMessage()
  submitButton.disabled = true
  const shouldFetchCover = form.elements.autoFetchCover.checked && !coverInput.files.length
  submitButton.textContent = shouldFetchCover ? '正在保存并获取封面…' : '正在保存…'

  try {
    const data = new FormData(form)
    data.set('recommended', form.elements.recommended.checked ? 'true' : 'false')
    data.set('autoFetchCover', form.elements.autoFetchCover.checked ? 'true' : 'false')
    const response = await fetch('/api/books', {
      method: 'POST',
      headers: { 'X-Book-Manager-Key': sessionToken },
      body: data
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || '保存失败。')

    form.dataset.preserveMessage = 'true'
    form.reset()
    message.textContent = `已生成 ${result.file}${result.coverLookup ? `；${result.coverLookup.message}` : ''}`
    if (['failed', 'not-found'].includes(result.coverLookup?.status)) {
      message.classList.add('warning')
    }
    await loadStats()
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : '保存失败。'
    message.classList.add('error')
  } finally {
    submitButton.disabled = false
    submitButton.textContent = '添加到书架'
  }
})

const now = new Date()
const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
finishedDateInput.max = localToday.toISOString().slice(0, 10)
updateStatus()
loadStats()
