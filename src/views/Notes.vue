<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
  ArrowLeft,
  ArrowRight,
  Close,
  CopyDocument,
  Delete,
  Download,
  Edit,
  Picture,
  Plus,
  Rank,
  RefreshRight,
  Search,
  Star,
  StarFilled,
  Upload,
} from '@element-plus/icons-vue'
import PageBack from '../components/PageBack.vue'
import SelectMenu from '../components/SelectMenu.vue'
import {
  importNotes,
  initNotes,
  noteStats,
  notes,
  notesError,
  notesReady,
  patchNote,
  removeNote,
  reorderNotes,
  saveNote,
} from '../composables/useNotes.js'

const NOTE_TYPES = [
  { value: 'quote', label: '金句', emoji: '✨', hint: '写下一句想反复读的话' },
  { value: 'poem', label: '诗词', emoji: '🌙', hint: '记录诗句、词作与出处' },
  { value: 'lyric', label: '歌曲', emoji: '🎵', hint: '收藏歌词和此刻的感受' },
  { value: 'screenshot', label: '截图', emoji: '🎮', hint: '保存游戏、电影或生活画面' },
  { value: 'moment', label: '随想', emoji: '💭', hint: '捕捉转瞬即逝的小想法' },
]

const COLORS = ['#4f7fd8', '#8b6bb8', '#d17a60', '#3f9274', '#c39739', '#64748b']
const SORT_OPTIONS = [
  { value: 'custom', label: '自由排序' },
  { value: 'recent', label: '最近更新' },
  { value: 'oldest', label: '最早记录' },
  { value: 'favorite', label: '收藏优先' },
]

const keyword = ref('')
const activeType = ref('all')
const favoriteOnly = ref(false)
const sortBy = ref('custom')
const layout = ref('board')
const editorOpen = ref(false)
const saving = ref(false)
const editingId = ref('')
const imageInput = ref(null)
const importInput = ref(null)
const imageBusy = ref(false)
const imageDrag = ref(false)
const randomNote = ref(null)
const lightbox = ref(null)
const lightboxDirection = ref(1)
const lightboxDrag = reactive({ active: false, startX: 0, deltaX: 0 })
const expanded = ref(new Set())
const draggingId = ref('')
const dragOverId = ref('')

function emptyPoem() {
  return { title: '', content: '', source: '' }
}

function emptyForm(type = 'quote') {
  return {
    type,
    title: '',
    content: '',
    source: '',
    link: '',
    tagsText: '',
    color: COLORS[0],
    images: [],
    poems: type === 'poem' ? [emptyPoem()] : [],
    pinned: false,
    favorite: false,
  }
}

const form = reactive(emptyForm())

const typeMap = Object.fromEntries(NOTE_TYPES.map((type) => [type.value, type]))
const typeMeta = (type) => typeMap[type] || NOTE_TYPES[0]

function cardScatter(note, index) {
  const seed = [...String(note.id || index)].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    2166136261
  )
  const rotate = ((seed % 45) - 22) / 10
  const x = ((Math.floor(seed / 47) % 19) - 9) * 0.8
  const y = ((Math.floor(seed / 893) % 19) - 7) * 0.85

  return {
    '--note-rotate': `${rotate}deg`,
    '--note-x': `${x}px`,
    '--note-y': `${y}px`,
    '--note-z': String((seed % 5) + 1),
  }
}

const typeCounts = computed(() =>
  Object.fromEntries(NOTE_TYPES.map((type) => [type.value, notes.value.filter((note) => note.type === type.value).length]))
)

const filteredNotes = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  const list = notes.value.filter((note) => {
    if (activeType.value !== 'all' && note.type !== activeType.value) return false
    if (favoriteOnly.value && !note.favorite) return false
    if (!query) return true
    return [
      note.title,
      note.content,
      note.source,
      ...(note.tags || []),
      ...(note.poems || []).flatMap((poem) => [poem.title, poem.content, poem.source]),
      ...(note.images || []).flatMap((image) => [image.name, image.alt]),
    ]
      .join(' ')
      .toLowerCase()
      .includes(query)
  })

  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned)
    if (sortBy.value === 'recent') return b.updatedAt - a.updatedAt
    if (sortBy.value === 'oldest') return a.createdAt - b.createdAt
    if (sortBy.value === 'favorite') {
      return Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt
    }
    return (a.position || 0) - (b.position || 0)
  })
})

const canReorder = computed(
  () => sortBy.value === 'custom' && !keyword.value.trim() && activeType.value === 'all' && !favoriteOnly.value
)

const formMeta = computed(() => typeMeta(form.type))
const editorTitle = computed(() => (editingId.value ? '编辑小便条' : `新建${formMeta.value.label}`))
const hasPoemContent = computed(() =>
  form.type === 'poem' && form.poems.some((poem) => poem.title.trim() || poem.content.trim() || poem.source.trim())
)
const canSave = computed(() =>
  !!(form.title.trim() || form.content.trim() || form.images.length || hasPoemContent.value)
)

function selectType(type) {
  form.type = type
  if (type === 'poem' && !form.poems.length) form.poems.push(emptyPoem())
}

function noteImages(note) {
  if (note.images?.length) return note.images
  return note.image ? [{ data: note.image, name: note.imageName || '', alt: note.imageAlt || '' }] : []
}

function notePoems(note) {
  if (note.poems?.length) return note.poems
  if (note.type === 'poem' && (note.content || note.source)) {
    return [{ title: '', content: note.content || '', source: note.source || '' }]
  }
  return []
}

function openCreate(type = activeType.value === 'all' ? 'quote' : activeType.value) {
  editingId.value = ''
  Object.assign(form, emptyForm(type))
  editorOpen.value = true
}

function openEdit(note) {
  editingId.value = note.id
  const images = noteImages(note).map((image) => ({ ...image }))
  const poems = notePoems(note).map((poem) => ({ ...poem }))
  Object.assign(form, {
    type: note.type,
    title: note.title,
    content: note.type === 'poem' && !note.poems?.length ? '' : note.content,
    source: note.type === 'poem' && !note.poems?.length ? '' : note.source,
    link: note.link || '',
    tagsText: (note.tags || []).join('，'),
    color: note.color,
    images,
    poems: note.type === 'poem' ? (poems.length ? poems : [emptyPoem()]) : poems,
    pinned: note.pinned,
    favorite: note.favorite,
  })
  editorOpen.value = true
}

function closeEditor() {
  if (saving.value) return
  editorOpen.value = false
  imageDrag.value = false
}

function parseTags(text) {
  return [...new Set(String(text || '').split(/[,，#\s]+/).map((tag) => tag.trim()).filter(Boolean))].slice(0, 12)
}

async function submitNote() {
  if (!canSave.value || saving.value) return
  saving.value = true
  try {
    const images = form.images.map((image) => ({
      data: image.data,
      name: image.name || '',
      alt: image.alt?.trim() || '',
    }))
    const poems = form.type === 'poem'
      ? form.poems
          .map((poem) => ({
            title: poem.title.trim(),
            content: poem.content.trim(),
            source: poem.source.trim(),
          }))
          .filter((poem) => poem.title || poem.content || poem.source)
      : []
    await saveNote({
      id: editingId.value || undefined,
      type: form.type,
      title: form.title,
      content: form.content,
      source: form.source,
      link: form.link,
      tags: parseTags(form.tagsText),
      color: form.color,
      images,
      poems,
      image: images[0]?.data || '',
      imageName: images[0]?.name || '',
      imageAlt: images[0]?.alt || '',
      pinned: form.pinned,
      favorite: form.favorite,
    })
    editorOpen.value = false
    ElMessage.success(editingId.value ? '便条已更新' : '便条已收好')
  } catch (error) {
    ElMessage.error(`保存失败：${error?.message || error}`)
  } finally {
    saving.value = false
  }
}

async function deleteOne(note) {
  if (!window.confirm(`删除便条「${note.title || typeMeta(note.type).label}」？`)) return
  try {
    await removeNote(note.id)
    expanded.value.delete(note.id)
    if (randomNote.value?.id === note.id) randomNote.value = null
    ElMessage.success('便条已删除')
  } catch (error) {
    ElMessage.error(`删除失败：${error?.message || error}`)
  }
}

async function toggleFavorite(note) {
  await patchNote(note.id, { favorite: !note.favorite })
}

async function togglePin(note) {
  await patchNote(note.id, { pinned: !note.pinned })
}

function toggleExpanded(id) {
  const next = new Set(expanded.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expanded.value = next
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp))
}

function safeLink(value) {
  if (!value) return ''
  try {
    const url = new URL(value, window.location.href)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

async function copyNote(note) {
  const poemText = notePoems(note)
    .map((poem) => [poem.title, poem.content, poem.source ? `—— ${poem.source}` : ''].filter(Boolean).join('\n'))
    .join('\n\n')
  const text = [
    note.title,
    note.type === 'poem' && poemText ? poemText : note.content,
    note.type === 'poem' ? '' : note.source ? `—— ${note.source}` : '',
  ].filter(Boolean).join('\n')
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制到剪贴板')
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
    ElMessage.success('已复制到剪贴板')
  }
}

function dataUrlFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

async function optimizeImage(file) {
  if (file.type === 'image/gif') return dataUrlFromFile(file)
  const raw = await dataUrlFromFile(file)
  const image = new Image()
  image.src = raw
  await image.decode()

  const maxSide = 1800
  const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * ratio))
  const height = Math.max(1, Math.round(image.naturalHeight * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/webp', 0.86)
}

function validateImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    ElMessage.warning(`“${file.name}”不是支持的图片格式`)
    return false
  }
  if (file.size > 15 * 1024 * 1024) {
    ElMessage.warning(`“${file.name}”超过 15MB`)
    return false
  }
  return true
}

async function acceptImages(fileList) {
  const files = [...(fileList || [])].filter(Boolean)
  if (!files.length) return
  const available = 12 - form.images.length
  if (available <= 0) {
    ElMessage.warning('一组最多保存 12 张图片')
    return
  }
  const accepted = files.filter(validateImage).slice(0, available)
  if (files.length > available) ElMessage.warning(`一组最多 12 张，本次添加前 ${available} 张`)
  if (!accepted.length) return

  imageBusy.value = true
  try {
    for (const file of accepted) {
      form.images.push({
        data: await optimizeImage(file),
        name: file.name,
        alt: file.name.replace(/\.[^.]+$/, ''),
      })
    }
  } catch (error) {
    ElMessage.error(`图片处理失败：${error?.message || error}`)
  } finally {
    imageBusy.value = false
  }
}

async function onImageFile(event) {
  await acceptImages(event.target.files)
  event.target.value = ''
}

async function onImageDrop(event) {
  imageDrag.value = false
  await acceptImages(event.dataTransfer?.files)
}

async function onPaste(event) {
  const files = [...(event.clipboardData?.items || [])]
    .filter((entry) => entry.type.startsWith('image/'))
    .map((entry) => entry.getAsFile())
    .filter(Boolean)
  if (!files.length) return
  event.preventDefault()
  await acceptImages(files)
}

function removeImage(index) {
  form.images.splice(index, 1)
}

function addPoem() {
  if (form.poems.length >= 20) {
    ElMessage.warning('一组最多收录 20 首诗')
    return
  }
  form.poems.push(emptyPoem())
}

function removePoem(index) {
  if (form.poems.length === 1) Object.assign(form.poems[0], emptyPoem())
  else form.poems.splice(index, 1)
}

function resetLightboxDrag() {
  lightboxDrag.active = false
  lightboxDrag.startX = 0
  lightboxDrag.deltaX = 0
}

function showImage(note, index = 0) {
  const images = noteImages(note)
  if (!images.length) return
  lightboxDirection.value = 1
  resetLightboxDrag()
  lightbox.value = { images, index, title: note.title }
}

const lightboxImage = computed(() => lightbox.value?.images?.[lightbox.value.index] || null)
const lightboxTransition = computed(() =>
  lightboxDirection.value > 0 ? 'lightbox-slide-next' : 'lightbox-slide-prev'
)

function goToLightbox(index) {
  if (!lightbox.value || index === lightbox.value.index) return
  lightboxDirection.value = index > lightbox.value.index ? 1 : -1
  resetLightboxDrag()
  lightbox.value = { ...lightbox.value, index }
}

function stepLightbox(direction) {
  if (!lightbox.value || lightbox.value.images.length < 2) return
  const count = lightbox.value.images.length
  lightboxDirection.value = direction
  resetLightboxDrag()
  lightbox.value = {
    ...lightbox.value,
    index: (lightbox.value.index + direction + count) % count,
  }
}

function onLightboxPointerDown(event) {
  if (!lightbox.value || lightbox.value.images.length < 2 || event.button !== 0) return
  lightboxDrag.active = true
  lightboxDrag.startX = event.clientX
  lightboxDrag.deltaX = 0
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

function onLightboxPointerMove(event) {
  if (!lightboxDrag.active) return
  lightboxDrag.deltaX = Math.max(-180, Math.min(180, event.clientX - lightboxDrag.startX))
}

function onLightboxPointerEnd(event) {
  if (!lightboxDrag.active) return
  event.currentTarget.releasePointerCapture?.(event.pointerId)
  const delta = lightboxDrag.deltaX
  if (Math.abs(delta) >= 55) stepLightbox(delta < 0 ? 1 : -1)
  else resetLightboxDrag()
}

function closeLightbox() {
  resetLightboxDrag()
  lightbox.value = null
}

function showRandom() {
  if (!notes.value.length) return
  const pool = notes.value.filter((note) => note.id !== randomNote.value?.id)
  const source = pool.length ? pool : notes.value
  randomNote.value = source[Math.floor(Math.random() * source.length)]
}

function download(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function exportAll() {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    notes: notes.value,
  }
  const stamp = new Date().toISOString().slice(0, 10)
  download(`小便条-${stamp}.json`, JSON.stringify(payload, null, 2))
  ElMessage.success('全部便条已导出')
}

async function onImport(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  try {
    const data = JSON.parse(await file.text())
    const list = Array.isArray(data) ? data : data.notes
    const count = await importNotes(list)
    ElMessage.success(`已导入 ${count} 张便条`)
  } catch (error) {
    ElMessage.error(`导入失败：${error?.message || error}`)
  }
}

function onDragStart(event, note) {
  if (!canReorder.value) {
    event.preventDefault()
    return
  }
  draggingId.value = note.id
  document.documentElement.classList.add('note-dragging')
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', note.id)
}

function onDragEnter(note) {
  if (canReorder.value && note.id !== draggingId.value) dragOverId.value = note.id
}

async function onCardDrop(event, target) {
  event.preventDefault()
  const sourceId = draggingId.value || event.dataTransfer.getData('text/plain')
  endDrag()
  if (!sourceId || sourceId === target.id || !canReorder.value) return

  const ids = filteredNotes.value.map((note) => note.id)
  const from = ids.indexOf(sourceId)
  const to = ids.indexOf(target.id)
  if (from < 0 || to < 0) return
  ids.splice(to, 0, ids.splice(from, 1)[0])
  await reorderNotes(ids)
}

function endDrag() {
  draggingId.value = ''
  dragOverId.value = ''
  document.documentElement.classList.remove('note-dragging')
}

function onKeydown(event) {
  if (lightbox.value && event.key === 'ArrowLeft') {
    event.preventDefault()
    stepLightbox(-1)
    return
  }
  if (lightbox.value && event.key === 'ArrowRight') {
    event.preventDefault()
    stepLightbox(1)
    return
  }
  if (event.key === 'Escape') {
    if (lightbox.value) closeLightbox()
    else if (randomNote.value) randomNote.value = null
    else if (editorOpen.value) closeEditor()
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && editorOpen.value) {
    event.preventDefault()
    submitNote()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  initNotes().catch(() => {})
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.documentElement.classList.remove('note-dragging')
})
</script>

<template>
  <div class="page note-page">
    <PageBack />

    <div class="page-card note-shell">
      <header class="note-head">
        <div>
          <h2 class="page-title">小便条</h2>
          <div class="section-sub">收藏那些值得被反复看见的片刻</div>
        </div>
        <div class="head-actions">
          <button class="soft-btn" :disabled="!notes.length" title="随机翻出一张便条" @click="showRandom">
            <el-icon><RefreshRight /></el-icon>
            随便看看
          </button>
          <button class="primary-btn" @click="openCreate()">
            <el-icon><Plus /></el-icon>
            新建便条
          </button>
        </div>
      </header>

      <div class="note-stats">
        <span><strong>{{ noteStats.total }}</strong> 张便条</span>
        <span><strong>{{ noteStats.favorite }}</strong> 个收藏</span>
        <span><strong>{{ noteStats.image }}</strong> 张图片</span>
        <span class="storage-tip">保存在当前浏览器</span>
      </div>

      <div class="type-strip" aria-label="便条类型">
        <button
          type="button"
          class="type-chip"
          :class="{ active: activeType === 'all' }"
          @click="activeType = 'all'"
        >
          <span>全部</span>
          <b>{{ notes.length }}</b>
        </button>
        <button
          v-for="type in NOTE_TYPES"
          :key="type.value"
          type="button"
          class="type-chip"
          :class="{ active: activeType === type.value }"
          @click="activeType = activeType === type.value ? 'all' : type.value"
        >
          <span>{{ type.emoji }} {{ type.label }}</span>
          <b>{{ typeCounts[type.value] }}</b>
        </button>
      </div>

      <div class="note-tools">
        <label class="search-field">
          <el-icon><Search /></el-icon>
          <input v-model="keyword" placeholder="搜索标题、正文、出处或标签" />
          <button v-if="keyword" type="button" aria-label="清空搜索" @click="keyword = ''">×</button>
        </label>
        <button
          type="button"
          class="favorite-filter"
          :class="{ active: favoriteOnly }"
          :aria-pressed="favoriteOnly"
          @click="favoriteOnly = !favoriteOnly"
        >
          <el-icon><StarFilled v-if="favoriteOnly" /><Star v-else /></el-icon>
          收藏
        </button>
        <SelectMenu v-model="sortBy" :options="SORT_OPTIONS" class="sort-menu" />
        <div class="layout-switch" aria-label="布局">
          <button :class="{ active: layout === 'board' }" title="卡片布局" @click="layout = 'board'">▦</button>
          <button :class="{ active: layout === 'list' }" title="列表布局" @click="layout = 'list'">☰</button>
        </div>
        <button class="icon-soft" title="导出全部" :disabled="!notes.length" @click="exportAll">
          <el-icon><Download /></el-icon>
        </button>
        <button class="icon-soft" title="导入便条" @click="importInput?.click()">
          <el-icon><Upload /></el-icon>
        </button>
        <input ref="importInput" type="file" accept="application/json,.json" hidden @change="onImport" />
      </div>

      <div v-if="notesError" class="load-error">{{ notesError }}</div>
      <div v-else-if="!notesReady" class="loading-board">
        <span v-for="i in 4" :key="i"></span>
      </div>

      <div v-else-if="!filteredNotes.length" class="empty-board">
        <div class="empty-stack" aria-hidden="true"><i></i><i></i><i></i></div>
        <h3>{{ notes.length ? '没有找到匹配的便条' : '便条盒还是空的' }}</h3>
        <p>{{ notes.length ? '换个关键词或筛选条件试试' : '从一句喜欢的话、一张截图或一段歌词开始。' }}</p>
        <button v-if="!notes.length" class="primary-btn" @click="openCreate('quote')">
          <el-icon><Plus /></el-icon>
          写下第一张
        </button>
      </div>

      <TransitionGroup
        v-else
        name="note-list"
        tag="div"
        class="note-board"
        :class="[`layout-${layout}`, { reorderable: canReorder }]"
      >
        <article
          v-for="(note, index) in filteredNotes"
          :key="note.id"
          class="note-card"
          :class="{
            pinned: note.pinned,
            favorite: note.favorite,
            dragging: draggingId === note.id,
            'drag-over': dragOverId === note.id,
          }"
          :style="{
            '--note-color': note.color,
            '--note-index': index % 12,
            ...cardScatter(note, index),
          }"
          :draggable="canReorder"
          @dragstart="onDragStart($event, note)"
          @dragenter.prevent="onDragEnter(note)"
          @dragover.prevent
          @drop="onCardDrop($event, note)"
          @dragend="endDrag"
        >
          <div class="card-accent"></div>
          <div class="card-top">
            <span class="note-type">{{ typeMeta(note.type).emoji }} {{ typeMeta(note.type).label }}</span>
            <div class="card-signals">
              <span v-if="note.pinned" title="已置顶">📌</span>
              <el-icon v-if="note.favorite" class="fav-signal"><StarFilled /></el-icon>
              <el-icon v-if="canReorder" class="drag-handle" title="拖动排序"><Rank /></el-icon>
            </div>
          </div>

          <div
            v-if="noteImages(note).length"
            class="note-gallery"
            :class="`gallery-${Math.min(noteImages(note).length, 4)}`"
          >
            <button
              v-for="(image, imageIndex) in noteImages(note).slice(0, 4)"
              :key="`${image.name}-${imageIndex}`"
              type="button"
              class="note-image"
              @click="showImage(note, imageIndex)"
            >
              <img :src="image.data" :alt="image.alt || note.title || `便条图片 ${imageIndex + 1}`" />
              <span v-if="imageIndex === 3 && noteImages(note).length > 4" class="gallery-more">
                +{{ noteImages(note).length - 4 }}
              </span>
              <span v-else class="image-zoom"><el-icon><Picture /></el-icon> 查看</span>
            </button>
          </div>

          <h3 v-if="note.title">{{ note.title }}</h3>

          <div
            v-if="note.type === 'poem' && notePoems(note).length"
            class="poem-collection"
            :class="{ expanded: expanded.has(note.id) }"
          >
            <section
              v-for="(poem, poemIndex) in (expanded.has(note.id) ? notePoems(note) : notePoems(note).slice(0, 2))"
              :key="poemIndex"
              class="poem-piece"
            >
              <h4 v-if="poem.title">{{ poem.title }}</h4>
              <p v-if="poem.content">{{ poem.content }}</p>
              <cite v-if="poem.source">—— {{ poem.source }}</cite>
            </section>
            <button
              v-if="notePoems(note).length > 2"
              type="button"
              class="collection-toggle"
              @click="toggleExpanded(note.id)"
            >
              {{ expanded.has(note.id) ? '收起组诗' : `展开全部 ${notePoems(note).length} 首` }}
            </button>
          </div>

          <button
            v-else-if="note.content"
            type="button"
            class="note-content"
            :class="{ expanded: expanded.has(note.id) }"
            @click="toggleExpanded(note.id)"
          >
            {{ note.content }}
          </button>

          <div v-if="(note.type !== 'poem' && note.source) || safeLink(note.link)" class="note-source">
            <span v-if="note.type !== 'poem' && note.source">—— {{ note.source }}</span>
            <a v-if="safeLink(note.link)" :href="safeLink(note.link)" target="_blank" rel="noopener" @click.stop>
              打开链接 ↗
            </a>
          </div>

          <div v-if="note.tags?.length" class="note-tags">
            <button v-for="tag in note.tags" :key="tag" type="button" @click="keyword = tag">#{{ tag }}</button>
          </div>

          <footer class="card-foot">
            <time>{{ formatDate(note.updatedAt) }}</time>
            <div class="card-actions">
              <button type="button" :title="note.pinned ? '取消置顶' : '置顶'" @click="togglePin(note)">📌</button>
              <button type="button" :title="note.favorite ? '取消收藏' : '收藏'" @click="toggleFavorite(note)">
                <el-icon><StarFilled v-if="note.favorite" /><Star v-else /></el-icon>
              </button>
              <button type="button" title="复制文字" @click="copyNote(note)"><el-icon><CopyDocument /></el-icon></button>
              <button type="button" title="编辑" @click="openEdit(note)"><el-icon><Edit /></el-icon></button>
              <button type="button" class="danger" title="删除" @click="deleteOne(note)"><el-icon><Delete /></el-icon></button>
            </div>
          </footer>
        </article>
      </TransitionGroup>

      <p v-if="canReorder && filteredNotes.length > 1" class="reorder-hint">
        <el-icon><Rank /></el-icon>
        在“自由排序”下可拖动便条调整顺序
      </p>
    </div>

    <!-- 编辑抽屉 -->
    <teleport to="body">
      <transition name="drawer-fade">
        <div v-if="editorOpen" class="drawer-mask" @click.self="closeEditor">
          <aside class="note-drawer" role="dialog" aria-modal="true" :aria-label="editorTitle">
            <header class="drawer-head">
              <div>
                <span class="drawer-eyebrow">POCKET NOTE</span>
                <h2>{{ editorTitle }}</h2>
              </div>
              <button type="button" class="drawer-close" aria-label="关闭" @click="closeEditor">×</button>
            </header>

            <div class="drawer-body" @paste="onPaste">
              <div class="field-block">
                <span class="field-label">类型</span>
                <div class="editor-types">
                  <button
                    v-for="type in NOTE_TYPES"
                    :key="type.value"
                    type="button"
                    :class="{ active: form.type === type.value }"
                    @click="selectType(type.value)"
                  >
                    <span>{{ type.emoji }}</span>
                    {{ type.label }}
                  </button>
                </div>
                <small>{{ formMeta.hint }}</small>
              </div>

              <label class="field-block">
                <span class="field-label">{{ form.type === 'poem' ? '组诗标题' : '标题' }} <small>可选</small></span>
                <input
                  v-model="form.title"
                  maxlength="80"
                  :placeholder="form.type === 'poem' ? '例如：春日三章' : '给这张便条起个名字'"
                />
              </label>

              <div v-if="form.type === 'poem'" class="field-block poem-editor-block">
                <div class="collection-heading">
                  <span class="field-label">组诗 <small>{{ form.poems.length }} / 20 首</small></span>
                  <button type="button" class="add-piece-btn" @click="addPoem">
                    <el-icon><Plus /></el-icon> 添加一首
                  </button>
                </div>
                <div class="poem-editor-list">
                  <section v-for="(poem, poemIndex) in form.poems" :key="poemIndex" class="poem-editor-item">
                    <header>
                      <strong>第 {{ poemIndex + 1 }} 首</strong>
                      <button type="button" aria-label="移除这首诗" @click="removePoem(poemIndex)">×</button>
                    </header>
                    <input v-model="poem.title" maxlength="80" placeholder="小标题（可选）" />
                    <textarea v-model="poem.content" rows="6" maxlength="5000" placeholder="写下这一首诗……"></textarea>
                    <input v-model="poem.source" maxlength="100" placeholder="作者 / 出处（可选）" />
                  </section>
                </div>
              </div>

              <label v-else class="field-block">
                <span class="field-label">正文</span>
                <textarea
                  v-model="form.content"
                  rows="8"
                  maxlength="5000"
                  :placeholder="formMeta.hint"
                ></textarea>
                <span class="char-count">{{ form.content.length }} / 5000</span>
              </label>

              <div class="field-row" :class="{ 'single-field': form.type === 'poem' }">
                <label v-if="form.type !== 'poem'" class="field-block">
                  <span class="field-label">作者 / 出处</span>
                  <input v-model="form.source" maxlength="100" placeholder="例如：李白《将进酒》" />
                </label>
                <label class="field-block">
                  <span class="field-label">相关链接</span>
                  <input v-model="form.link" maxlength="500" placeholder="https://…" />
                </label>
              </div>

              <label class="field-block">
                <span class="field-label">标签</span>
                <input v-model="form.tagsText" maxlength="160" placeholder="游戏，诗词，夜晚（逗号分隔）" />
              </label>

              <div class="field-block">
                <div class="collection-heading">
                  <span class="field-label">图片 <small>{{ form.images.length }} / 12 张，可多选、拖入或粘贴</small></span>
                  <button v-if="form.images.length" type="button" class="add-piece-btn" :disabled="imageBusy" @click="imageInput?.click()">
                    <el-icon><Plus /></el-icon> 继续添加
                  </button>
                </div>
                <div
                  class="image-drop"
                  :class="{ over: imageDrag, filled: form.images.length }"
                  @dragenter.prevent="imageDrag = true"
                  @dragover.prevent
                  @dragleave.prevent="imageDrag = false"
                  @drop.prevent="onImageDrop"
                >
                  <div v-if="form.images.length" class="image-editor-grid">
                    <figure v-for="(image, imageIndex) in form.images" :key="`${image.name}-${imageIndex}`">
                      <img :src="image.data" :alt="image.alt || `图片 ${imageIndex + 1}`" />
                      <span>{{ imageIndex + 1 }}</span>
                      <button type="button" aria-label="移除图片" @click="removeImage(imageIndex)">×</button>
                      <input v-model="image.alt" maxlength="120" :placeholder="`第 ${imageIndex + 1} 张图片说明`" />
                    </figure>
                  </div>
                  <button v-else type="button" class="image-empty" :disabled="imageBusy" @click="imageInput?.click()">
                    <el-icon><Picture /></el-icon>
                    <strong>{{ imageBusy ? '正在处理图片…' : '放入一组喜欢的画面' }}</strong>
                    <span>可一次选择多张；JPG / PNG / WebP / GIF，单张最大 15MB</span>
                  </button>
                </div>
                <p v-if="imageBusy" class="image-processing">正在处理图片，请稍候……</p>
                <input
                  ref="imageInput"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  hidden
                  @change="onImageFile"
                />
              </div>

              <div class="appearance-row">
                <div class="field-block compact">
                  <span class="field-label">卡片颜色</span>
                  <div class="color-picks">
                    <button
                      v-for="color in COLORS"
                      :key="color"
                      type="button"
                      :class="{ active: form.color === color }"
                      :style="{ '--pick': color }"
                      :aria-label="`选择颜色 ${color}`"
                      @click="form.color = color"
                    ></button>
                  </div>
                </div>
                <label class="check-option"><input v-model="form.pinned" type="checkbox" /> 📌 置顶</label>
                <label class="check-option"><input v-model="form.favorite" type="checkbox" /> ⭐ 收藏</label>
              </div>
            </div>

            <footer class="drawer-foot">
              <span>Ctrl / ⌘ + Enter 保存</span>
              <div>
                <button type="button" class="soft-btn" @click="closeEditor">取消</button>
                <button type="button" class="primary-btn" :disabled="!canSave || saving" @click="submitNote">
                  {{ saving ? '保存中…' : editingId ? '保存修改' : '收进便条盒' }}
                </button>
              </div>
            </footer>
          </aside>
        </div>
      </transition>
    </teleport>

    <!-- 随机翻阅 -->
    <teleport to="body">
      <transition name="spotlight-fade">
        <div v-if="randomNote" class="spotlight-mask" @click.self="randomNote = null">
          <article class="spotlight-card" :style="{ '--note-color': randomNote.color }">
            <button class="spotlight-close" aria-label="关闭" @click="randomNote = null">×</button>
            <span class="spotlight-type">{{ typeMeta(randomNote.type).emoji }} {{ typeMeta(randomNote.type).label }}</span>
            <div v-if="noteImages(randomNote).length" class="spotlight-gallery">
              <button
                v-for="(image, imageIndex) in noteImages(randomNote)"
                :key="imageIndex"
                type="button"
                @click="showImage(randomNote, imageIndex)"
              >
                <img :src="image.data" :alt="image.alt || randomNote.title || `便条图片 ${imageIndex + 1}`" />
              </button>
            </div>
            <h2 v-if="randomNote.title">{{ randomNote.title }}</h2>
            <div v-if="randomNote.type === 'poem' && notePoems(randomNote).length" class="spotlight-poems">
              <section v-for="(poem, poemIndex) in notePoems(randomNote)" :key="poemIndex">
                <h3 v-if="poem.title">{{ poem.title }}</h3>
                <p v-if="poem.content">{{ poem.content }}</p>
                <cite v-if="poem.source">—— {{ poem.source }}</cite>
              </section>
            </div>
            <template v-else>
              <p v-if="randomNote.content">{{ randomNote.content }}</p>
              <cite v-if="randomNote.source">—— {{ randomNote.source }}</cite>
            </template>
            <div class="spotlight-actions">
              <button @click="showRandom"><el-icon><RefreshRight /></el-icon> 再翻一张</button>
              <button @click="openEdit(randomNote); randomNote = null"><el-icon><Edit /></el-icon> 编辑</button>
            </div>
          </article>
        </div>
      </transition>
    </teleport>

    <!-- 图片灯箱 -->
    <teleport to="body">
      <transition name="lightbox-fade">
        <div v-if="lightbox && lightboxImage" class="lightbox" @click.self="closeLightbox">
          <div
            class="lightbox-ambient"
            :style="{ backgroundImage: `url(${lightboxImage.data})` }"
            aria-hidden="true"
          ></div>
          <div class="lightbox-grain" aria-hidden="true"></div>

          <header class="lightbox-topbar">
            <div>
              <span v-if="lightbox.images.length > 1" class="lightbox-counter">
                {{ String(lightbox.index + 1).padStart(2, '0') }}
                <i></i>
                {{ String(lightbox.images.length).padStart(2, '0') }}
              </span>
              <strong>{{ lightbox.title || '图片便条' }}</strong>
            </div>
            <button class="lightbox-close" aria-label="关闭图片" @click="closeLightbox">
              <el-icon><Close /></el-icon>
            </button>
          </header>

          <button
            v-if="lightbox.images.length > 1"
            class="lightbox-nav prev"
            aria-label="上一张图片"
            @click="stepLightbox(-1)"
          >
            <el-icon><ArrowLeft /></el-icon>
          </button>

          <div
            class="lightbox-stage"
            :class="{ dragging: lightboxDrag.active, single: lightbox.images.length === 1 }"
            :style="{
              '--drag-x': `${lightboxDrag.deltaX}px`,
              '--drag-rotate': `${lightboxDrag.deltaX / 90}deg`,
            }"
            @pointerdown="onLightboxPointerDown"
            @pointermove="onLightboxPointerMove"
            @pointerup="onLightboxPointerEnd"
            @pointercancel="onLightboxPointerEnd"
          >
            <transition :name="lightboxTransition">
              <img
                :key="lightbox.index"
                :src="lightboxImage.data"
                :alt="lightboxImage.alt || lightbox.title || '便条图片'"
              />
            </transition>
          </div>

          <button
            v-if="lightbox.images.length > 1"
            class="lightbox-nav next"
            aria-label="下一张图片"
            @click="stepLightbox(1)"
          >
            <el-icon><ArrowRight /></el-icon>
          </button>

          <footer class="lightbox-footer">
            <p>{{ lightboxImage.alt || lightboxImage.name || `第 ${lightbox.index + 1} 张图片` }}</p>
            <div v-if="lightbox.images.length > 1" class="lightbox-thumbs" aria-label="图片缩略图">
              <button
                v-for="(image, imageIndex) in lightbox.images"
                :key="imageIndex"
                type="button"
                :class="{ active: imageIndex === lightbox.index }"
                :aria-label="`查看第 ${imageIndex + 1} 张图片`"
                @click="goToLightbox(imageIndex)"
              >
                <img :src="image.data" :alt="image.alt || `图片 ${imageIndex + 1}`" />
              </button>
            </div>
            <small>拖动或使用 ← → 切换 · Esc 关闭</small>
          </footer>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<style scoped>
.note-page {
  display: block;
  max-width: 1180px;
  margin: 0 auto;
}

.note-shell {
  max-width: 1080px;
  overflow: visible;
}

.note-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.head-actions,
.note-tools,
.card-actions,
.drawer-foot > div,
.spotlight-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.primary-btn,
.soft-btn,
.icon-soft {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 36px;
  padding: 0.42rem 0.85rem;
  font-family: inherit;
  font-size: 0.74rem;
  border-radius: 10px;
  transition: transform 0.22s ease, background 0.22s ease, color 0.22s ease, box-shadow 0.22s ease;
}

.primary-btn {
  color: #fff;
  background: linear-gradient(135deg, #315fc0, #4f7fd8);
  border: none;
}

.primary-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px -10px rgba(49, 95, 192, 0.7);
}

.primary-btn:disabled,
.soft-btn:disabled,
.icon-soft:disabled {
  opacity: 0.42;
}

.soft-btn,
.icon-soft {
  color: var(--accent);
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(37, 99, 235, 0.16);
}

.soft-btn:hover:not(:disabled),
.icon-soft:hover:not(:disabled) {
  color: #fff;
  background: var(--accent);
  transform: translateY(-1px);
}

.icon-soft {
  width: 36px;
  padding: 0;
}

.note-stats {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin: -0.3rem 0 1rem;
  font-size: 0.68rem;
  color: var(--text-dim);
}

.note-stats strong {
  color: var(--accent);
  font-size: 0.82rem;
}

.storage-tip {
  margin-left: auto;
  color: #9aa8c0;
}

.type-strip {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.15rem 0 0.7rem;
  scrollbar-width: none;
}

.type-strip::-webkit-scrollbar { display: none; }

.type-chip {
  flex: 1;
  min-width: 90px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  padding: 0.5rem 0.65rem;
  color: var(--text-dim);
  background: rgba(255, 255, 255, 0.48);
  border: 1px solid rgba(37, 99, 235, 0.1);
  border-radius: 12px;
  font-size: 0.7rem;
  transition: 0.22s ease;
}

.type-chip b {
  font-size: 0.62rem;
  color: #9aa8c0;
}

.type-chip:hover {
  transform: translateY(-2px);
  border-color: rgba(37, 99, 235, 0.3);
}

.type-chip.active {
  color: #fff;
  background: linear-gradient(135deg, #315fc0, #4f7fd8);
  border-color: transparent;
  box-shadow: 0 7px 16px -11px rgba(49, 95, 192, 0.8);
}

.type-chip.active b { color: rgba(255, 255, 255, 0.75); }

.note-tools {
  flex-wrap: wrap;
  margin-bottom: 1.1rem;
}

.search-field {
  flex: 1;
  min-width: 230px;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.48rem 0.65rem;
  color: #8a99b1;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(37, 99, 235, 0.14);
  border-radius: 11px;
  transition: 0.2s ease;
}

.search-field:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.search-field input {
  flex: 1;
  min-width: 0;
  color: var(--text-dark);
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.76rem;
}

.search-field button {
  color: #9aa8c0;
  background: none;
  border: none;
}

.favorite-filter {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 36px;
  padding: 0 0.7rem;
  color: var(--text-dim);
  background: rgba(255, 255, 255, 0.52);
  border: 1px solid rgba(37, 99, 235, 0.13);
  border-radius: 10px;
  font-size: 0.72rem;
}

.favorite-filter.active {
  color: #9a6700;
  background: rgba(250, 204, 21, 0.13);
  border-color: rgba(202, 138, 4, 0.28);
}

.sort-menu { width: 120px; }

.layout-switch {
  display: flex;
  padding: 3px;
  background: rgba(219, 234, 254, 0.55);
  border-radius: 9px;
}

.layout-switch button {
  width: 29px;
  height: 29px;
  color: #8796ad;
  background: transparent;
  border: none;
  border-radius: 7px;
}

.layout-switch button.active {
  color: var(--accent);
  background: #fff;
  box-shadow: 0 3px 8px -5px rgba(30, 60, 110, 0.4);
}

.note-board {
  position: relative;
  display: grid;
  gap: 0.9rem;
}

.layout-board {
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  align-items: start;
  gap: 0.65rem 0.8rem;
  padding: 0.55rem 0.5rem 1rem;
}

.layout-list { grid-template-columns: 1fr; }

.note-card {
  position: relative;
  min-width: 0;
  overflow: hidden;
  padding: 0.9rem 1rem 0.75rem;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--note-color) 9%, rgba(255,255,255,.88)), rgba(255, 255, 255, 0.76));
  border: 1px solid color-mix(in srgb, var(--note-color) 24%, transparent);
  border-radius: 18px;
  box-shadow: 0 9px 24px -22px color-mix(in srgb, var(--note-color) 60%, #1e3a5f);
  transition: transform 0.34s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease, box-shadow 0.3s ease, opacity 0.25s ease;
  animation: note-rise 0.45s calc(var(--note-index) * 35ms) cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

.layout-board .note-card {
  z-index: var(--note-z);
  transform: translate3d(var(--note-x), var(--note-y), 0) rotate(var(--note-rotate));
  animation-name: note-scatter-rise;
}

.layout-list .note-card:hover {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--note-color) 46%, transparent);
  box-shadow: 0 18px 34px -25px color-mix(in srgb, var(--note-color) 72%, #1e3a5f);
}

.layout-board .note-card:hover,
.layout-board .note-card:focus-within {
  z-index: 20;
  transform: translate3d(var(--note-x), calc(var(--note-y) - 7px), 0) rotate(0deg) scale(1.018);
  border-color: color-mix(in srgb, var(--note-color) 48%, transparent);
  box-shadow: 0 24px 42px -25px color-mix(in srgb, var(--note-color) 75%, #172a47);
}

.note-card.pinned {
  border-top-color: var(--note-color);
}

.note-card.dragging {
  opacity: 0.35;
  transform: scale(0.96);
}

.note-card.drag-over {
  transform: translateY(-5px) scale(1.015);
  box-shadow: 0 0 0 2px var(--note-color), 0 18px 34px -24px var(--note-color);
}

.layout-board .note-card.dragging {
  z-index: 30;
  transform: scale(0.96) rotate(0deg);
}

.layout-board .note-card.drag-over {
  z-index: 25;
  transform: translate3d(var(--note-x), calc(var(--note-y) - 5px), 0) rotate(0deg) scale(1.015);
}

.layout-board .note-card:nth-child(4n + 1)::before,
.layout-board .note-card:nth-child(7n + 3)::before {
  content: '';
  position: absolute;
  top: 5px;
  left: 50%;
  z-index: 2;
  width: 42px;
  height: 11px;
  pointer-events: none;
  background: rgba(255, 239, 180, 0.48);
  border: 1px solid rgba(187, 153, 64, 0.12);
  box-shadow: 0 2px 5px rgba(77, 64, 30, 0.08);
  transform: translateX(-50%) rotate(-2deg);
}

.layout-board .note-card:nth-child(7n + 3)::before {
  left: auto;
  right: 18px;
  width: 34px;
  background: rgba(190, 222, 239, 0.45);
  transform: rotate(4deg);
}

.reorderable .note-card { cursor: url('/cursor/pointer.cur'), grab; }
.reorderable .note-card:active,
.reorderable .note-card.dragging { cursor: url('/cursor/move.cur'), grabbing; }

:global(html.note-dragging),
:global(html.note-dragging *) {
  cursor: url('/cursor/move.cur'), grabbing !important;
}

.card-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--note-color);
  opacity: 0.8;
}

.card-top,
.card-foot,
.note-source {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.note-type {
  font-size: 0.64rem;
  color: var(--note-color);
  font-weight: 700;
}

.card-signals {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: #9aa8c0;
  font-size: 0.68rem;
}

.fav-signal { color: #d59b13; }
.drag-handle { opacity: 0.45; }

.note-gallery {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: 105px;
  gap: 4px;
  overflow: hidden;
  margin: 0.7rem 0 0.75rem;
  border-radius: 13px;
  background: #dce7f5;
}

.note-gallery.gallery-1 {
  grid-template-columns: 1fr;
  grid-auto-rows: minmax(170px, 270px);
}

.note-gallery.gallery-2 { grid-auto-rows: 180px; }
.note-gallery.gallery-3 .note-image:first-child { grid-row: span 2; }

.note-image {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: block;
  overflow: hidden;
  padding: 0;
  background: #dce7f5;
  border: none;
}

.note-image img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}

.note-image .image-zoom,
.note-image .gallery-more {
  position: absolute;
  right: 0.45rem;
  bottom: 0.4rem;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0.22rem 0.45rem;
  color: #fff;
  background: rgba(15, 23, 42, 0.62);
  border-radius: 8px;
  font-size: 0.58rem;
  opacity: 0;
  transform: translateY(5px);
  transition: 0.25s ease;
}

.note-image .gallery-more {
  inset: 0;
  justify-content: center;
  border-radius: 0;
  font-size: 1.1rem;
  opacity: 1;
  transform: none;
  background: rgba(15, 23, 42, 0.5);
}

.note-image:hover img { transform: scale(1.045); }
.note-image:hover .image-zoom { opacity: 1; transform: translateY(0); }

.poem-collection {
  position: relative;
  margin-top: 0.45rem;
}

.poem-piece {
  padding: 0.55rem 0;
  border-top: 1px dashed color-mix(in srgb, var(--note-color) 18%, transparent);
}

.poem-piece:first-child { border-top: 0; }
.poem-piece h4 { margin: 0 0 0.3rem; color: var(--note-color); font-size: 0.76rem; }
.poem-piece p { margin: 0; white-space: pre-wrap; color: var(--text-dark); font-size: 0.79rem; line-height: 1.86; }
.poem-piece cite { display: block; margin-top: 0.32rem; color: #7d8ca5; text-align: right; font-size: 0.64rem; font-style: normal; }

.collection-toggle {
  position: sticky;
  bottom: 0;
  width: 100%;
  margin-top: 0.25rem;
  padding: 0.45rem;
  color: var(--note-color);
  background: color-mix(in srgb, var(--note-color) 8%, rgba(255,255,255,.92));
  border: 0;
  border-radius: 9px;
  font-size: 0.64rem;
}

.note-card h3 {
  margin: 0.65rem 0 0.45rem;
  font-size: 0.92rem;
  color: var(--text-dark);
}

.note-content {
  width: 100%;
  display: -webkit-box;
  overflow: hidden;
  padding: 0;
  color: var(--text-dark);
  background: none;
  border: none;
  text-align: left;
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 0.79rem;
  line-height: 1.78;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 7;
}

.note-content.expanded {
  display: block;
  overflow: visible;
}

.layout-list .note-content { -webkit-line-clamp: 4; }

.note-source {
  align-items: flex-end;
  margin-top: 0.55rem;
  color: #7d8ca5;
  font-size: 0.66rem;
}

.note-source a {
  flex-shrink: 0;
  color: var(--note-color);
}

.note-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.7rem;
}

.note-tags button {
  padding: 0.12rem 0.42rem;
  color: color-mix(in srgb, var(--note-color) 82%, #334155);
  background: color-mix(in srgb, var(--note-color) 9%, transparent);
  border: none;
  border-radius: 99px;
  font-size: 0.6rem;
}

.card-foot {
  margin-top: 0.8rem;
  padding-top: 0.55rem;
  border-top: 1px dashed color-mix(in srgb, var(--note-color) 18%, transparent);
}

.card-foot time {
  color: #9aa8c0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.58rem;
}

.card-actions {
  gap: 0.12rem;
  opacity: 0;
  transform: translateX(5px);
  transition: 0.22s ease;
}

.note-card:hover .card-actions,
.note-card:focus-within .card-actions {
  opacity: 1;
  transform: translateX(0);
}

.card-actions button {
  width: 27px;
  height: 27px;
  display: grid;
  place-items: center;
  padding: 0;
  color: #7e8da5;
  background: rgba(255, 255, 255, 0.54);
  border: none;
  border-radius: 7px;
  font-size: 0.7rem;
  transition: 0.18s ease;
}

.card-actions button:hover {
  color: var(--note-color);
  background: #fff;
  transform: translateY(-2px);
}

.card-actions button.danger:hover { color: #dc4c4c; }

.reorder-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 0.8rem;
  color: #9aa8c0;
  font-size: 0.62rem;
}

.empty-board,
.load-error {
  min-height: 330px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.empty-board h3 {
  margin-top: 1rem;
  color: var(--text-dark);
}

.empty-board p {
  margin: 0.4rem 0 1rem;
  color: var(--text-dim);
  font-size: 0.75rem;
}

.empty-stack {
  position: relative;
  width: 80px;
  height: 70px;
}

.empty-stack i {
  position: absolute;
  inset: 8px;
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.5);
}

.empty-stack i:nth-child(1) { transform: rotate(-12deg) translate(-9px, 2px); }
.empty-stack i:nth-child(2) { transform: rotate(10deg) translate(9px, 1px); }
.empty-stack i:nth-child(3) { background: rgba(219, 234, 254, 0.7); }

.load-error { color: #d84e4e; }

.loading-board {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.8rem;
}

.loading-board span {
  height: 180px;
  border-radius: 18px;
  background: linear-gradient(100deg, rgba(219,234,254,.45), rgba(255,255,255,.78), rgba(219,234,254,.45));
  background-size: 220% 100%;
  animation: note-loading 1.4s linear infinite;
}

.note-list-move,
.note-list-enter-active,
.note-list-leave-active {
  transition: opacity 0.25s ease, transform 0.34s cubic-bezier(0.16, 1, 0.3, 1);
}

.note-list-enter-from { opacity: 0; transform: translateY(12px) scale(0.97); }
.note-list-leave-to { opacity: 0; transform: scale(0.94); }

/* 编辑抽屉 */
.drawer-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
  background: rgba(13, 27, 51, 0.32);
  backdrop-filter: blur(4px);
}

.note-drawer {
  width: min(560px, 100vw);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(244, 249, 255, 0.98);
  box-shadow: -20px 0 55px -28px rgba(15, 35, 70, 0.55);
}

.drawer-head,
.drawer-foot {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(37, 99, 235, 0.12);
}

.drawer-head h2 {
  margin-top: 0.12rem;
  font-size: 1.12rem;
  color: var(--text-dark);
}

.drawer-eyebrow {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.55rem;
  letter-spacing: 0.18em;
  color: var(--accent);
}

.drawer-close,
.spotlight-close {
  width: 34px;
  height: 34px;
  color: #8b9ab2;
  background: rgba(37, 99, 235, 0.06);
  border: 1px solid rgba(37, 99, 235, 0.12);
  border-radius: 50%;
  font-size: 1.15rem;
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.95rem;
  padding: 1.15rem 1.25rem 2rem;
}

.field-block {
  position: relative;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  color: var(--text-dark);
  font-size: 0.72rem;
  font-weight: 700;
}

.field-label small,
.field-block > small {
  color: #98a6bc;
  font-size: 0.62rem;
  font-weight: 400;
}

.field-block input,
.field-block textarea {
  width: 100%;
  padding: 0.55rem 0.7rem;
  color: var(--text-dark);
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(37, 99, 235, 0.17);
  border-radius: 10px;
  outline: none;
  font-family: inherit;
  font-size: 0.77rem;
  transition: 0.2s ease;
}

.field-block textarea {
  resize: vertical;
  min-height: 145px;
  line-height: 1.7;
}

.field-block input:focus,
.field-block textarea:focus {
  border-color: var(--accent);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.char-count {
  position: absolute;
  right: 0.6rem;
  bottom: 0.45rem;
  color: #a1aec0;
  font-size: 0.56rem;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.7rem;
}

.field-row.single-field { grid-template-columns: 1fr; }

.editor-types {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.35rem;
}

.editor-types button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0.45rem 0.2rem;
  color: var(--text-dim);
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(37, 99, 235, 0.12);
  border-radius: 10px;
  font-size: 0.62rem;
  transition: 0.2s ease;
}

.editor-types button span { font-size: 1rem; }
.editor-types button:hover { transform: translateY(-2px); }
.editor-types button.active {
  color: #fff;
  background: var(--accent);
  border-color: var(--accent);
}

.collection-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
}

.add-piece-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0.3rem 0.55rem;
  color: var(--accent);
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(37, 99, 235, 0.18);
  border-radius: 8px;
  font-size: 0.63rem;
}

.add-piece-btn:disabled { opacity: 0.45; }

.poem-editor-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.poem-editor-item {
  display: grid;
  gap: 0.45rem;
  padding: 0.75rem;
  background: color-mix(in srgb, var(--accent) 4%, rgba(255,255,255,.82));
  border: 1px solid rgba(37, 99, 235, 0.13);
  border-radius: 12px;
}

.poem-editor-item header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--accent);
  font-size: 0.66rem;
}

.poem-editor-item header button {
  width: 25px;
  height: 25px;
  padding: 0;
  color: #d45a5a;
  background: rgba(220, 76, 76, 0.07);
  border: 0;
  border-radius: 50%;
  font-size: 1rem;
}

.poem-editor-item textarea { min-height: 120px; }

.image-drop {
  min-height: 145px;
  display: grid;
  place-items: center;
  padding: 0.45rem;
  background: rgba(219, 234, 254, 0.3);
  border: 1.5px dashed rgba(37, 99, 235, 0.28);
  border-radius: 14px;
  transition: 0.22s ease;
}

.image-drop.over {
  background: rgba(37, 99, 235, 0.1);
  border-color: var(--accent);
  transform: scale(1.01);
}

.image-drop.filled { border-style: solid; }

.image-editor-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.image-editor-grid figure {
  position: relative;
  min-width: 0;
  margin: 0;
  padding: 0.35rem;
  background: rgba(255,255,255,.72);
  border: 1px solid rgba(37, 99, 235, 0.12);
  border-radius: 10px;
}

.image-editor-grid img {
  width: 100%;
  height: 125px;
  display: block;
  object-fit: cover;
  border-radius: 7px;
}

.image-editor-grid figure > span {
  position: absolute;
  top: 0.65rem;
  left: 0.65rem;
  min-width: 21px;
  height: 21px;
  display: grid;
  place-items: center;
  color: #fff;
  background: rgba(15,23,42,.58);
  border-radius: 7px;
  font-size: 0.58rem;
}

.image-editor-grid figure > button {
  position: absolute;
  top: 0.58rem;
  right: 0.58rem;
  width: 25px;
  height: 25px;
  padding: 0;
  color: #fff;
  background: rgba(190,50,50,.75);
  border: 0;
  border-radius: 50%;
  font-size: 1rem;
}

.image-editor-grid input {
  margin-top: 0.35rem;
  padding: 0.4rem 0.5rem;
  font-size: 0.65rem;
}

.image-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 1.1rem;
  color: #8090a8;
  background: transparent;
  border: none;
}

.image-empty .el-icon { font-size: 1.8rem; color: var(--accent); }
.image-empty strong { color: var(--text-dark); font-size: 0.75rem; }
.image-empty span { font-size: 0.62rem; }
.image-processing { margin: 0; color: #8392aa; font-size: 0.62rem; }

.appearance-row {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 0.8rem;
}

.field-block.compact { margin-right: auto; }
.color-picks { display: flex; gap: 0.4rem; }
.color-picks button {
  width: 24px;
  height: 24px;
  padding: 0;
  background: var(--pick);
  border: 2px solid transparent;
  border-radius: 50%;
  box-shadow: 0 2px 6px color-mix(in srgb, var(--pick) 45%, transparent);
  transition: 0.2s ease;
}
.color-picks button:hover { transform: scale(1.15); }
.color-picks button.active { border-color: #fff; outline: 2px solid var(--pick); }

.check-option {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-dim);
  font-size: 0.7rem;
}
.check-option input { accent-color: var(--accent); }

.drawer-foot {
  border-top: 1px solid rgba(37, 99, 235, 0.12);
  border-bottom: none;
}
.drawer-foot > span { color: #9aa8c0; font-size: 0.6rem; }

.drawer-fade-enter-active,
.drawer-fade-leave-active { transition: opacity 0.28s ease; }
.drawer-fade-enter-active .note-drawer,
.drawer-fade-leave-active .note-drawer { transition: transform 0.36s cubic-bezier(0.16, 1, 0.3, 1); }
.drawer-fade-enter-from,
.drawer-fade-leave-to { opacity: 0; }
.drawer-fade-enter-from .note-drawer,
.drawer-fade-leave-to .note-drawer { transform: translateX(100%); }

/* 随机便条 */
.spotlight-mask {
  position: fixed;
  inset: 0;
  z-index: 1010;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(10, 24, 48, 0.56);
  backdrop-filter: blur(10px);
}

.spotlight-card {
  position: relative;
  width: min(560px, 94vw);
  max-height: 86vh;
  overflow-y: auto;
  padding: 2rem;
  color: var(--text-dark);
  background: linear-gradient(145deg, color-mix(in srgb, var(--note-color) 12%, #fff), #f8fbff);
  border: 1px solid color-mix(in srgb, var(--note-color) 40%, transparent);
  border-radius: 24px;
  box-shadow: 0 30px 70px -35px rgba(6, 23, 52, 0.8);
}

.spotlight-close { position: absolute; top: 0.8rem; right: 0.8rem; }
.spotlight-type { color: var(--note-color); font-size: 0.68rem; font-weight: 700; }
.spotlight-gallery { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.45rem; margin: 1rem 0; }
.spotlight-gallery button { min-width: 0; padding: 0; background: transparent; border: 0; }
.spotlight-gallery button:only-child { grid-column: 1 / -1; }
.spotlight-gallery img { width: 100%; height: 180px; display: block; object-fit: cover; margin: 0; border-radius: 15px; cursor: zoom-in; }
.spotlight-gallery button:only-child img { height: auto; max-height: 420px; object-fit: contain; }
.spotlight-card h2 { margin: 1rem 0 0.6rem; font-size: 1.35rem; }
.spotlight-card p { white-space: pre-wrap; font-size: 0.9rem; line-height: 1.9; }
.spotlight-card cite { display: block; margin-top: 0.8rem; text-align: right; color: var(--text-dim); font-size: 0.74rem; font-style: normal; }
.spotlight-poems { display: grid; gap: 0.85rem; }
.spotlight-poems section { padding: 0.75rem 0; border-top: 1px dashed color-mix(in srgb, var(--note-color) 22%, transparent); }
.spotlight-poems h3 { margin: 0 0 0.4rem; color: var(--note-color); font-size: 0.88rem; }
.spotlight-poems p { margin: 0; }
.spotlight-actions { justify-content: center; margin-top: 1.3rem; }
.spotlight-actions button { display: inline-flex; align-items: center; gap: 4px; padding: 0.45rem 0.8rem; color: var(--note-color); background: rgba(255,255,255,.65); border: 1px solid color-mix(in srgb, var(--note-color) 24%, transparent); border-radius: 10px; }

.spotlight-fade-enter-active,
.spotlight-fade-leave-active { transition: opacity 0.28s ease; }
.spotlight-fade-enter-active .spotlight-card,
.spotlight-fade-leave-active .spotlight-card { transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1), filter 0.28s ease; }
.spotlight-fade-enter-from,
.spotlight-fade-leave-to { opacity: 0; }
.spotlight-fade-enter-from .spotlight-card,
.spotlight-fade-leave-to .spotlight-card { transform: translateY(18px) scale(0.94); filter: blur(6px); }

/* 图片灯箱 */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  align-items: center;
  justify-items: center;
  gap: 0.8rem;
  overflow: hidden;
  padding: 1.2rem clamp(4.5rem, 8vw, 7rem) 1rem;
  background: rgba(3, 9, 22, 0.88);
  isolation: isolate;
}

.lightbox-ambient {
  position: absolute;
  inset: -12%;
  z-index: -3;
  background-position: center;
  background-size: cover;
  filter: blur(72px) saturate(1.25);
  opacity: 0.24;
  transform: scale(1.12);
  transition: background-image 0.45s ease, opacity 0.45s ease;
  animation: ambient-breathe 8s ease-in-out infinite alternate;
}

.lightbox::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -2;
  background:
    radial-gradient(circle at 50% 45%, transparent 0, rgba(2, 8, 20, 0.2) 48%, rgba(2, 7, 18, 0.76) 100%),
    linear-gradient(180deg, rgba(4, 12, 28, 0.35), rgba(3, 9, 22, 0.72));
  backdrop-filter: blur(16px);
}

.lightbox-grain {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  opacity: 0.12;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E");
}

.lightbox-topbar {
  width: min(1120px, 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: #fff;
}

.lightbox-topbar > div {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.lightbox-topbar strong {
  overflow: hidden;
  color: rgba(255,255,255,.9);
  font-size: 0.76rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lightbox-counter {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: rgba(255,255,255,.66);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
}

.lightbox-counter i {
  width: 24px;
  height: 1px;
  background: rgba(255,255,255,.34);
}

.lightbox-close,
.lightbox-nav {
  display: grid;
  place-items: center;
  padding: 0;
  color: #fff;
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.2);
  border-radius: 50%;
  box-shadow: 0 12px 28px -18px rgba(0,0,0,.8);
  line-height: 0;
  backdrop-filter: blur(12px);
  transition: transform 0.25s cubic-bezier(.16,1,.3,1), background 0.25s ease, border-color 0.25s ease;
}

.lightbox-close {
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  font-size: 1.25rem;
}

.lightbox-close:hover { transform: rotate(8deg) scale(1.08); background: rgba(255,255,255,.16); }

.lightbox-nav {
  position: absolute;
  top: 50%;
  z-index: 3;
  width: 48px;
  height: 48px;
  transform: translateY(-50%);
}

.lightbox-close .el-icon { width: 17px; height: 17px; font-size: 17px; }
.lightbox-nav .el-icon { width: 22px; height: 22px; font-size: 22px; }
.lightbox-close .el-icon,
.lightbox-nav .el-icon { display: grid; place-items: center; margin: 0; }
.lightbox-nav.prev { left: clamp(0.8rem, 2.5vw, 2.2rem); }
.lightbox-nav.next { right: clamp(0.8rem, 2.5vw, 2.2rem); }
.lightbox-nav:hover { background: rgba(255,255,255,.18); border-color: rgba(255,255,255,.42); }
.lightbox-nav.prev:hover { transform: translate(-4px, -50%) scale(1.06); }
.lightbox-nav.next:hover { transform: translate(4px, -50%) scale(1.06); }

.lightbox-stage {
  position: relative;
  width: min(1120px, 100%);
  height: 100%;
  min-height: 220px;
  overflow: hidden;
  display: grid;
  place-items: center;
  border-radius: 18px;
  cursor: url('/cursor/ew-resize.cur'), grab;
  outline: none;
  perspective: 1200px;
  touch-action: pan-y;
  user-select: none;
}

.lightbox-stage::after {
  content: '';
  position: absolute;
  inset: auto 12% 1% 12%;
  height: 24px;
  z-index: -1;
  background: rgba(0,0,0,.46);
  border-radius: 50%;
  filter: blur(18px);
}

.lightbox-stage > img {
  position: absolute;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 13px;
  box-shadow: 0 32px 70px -30px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.08);
  transform-origin: center;
  transition: transform 0.5s cubic-bezier(.16,1,.3,1), filter 0.35s ease;
  user-select: none;
  -webkit-user-drag: none;
}

.lightbox-stage.single { cursor: url('/cursor/default.cur'), default; }
.lightbox-stage.dragging { cursor: url('/cursor/move.cur'), grabbing; }
.lightbox-stage.dragging > img {
  transform: translateX(var(--drag-x)) rotate(var(--drag-rotate)) scale(.985);
  transition: none;
}

.lightbox-footer {
  width: min(1120px, 100%);
  min-height: 46px;
  display: grid;
  grid-template-columns: minmax(120px, 1fr) auto minmax(120px, 1fr);
  align-items: center;
  gap: 1rem;
  color: rgba(255,255,255,.68);
}

.lightbox-footer p {
  overflow: hidden;
  margin: 0;
  font-size: 0.68rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lightbox-footer small {
  justify-self: end;
  color: rgba(255,255,255,.38);
  font-size: 0.55rem;
  white-space: nowrap;
}

.lightbox-thumbs {
  max-width: min(52vw, 570px);
  display: flex;
  justify-content: center;
  gap: 0.38rem;
  overflow-x: auto;
  padding: 0.28rem;
  scrollbar-width: none;
}

.lightbox-thumbs::-webkit-scrollbar { display: none; }

.lightbox-thumbs button {
  flex: 0 0 auto;
  width: 42px;
  height: 42px;
  overflow: hidden;
  padding: 2px;
  background: rgba(255,255,255,.08);
  border: 1px solid transparent;
  border-radius: 9px;
  opacity: 0.48;
  transform: scale(.9);
  transition: 0.28s cubic-bezier(.16,1,.3,1);
}

.lightbox-thumbs button:hover { opacity: .82; transform: scale(.98); }
.lightbox-thumbs button.active {
  border-color: rgba(255,255,255,.82);
  opacity: 1;
  transform: translateY(-2px) scale(1);
  box-shadow: 0 8px 20px -10px rgba(0,0,0,.75);
}

.lightbox-thumbs img { width: 100%; height: 100%; display: block; object-fit: cover; border-radius: 6px; }

.lightbox-slide-next-enter-active,
.lightbox-slide-next-leave-active,
.lightbox-slide-prev-enter-active,
.lightbox-slide-prev-leave-active {
  transition: opacity .38s ease, transform .48s cubic-bezier(.16,1,.3,1), filter .38s ease;
}
.lightbox-slide-next-enter-from { opacity: 0; filter: blur(8px); transform: translateX(70px) rotateY(-4deg) scale(.96); }
.lightbox-slide-next-leave-to { opacity: 0; filter: blur(8px); transform: translateX(-70px) rotateY(4deg) scale(.96); }
.lightbox-slide-prev-enter-from { opacity: 0; filter: blur(8px); transform: translateX(-70px) rotateY(4deg) scale(.96); }
.lightbox-slide-prev-leave-to { opacity: 0; filter: blur(8px); transform: translateX(70px) rotateY(-4deg) scale(.96); }

.lightbox-fade-enter-active,
.lightbox-fade-leave-active { transition: opacity 0.32s ease; }
.lightbox-fade-enter-active .lightbox-stage,
.lightbox-fade-leave-active .lightbox-stage,
.lightbox-fade-enter-active .lightbox-topbar,
.lightbox-fade-leave-active .lightbox-topbar,
.lightbox-fade-enter-active .lightbox-footer,
.lightbox-fade-leave-active .lightbox-footer { transition: transform .48s cubic-bezier(.16,1,.3,1), opacity .28s ease, filter .35s ease; }
.lightbox-fade-enter-from,
.lightbox-fade-leave-to { opacity: 0; }
.lightbox-fade-enter-from .lightbox-stage,
.lightbox-fade-leave-to .lightbox-stage { opacity: 0; filter: blur(10px); transform: translateY(18px) scale(.96); }
.lightbox-fade-enter-from .lightbox-topbar,
.lightbox-fade-enter-from .lightbox-footer { opacity: 0; transform: translateY(8px); }

@keyframes ambient-breathe {
  from { opacity: .19; transform: scale(1.1) translate3d(-1%, -1%, 0); }
  to { opacity: .3; transform: scale(1.17) translate3d(1%, 1%, 0); }
}

@keyframes note-rise {
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes note-scatter-rise {
  from {
    opacity: 0;
    transform: translate3d(var(--note-x), calc(var(--note-y) + 18px), 0) rotate(var(--note-rotate)) scale(.95);
  }
  to {
    opacity: 1;
    transform: translate3d(var(--note-x), var(--note-y), 0) rotate(var(--note-rotate)) scale(1);
  }
}

@keyframes note-loading { to { background-position: -220% 0; } }

@media (max-width: 720px) {
  .note-page { padding: 1rem; }
  .note-head { flex-direction: column; }
  .head-actions { width: 100%; }
  .head-actions .primary-btn,
  .head-actions .soft-btn { flex: 1; }
  .storage-tip { width: 100%; margin-left: 0; }
  .layout-board { grid-template-columns: 1fr; }
  .field-row { grid-template-columns: 1fr; }
  .image-editor-grid { grid-template-columns: 1fr; }
  .lightbox { padding: 0.85rem 3.6rem 0.7rem; }
  .lightbox-stage { min-height: 180px; border-radius: 12px; }
  .lightbox-footer { grid-template-columns: 1fr; justify-items: center; gap: 0.35rem; }
  .lightbox-footer p { max-width: 78vw; text-align: center; }
  .lightbox-footer small { display: none; }
  .lightbox-thumbs { max-width: 76vw; }
  .lightbox-nav.prev { left: 0.65rem; }
  .lightbox-nav.next { right: 0.65rem; }
  .drawer-foot > span { display: none; }
  .drawer-foot { justify-content: flex-end; }
  .card-actions { opacity: 1; transform: none; }
}

@media (max-width: 480px) {
  .note-shell { padding: 1rem; }
  .note-tools { display: grid; grid-template-columns: 1fr auto auto; }
  .search-field { grid-column: 1 / -1; min-width: 0; }
  .favorite-filter { justify-content: center; }
  .sort-menu { width: 100%; }
  .layout-switch { display: none; }
  .editor-types { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .editor-types button { padding-inline: 0.05rem; font-size: 0.56rem; }
  .note-drawer { width: 100vw; }
  .drawer-head,
  .drawer-body,
  .drawer-foot { padding-left: 1rem; padding-right: 1rem; }
  .appearance-row { align-items: flex-start; }
  .field-block.compact { width: 100%; }
  .spotlight-card { padding: 1.35rem; }
  .lightbox { padding-inline: 3rem; }
  .lightbox-topbar > div { gap: 0.5rem; }
  .lightbox-topbar strong { max-width: 45vw; }
  .lightbox-nav { width: 40px; height: 40px; }
  .lightbox-thumbs button { width: 36px; height: 36px; }
}

@media (prefers-reduced-motion: reduce) {
  .lightbox-ambient,
  .lightbox-stage > img,
  .lightbox-slide-next-enter-active,
  .lightbox-slide-next-leave-active,
  .lightbox-slide-prev-enter-active,
  .lightbox-slide-prev-leave-active {
    animation: none;
    transition-duration: 0.01ms;
  }
}
</style>
