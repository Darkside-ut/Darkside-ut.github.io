<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
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
const expanded = ref(new Set())
const draggingId = ref('')
const dragOverId = ref('')

function emptyForm(type = 'quote') {
  return {
    type,
    title: '',
    content: '',
    source: '',
    link: '',
    tagsText: '',
    color: COLORS[0],
    image: '',
    imageName: '',
    imageAlt: '',
    pinned: false,
    favorite: false,
  }
}

const form = reactive(emptyForm())

const typeMap = Object.fromEntries(NOTE_TYPES.map((type) => [type.value, type]))
const typeMeta = (type) => typeMap[type] || NOTE_TYPES[0]

const typeCounts = computed(() =>
  Object.fromEntries(NOTE_TYPES.map((type) => [type.value, notes.value.filter((note) => note.type === type.value).length]))
)

const filteredNotes = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  const list = notes.value.filter((note) => {
    if (activeType.value !== 'all' && note.type !== activeType.value) return false
    if (favoriteOnly.value && !note.favorite) return false
    if (!query) return true
    return [note.title, note.content, note.source, ...(note.tags || [])]
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
const canSave = computed(() => !!(form.title.trim() || form.content.trim() || form.image))

function openCreate(type = activeType.value === 'all' ? 'quote' : activeType.value) {
  editingId.value = ''
  Object.assign(form, emptyForm(type))
  editorOpen.value = true
}

function openEdit(note) {
  editingId.value = note.id
  Object.assign(form, {
    type: note.type,
    title: note.title,
    content: note.content,
    source: note.source,
    link: note.link || '',
    tagsText: (note.tags || []).join('，'),
    color: note.color,
    image: note.image,
    imageName: note.imageName || '',
    imageAlt: note.imageAlt || '',
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
    await saveNote({
      id: editingId.value || undefined,
      type: form.type,
      title: form.title,
      content: form.content,
      source: form.source,
      link: form.link,
      tags: parseTags(form.tagsText),
      color: form.color,
      image: form.image,
      imageName: form.imageName,
      imageAlt: form.imageAlt,
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
  const text = [note.title, note.content, note.source ? `—— ${note.source}` : ''].filter(Boolean).join('\n')
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

async function acceptImage(file) {
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    ElMessage.warning('支持 JPG、PNG、WebP 和 GIF 图片')
    return
  }
  if (file.size > 15 * 1024 * 1024) {
    ElMessage.warning('图片不能超过 15MB')
    return
  }

  imageBusy.value = true
  try {
    form.image = await optimizeImage(file)
    form.imageName = file.name
    if (!form.imageAlt) form.imageAlt = file.name.replace(/\.[^.]+$/, '')
  } catch (error) {
    ElMessage.error(`图片处理失败：${error?.message || error}`)
  } finally {
    imageBusy.value = false
  }
}

async function onImageFile(event) {
  await acceptImage(event.target.files?.[0])
  event.target.value = ''
}

async function onImageDrop(event) {
  imageDrag.value = false
  await acceptImage(event.dataTransfer?.files?.[0])
}

async function onPaste(event) {
  const item = [...(event.clipboardData?.items || [])].find((entry) => entry.type.startsWith('image/'))
  if (!item) return
  event.preventDefault()
  await acceptImage(item.getAsFile())
}

function removeImage() {
  form.image = ''
  form.imageName = ''
  form.imageAlt = ''
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
    version: 1,
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
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', note.id)
}

function onDragEnter(note) {
  if (canReorder.value && note.id !== draggingId.value) dragOverId.value = note.id
}

async function onCardDrop(event, target) {
  event.preventDefault()
  const sourceId = draggingId.value || event.dataTransfer.getData('text/plain')
  draggingId.value = ''
  dragOverId.value = ''
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
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    if (lightbox.value) lightbox.value = null
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

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
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
          :style="{ '--note-color': note.color, '--note-index': index % 12 }"
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

          <button v-if="note.image" type="button" class="note-image" @click="lightbox = note">
            <img :src="note.image" :alt="note.imageAlt || note.title || '便条图片'" />
            <span><el-icon><Picture /></el-icon> 查看原图</span>
          </button>

          <h3 v-if="note.title">{{ note.title }}</h3>
          <button
            v-if="note.content"
            type="button"
            class="note-content"
            :class="{ expanded: expanded.has(note.id) }"
            @click="toggleExpanded(note.id)"
          >
            {{ note.content }}
          </button>

          <div v-if="note.source || safeLink(note.link)" class="note-source">
            <span v-if="note.source">—— {{ note.source }}</span>
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
                    @click="form.type = type.value"
                  >
                    <span>{{ type.emoji }}</span>
                    {{ type.label }}
                  </button>
                </div>
                <small>{{ formMeta.hint }}</small>
              </div>

              <label class="field-block">
                <span class="field-label">标题 <small>可选</small></span>
                <input v-model="form.title" maxlength="80" placeholder="给这张便条起个名字" />
              </label>

              <label class="field-block">
                <span class="field-label">正文</span>
                <textarea
                  v-model="form.content"
                  rows="8"
                  maxlength="5000"
                  :placeholder="formMeta.hint"
                ></textarea>
                <span class="char-count">{{ form.content.length }} / 5000</span>
              </label>

              <div class="field-row">
                <label class="field-block">
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
                <span class="field-label">图片 <small>可拖入、粘贴或选择文件</small></span>
                <div
                  class="image-drop"
                  :class="{ over: imageDrag, filled: form.image }"
                  @dragenter.prevent="imageDrag = true"
                  @dragover.prevent
                  @dragleave.prevent="imageDrag = false"
                  @drop.prevent="onImageDrop"
                >
                  <template v-if="form.image">
                    <img :src="form.image" :alt="form.imageAlt || '图片预览'" />
                    <div class="image-overlay">
                      <button type="button" @click="imageInput?.click()">更换图片</button>
                      <button type="button" class="danger" @click="removeImage">移除</button>
                    </div>
                  </template>
                  <button v-else type="button" class="image-empty" :disabled="imageBusy" @click="imageInput?.click()">
                    <el-icon><Picture /></el-icon>
                    <strong>{{ imageBusy ? '正在处理图片…' : '放入一张喜欢的画面' }}</strong>
                    <span>JPG / PNG / WebP / GIF，最大 15MB</span>
                  </button>
                </div>
                <input ref="imageInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden @change="onImageFile" />
              </div>

              <label v-if="form.image" class="field-block">
                <span class="field-label">图片说明</span>
                <input v-model="form.imageAlt" maxlength="120" placeholder="描述这张图，方便以后回忆" />
              </label>

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
            <img
              v-if="randomNote.image"
              :src="randomNote.image"
              :alt="randomNote.imageAlt || randomNote.title || '便条图片'"
              @click="lightbox = randomNote"
            />
            <h2 v-if="randomNote.title">{{ randomNote.title }}</h2>
            <p v-if="randomNote.content">{{ randomNote.content }}</p>
            <cite v-if="randomNote.source">—— {{ randomNote.source }}</cite>
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
        <div v-if="lightbox" class="lightbox" @click="lightbox = null">
          <button aria-label="关闭图片">×</button>
          <img :src="lightbox.image" :alt="lightbox.imageAlt || lightbox.title || '便条图片'" />
          <span>{{ lightbox.imageAlt || lightbox.title || lightbox.imageName }}</span>
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
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease, box-shadow 0.3s ease, opacity 0.25s ease;
  animation: note-rise 0.45s calc(var(--note-index) * 35ms) cubic-bezier(0.16, 1, 0.3, 1) both;
}

.note-card:hover {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--note-color) 46%, transparent);
  box-shadow: 0 18px 34px -25px color-mix(in srgb, var(--note-color) 72%, #1e3a5f);
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

.reorderable .note-card { cursor: grab; }
.reorderable .note-card:active { cursor: grabbing; }

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

.note-image {
  position: relative;
  width: 100%;
  max-height: 270px;
  display: block;
  overflow: hidden;
  margin: 0.7rem 0 0.75rem;
  padding: 0;
  background: #dce7f5;
  border: none;
  border-radius: 13px;
}

.note-image img {
  width: 100%;
  max-height: 270px;
  display: block;
  object-fit: cover;
  transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}

.note-image span {
  position: absolute;
  right: 0.55rem;
  bottom: 0.5rem;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0.22rem 0.45rem;
  color: #fff;
  background: rgba(15, 23, 42, 0.58);
  border-radius: 8px;
  font-size: 0.58rem;
  opacity: 0;
  transform: translateY(5px);
  transition: 0.25s ease;
}

.note-image:hover img { transform: scale(1.035); }
.note-image:hover span { opacity: 1; transform: translateY(0); }

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

.image-drop {
  min-height: 145px;
  display: grid;
  place-items: center;
  overflow: hidden;
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

.image-drop.filled { position: relative; border-style: solid; }
.image-drop > img { width: 100%; max-height: 270px; object-fit: contain; }

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

.image-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: rgba(15, 23, 42, 0.48);
  opacity: 0;
  transition: opacity 0.22s ease;
}

.image-drop:hover .image-overlay { opacity: 1; }
.image-overlay button {
  padding: 0.4rem 0.65rem;
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  font-size: 0.68rem;
}
.image-overlay button.danger { background: rgba(220, 76, 76, 0.5); }

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
.spotlight-card img { width: 100%; max-height: 420px; object-fit: contain; margin: 1rem 0; border-radius: 15px; cursor: zoom-in; }
.spotlight-card h2 { margin: 1rem 0 0.6rem; font-size: 1.35rem; }
.spotlight-card p { white-space: pre-wrap; font-size: 0.9rem; line-height: 1.9; }
.spotlight-card cite { display: block; margin-top: 0.8rem; text-align: right; color: var(--text-dim); font-size: 0.74rem; font-style: normal; }
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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  padding: 2rem;
  background: rgba(4, 12, 27, 0.9);
  backdrop-filter: blur(8px);
  cursor: zoom-out;
}
.lightbox img { max-width: 94vw; max-height: 84vh; object-fit: contain; border-radius: 10px; box-shadow: 0 25px 60px rgba(0,0,0,.45); }
.lightbox span { color: rgba(255,255,255,.72); font-size: 0.7rem; }
.lightbox button { position: absolute; top: 1.2rem; right: 1.5rem; width: 38px; height: 38px; color: #fff; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.25); border-radius: 50%; font-size: 1.3rem; }
.lightbox-fade-enter-active,
.lightbox-fade-leave-active { transition: opacity 0.25s ease; }
.lightbox-fade-enter-from,
.lightbox-fade-leave-to { opacity: 0; }

@keyframes note-rise {
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
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
}
</style>
