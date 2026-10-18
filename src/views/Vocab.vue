<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Delete, Upload, RefreshRight } from '@element-plus/icons-vue'
import RootsView from './vocab/RootsView.vue'
import SelectMenu from '../components/SelectMenu.vue'
import { unzip as unzipAsyncCb, strFromU8 } from 'fflate'
import {
  ready,
  libraries,
  activeLibId,
  words,
  settings,
  session,
  currentItem,
  todayStat,
  mastery,
  streak,
  upcomingReview,
  initVocab,
  loadLibrary,
  importLibrary,
  deleteLibrary,
  saveSettings,
  buildSession,
  gradeCurrent,
  parseWordFile,
  customSession,
  startCustomSession,
  clearCustomSession,
  wordStatus,
  exportLearningData,
} from '../composables/useVocab.js'

const mode = ref('books') // 'books' 词书学习 | 'roots' 词根词缀
const view = ref('library') // 'library' 词书选择 | 'study' 学习
const flipped = ref(false)
const showImport = ref(false)
const fileInput = ref(null)
const parsed = ref(null)
const parseError = ref('')
const importName = ref('')
const importing = ref(false)
const parsing = ref(false)
const progress = ref(0)
const progressLabel = ref('')
const showSettings = ref(false)
const studyTab = ref('learn') // learn | list | stats
const wordKeyword = ref('')
const wordFilter = ref('all')
const selectedKeys = ref(new Set())
const visibleCount = ref(100)
const dragOver = ref(false)

const statusLabel = {
  new: '未学',
  learning: '学习中',
  familiar: '熟悉',
  mastered: '已掌握',
}

const filterOptions = [
  { value: 'all', label: '全部' },
  { value: 'new', label: '未学' },
  { value: 'learning', label: '学习中' },
  { value: 'familiar', label: '熟悉' },
  { value: 'mastered', label: '已掌握' },
]

const phoneticOptions = [
  { value: 'uk', label: '英式音标' },
  { value: 'us', label: '美式音标' },
]
let dragDepth = 0
let creepTimer = null

// 解压阶段拿不到真实进度，用缓慢爬升的假进度兜底
function startCreep(from, to) {
  stopCreep()
  let v = from
  progress.value = Math.round(v)
  creepTimer = setInterval(() => {
    v = Math.min(to, v + Math.max(0.4, (to - v) * 0.06))
    progress.value = Math.round(v)
  }, 180)
}

function stopCreep() {
  if (creepTimer) {
    clearInterval(creepTimer)
    creepTimer = null
  }
}

// FileReader 读取，带真实读取进度（映射到 0–10%）
function readFileWithProgress(file, as) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onprogress = (e) => {
      if (e.lengthComputable) progress.value = Math.round((e.loaded / e.total) * 10)
    }
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error || new Error('读取失败'))
    if (as === 'text') r.readAsText(file)
    else r.readAsArrayBuffer(file)
  })
}

// fflate 的异步 unzip：分片计算，不长时间阻塞主线程
function unzipAsync(buf) {
  return new Promise((resolve, reject) => {
    unzipAsyncCb(buf, (err, files) => (err ? reject(err) : resolve(files)))
  })
}

const grades = [
  { g: 0, label: '忘记', key: '1', cls: 'again' },
  { g: 1, label: '模糊', key: '2', cls: 'hard' },
  { g: 2, label: '认识', key: '3', cls: 'good' },
  { g: 3, label: '熟练', key: '4', cls: 'easy' },
]

const card = computed(() => currentItem.value?.w || null)

const phoneticText = computed(() => {
  if (!card.value) return ''
  const { uk, us } = card.value
  return formatPhonetic(settings.value.phonetic === 'us' ? us || uk : uk || us)
})

const todayProgress = computed(() => {
  const t = todayStat.value
  return {
    newDone: t.new,
    newTotal: settings.value.dailyNew,
    reviewDone: t.review,
    reviewTotal: settings.value.dailyReview,
    accuracy: t.total ? Math.round((t.correct / t.total) * 100) : 0,
  }
})

const masteryPercent = computed(() => {
  const m = mastery.value
  if (!m.total) return { fresh: 0, learning: 0, familiar: 0, mastered: 0 }
  const p = (n) => (n / m.total) * 100
  return {
    fresh: p(m.fresh),
    learning: p(m.learning),
    familiar: p(m.familiar),
    mastered: p(m.mastered),
  }
})

const activeLibName = computed(
  () => libraries.value.find((l) => l.id === activeLibId.value)?.name || ''
)

/* ---------- 单词表 ---------- */
const filteredWords = computed(() => {
  const kw = wordKeyword.value.trim().toLowerCase()
  return words.value.filter((w) => {
    if (wordFilter.value !== 'all' && wordStatus(w) !== wordFilter.value) return false
    if (!kw) return true
    return (
      w.word.toLowerCase().includes(kw) ||
      (w.meaning || '').toLowerCase().includes(kw)
    )
  })
})

const visibleWords = computed(() => filteredWords.value.slice(0, visibleCount.value))

watch([wordKeyword, wordFilter], () => {
  visibleCount.value = 100
})

function toggleSelect(id) {
  const s = new Set(selectedKeys.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selectedKeys.value = s
}

function selectAllFiltered() {
  const s = new Set(selectedKeys.value)
  for (const w of filteredWords.value) s.add(w.id)
  selectedKeys.value = s
}

function clearSelection() {
  selectedKeys.value = new Set()
}

function startSelected() {
  const set = selectedKeys.value
  const list = words.value.filter((w) => set.has(w.id))
  if (!list.length) return
  startCustomSession(list)
  selectedKeys.value = new Set()
  studyTab.value = 'learn'
  flipped.value = false
}

// 换卡后自动翻回正面
watch(
  () => currentItem.value?.w?.id,
  () => {
    flipped.value = false
    if (settings.value.autoSpeak && card.value) speak(card.value.word)
  }
)

function speak(text) {
  if (!text || !window.speechSynthesis) return
  const synth = window.speechSynthesis
  // 只在真的在播时报停，避免每次取消造成额外延迟
  if (synth.speaking || synth.pending) synth.cancel()

  const u = new SpeechSynthesisUtterance(text)
  const lang = settings.value.phonetic === 'us' ? 'en-US' : 'en-GB'
  u.lang = lang
  const voices = synth.getVoices()
  const match =
    voices.find((v) => v.lang === lang) ||
    voices.find((v) => (v.lang || '').toLowerCase().startsWith('en'))
  if (match) u.voice = match
  u.rate = 1
  synth.speak(u)
}

// 在组件挂载时就加载语音列表并预热引擎，避免第一次朗读时卡顿
function warmUpSpeech() {
  const synth = window.speechSynthesis
  if (!synth) return
  synth.getVoices()
  synth.onvoiceschanged = () => synth.getVoices()
  try {
    const warm = new SpeechSynthesisUtterance(' ')
    warm.volume = 0
    synth.speak(warm)
  } catch {
    // 忽略不支持的环境
  }
}

function pick(g) {
  if (!flipped.value) return
  gradeCurrent(g)
}

function onKey(e) {
  if (mode.value !== 'books' || !card.value || showImport.value) return
  const tag = (e.target?.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return
  if (e.code === 'Space') {
    e.preventDefault()
    if (card.value) flipped.value = !flipped.value
  } else if (['1', '2', '3', '4'].includes(e.key)) {
    const g = grades.find((x) => x.key === e.key)
    if (g) pick(g.g)
  }
}

function onLibChange() {
  loadLibrary(activeLibId.value)
}

async function openLibrary(id) {
  await loadLibrary(id)
  studyTab.value = 'learn'
  selectedKeys.value = new Set()
  wordKeyword.value = ''
  wordFilter.value = 'all'
  view.value = 'study'
}

function createdText(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// 音标修正：数据里用 ' 表示重音、: 表示长音，且没有斜杠
function formatPhonetic(raw) {
  if (!raw) return ''
  let s = String(raw).trim().replace(/^\/|\/$/g, '')
  if (!s) return ''
  s = s.replace(/'/g, 'ˈ').replace(/,/g, 'ˌ')
  s = s.replace(/([aeiouɑɔəɛɪʊʌæɜɒɐy])[:]/gi, '$1ː')
  return `/${s}/`
}

async function openImport() {
  showImport.value = true
  parsed.value = null
  parseError.value = ''
  importName.value = ''
  await nextTick()
  fileInput.value?.click()
}

function closeImport() {
  showImport.value = false
  parsed.value = null
  parseError.value = ''
}

async function onFile(e) {
  const f = e.target.files?.[0]
  if (f) await processFile(f)
  e.target.value = ''
}

// 统一处理普通词库文件与 zip 压缩包
async function processFile(f) {
  mode.value = 'books'
  parseError.value = ''
  parsed.value = null
  showImport.value = true
  parsing.value = true
  progress.value = 0
  progressLabel.value = '读取文件中…'
  await nextTick()
  const isZip = /\.zip$/i.test(f.name)
  try {
    let text
    let name = f.name

    if (isZip) {
      const buf = await readFileWithProgress(f, 'buffer')
      progressLabel.value = '解压中…'
      startCreep(12, 50)
      const files = await unzipAsync(new Uint8Array(buf))
      stopCreep()
      progress.value = 50
      const candidates = Object.entries(files)
        .filter(
          ([n, data]) =>
            !n.includes('__MACOSX') &&
            data.length > 0 &&
            /\.(json|jsonl|txt|csv)$/i.test(n)
        )
        .sort((a, b) => b[1].length - a[1].length)
      if (!candidates.length) throw new Error('压缩包里没有找到词库文件（.json / .txt / .csv）')
      const [entryName, data] = candidates[0]
      progressLabel.value = '解压文件…'
      text = strFromU8(data)
      name = entryName.split('/').pop()
      progress.value = 55
    } else {
      text = await readFileWithProgress(f, 'text')
      progress.value = 10
    }

    progressLabel.value = '解析单词中…'
    await nextTick()
    const base = isZip ? 55 : 10
    const res = await parseWordFile(text, name, (ratio) => {
      progress.value = Math.round(base + ratio * (95 - base))
    })
    progress.value = 95

    if (!res.list.length) {
      parseError.value = '没有解析到单词，请检查文件格式（支持 kajweb/dict 的 JSONL、CSV、TXT）'
      return
    }
    parsed.value = res
    importName.value = res.name
  } catch (err) {
    parseError.value = `解析失败：${err.message}`
  } finally {
    stopCreep()
    parsing.value = false
  }
}

/* ---------- 拖拽导入 ---------- */
function onDragEnter(e) {
  if (!e.dataTransfer?.types?.includes('Files')) return
  dragDepth++
  dragOver.value = true
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragOver.value = false
}

async function onDrop(e) {
  dragDepth = 0
  dragOver.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) await processFile(f)
}

async function doImport() {
  if (!parsed.value || importing.value) return
  importing.value = true
  parseError.value = ''
  progressLabel.value = '写入词库中…'
  progress.value = 96
  startCreep(96, 99)
  try {
    await importLibrary(importName.value.trim() || parsed.value.name, parsed.value.list)
    stopCreep()
    progress.value = 100
    await new Promise((r) => setTimeout(r, 320))
    closeImport()
  } catch (err) {
    parseError.value = `导入失败：${err.message}`
  } finally {
    stopCreep()
    importing.value = false
  }
}

async function removeLib() {
  const lib = libraries.value.find((l) => l.id === activeLibId.value)
  if (!lib) return
  if (!confirm(`删除词库「${lib.name}」？学习进度会一起删除。`)) return
  await deleteLibrary(lib.id)
  view.value = 'library'
}

async function changeSetting(key, value) {
  await saveSettings({ [key]: value })
  // 只有每日上限会改变队列；音标/自动发音不影响当前进度
  if (key === 'dailyNew' || key === 'dailyReview') buildSession()
}

/* ---------------- 学习数据导出 ---------------- */
function doExportLearning() {
  exportLearningData()
}

onMounted(() => {
  initVocab()
  warmUpSpeech()
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  stopCreep()
})
</script>

<template>
  <div class="page">
    <div
      class="page-card vocab-card"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <!-- 拖拽提示 -->
      <div v-if="dragOver" class="drop-overlay">
        <div class="drop-icon">📥</div>
        <p>松开鼠标导入词库</p>
        <span>支持 .zip / .json / .csv / .txt</span>
      </div>

      <h2 class="page-title">背单词</h2>
      <div class="section-sub">本地词库 · 间隔重复 · 数据只保存在本机</div>

      <!-- 模式切换 -->
      <div class="mode-tabs">
        <button
          class="mode-tab"
          :class="{ active: mode === 'books' }"
          @click="mode = 'books'"
        >
          词书
        </button>
        <button
          class="mode-tab"
          :class="{ active: mode === 'roots' }"
          @click="mode = 'roots'"
        >
          词根词缀
        </button>
      </div>

      <div v-if="!ready" class="loading">词库加载中…</div>

      <template v-else-if="mode === 'books'">
        <!-- ====== 词书选择 ====== -->
        <div v-if="view === 'library'" class="library-view">
          <div class="lib-head">
            <div>
              <div class="lib-head-title">我的词书</div>
              <div class="lib-head-sub">选择一本开始学习</div>
            </div>
            <button class="ghost-btn" @click="openImport">
              <el-icon><Upload /></el-icon>
              导入
            </button>
          </div>

          <div v-if="!libraries.length" class="empty-mini">
            还没有本地词书，导入一本，或选择下方的公开词书
          </div>

          <div class="lib-grid">
            <button
              v-for="l in libraries"
              :key="l.id"
              class="lib-card"
              @click="openLibrary(l.id)"
            >
              <div class="lib-cover">{{ l.name.slice(0, 1) }}</div>
              <div class="lib-info">
                <div class="lib-name">{{ l.name }}</div>
                <div class="lib-meta">{{ l.count }} 词 · {{ createdText(l.createdAt) }}</div>
              </div>
            </button>

            <button class="lib-card add-card" @click="openImport">
              <span class="add-icon">＋</span>
              <span class="add-text">导入词书</span>
            </button>
          </div>

        </div>

        <!-- ====== 学习 ====== -->
        <div v-else class="study-view">
          <div class="study-top">
            <button class="back-btn" @click="view = 'library'">← 词书</button>
            <div class="study-lib-name">{{ activeLibName }}</div>
            <button class="ghost-btn danger" @click="removeLib" title="删除当前词库">
              <el-icon><Delete /></el-icon>
            </button>
          </div>

          <!-- 学习 / 单词表 / 进度 -->
          <div class="study-tabs">
            <button
              class="study-tab"
              :class="{ active: studyTab === 'learn' }"
              @click="studyTab = 'learn'"
            >
              学习
            </button>
            <button
              class="study-tab"
              :class="{ active: studyTab === 'list' }"
              @click="studyTab = 'list'"
            >
              单词表
            </button>
            <button
              class="study-tab"
              :class="{ active: studyTab === 'stats' }"
              @click="studyTab = 'stats'"
            >
              进度
            </button>
          </div>

          <!-- ===== 学习 ===== -->
          <template v-if="studyTab === 'learn'">
            <div v-if="customSession" class="task-banner">
              <span>自定义任务 · {{ session.queue.length }} 个单词</span>
              <button class="ghost-btn" @click="clearCustomSession">恢复自动队列</button>
            </div>

        <!-- ===== 学习区 ===== -->
        <div v-if="!session.finished && card" class="study">
          <div class="card-wrap">
            <div class="flashcard" :class="{ flipped }" @click="flipped = !flipped">
              <!-- 正面 -->
              <div class="face front">
                <span class="card-index">{{ session.index + 1 }} / {{ session.queue.length }}</span>
                <div class="word">{{ card.word }}</div>
                <div class="phonetic">
                  <!-- 左侧占位与按钮等宽，让音标相对单词真正居中 -->
                  <span class="speak-spacer" aria-hidden="true"></span>
                  <span v-if="phoneticText" class="phonetic-text">{{ phoneticText }}</span>
                  <button class="speak-btn" @click.stop="speak(card.word)" title="发音">🔊</button>
                </div>
                <span class="flip-hint">点击或按空格翻面</span>
              </div>

              <!-- 背面 -->
              <div class="face back">
                <span class="card-index">释义</span>
                <div class="meaning">{{ card.meaning || '（暂无释义）' }}</div>

                <div v-if="card.example" class="example">
                  <p class="ex-en">{{ card.example }}</p>
                  <p v-if="card.exampleCn" class="ex-cn">{{ card.exampleCn }}</p>
                </div>

                <div v-if="card.phrases?.length" class="phrases">
                  <div v-for="(p, i) in card.phrases" :key="i" class="phrase">
                    <span class="ph-en">{{ p.en }}</span>
                    <span v-if="p.cn" class="ph-cn">{{ p.cn }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="grades">
            <button
              v-for="g in grades"
              :key="g.g"
              class="grade"
              :class="[g.cls, { dim: !flipped }]"
              :disabled="!flipped"
              @click="pick(g.g)"
            >
              <span class="grade-label">{{ g.label }}</span>
              <span class="grade-key">{{ g.key }}</span>
            </button>
          </div>
          <p class="hint">空格翻面 · 1 忘记 · 2 模糊 · 3 认识 · 4 熟练</p>
        </div>

        <!-- ===== 今日完成 ===== -->
        <div v-else class="done-state">
          <div class="done-icon">🎉</div>
          <h3>{{ session.queue.length ? '这一组完成' : '今天没有待学单词' }}</h3>
          <p>
            今日已学 {{ todayStat.new + todayStat.review }} 个
            <template v-if="todayStat.total">· 正确率 {{ todayProgress.accuracy }}%</template>
          </p>
          <div class="done-actions">
            <button class="primary-btn" @click="buildSession">
              <el-icon><RefreshRight /></el-icon>
              检查新队列
            </button>
          </div>
          <p v-if="upcomingReview" class="done-hint">有 {{ upcomingReview }} 个单词已到复习时间</p>
        </div>

          </template>

          <!-- ===== 单词表 ===== -->
          <div v-else-if="studyTab === 'list'" class="word-list-view">
            <div class="list-toolbar">
              <input v-model="wordKeyword" class="list-search" placeholder="搜索单词 / 释义" />
              <SelectMenu
                v-model="wordFilter"
                :options="filterOptions"
                class="list-filter-menu"
              />
            </div>

            <div class="list-actions">
              <button class="ghost-btn" @click="selectAllFiltered">
                全选当前（{{ filteredWords.length }}）
              </button>
              <button class="ghost-btn" @click="clearSelection">清空选择</button>
              <button
                class="primary-btn"
                :disabled="!selectedKeys.size"
                @click="startSelected"
              >
                开始学习所选（{{ selectedKeys.size }}）
              </button>
            </div>

            <div class="word-rows">
              <label
                v-for="w in visibleWords"
                :key="w.id"
                class="word-row"
                :class="{ selected: selectedKeys.has(w.id) }"
              >
                <input
                  type="checkbox"
                  :checked="selectedKeys.has(w.id)"
                  @change="toggleSelect(w.id)"
                />
                <span class="w-word">{{ w.word }}</span>
                <span class="w-phon">
                  {{ formatPhonetic(settings.phonetic === 'us' ? w.us || w.uk : w.uk || w.us) }}
                </span>
                <span class="w-mean">{{ w.meaning || '—' }}</span>
                <span class="w-status" :class="wordStatus(w)">
                  {{ statusLabel[wordStatus(w)] }}
                </span>
              </label>
            </div>

            <p v-if="!filteredWords.length" class="empty-mini">没有匹配的单词</p>

            <button
              v-if="visibleCount < filteredWords.length"
              class="ghost-btn more-btn"
              @click="visibleCount += 200"
            >
              加载更多（剩余 {{ filteredWords.length - visibleCount }}）
            </button>

            <p class="list-hint">
              勾选单词后点「开始学习所选」，可跳过每日计划，只学选中的词。
            </p>
          </div>

          <!-- ===== 进度 ===== -->
          <div v-else class="stats-view">
            <!-- 今日进度 -->
            <div class="today-row">
              <div class="today-item">
                <span class="today-label">今日新词</span>
                <span class="today-num">{{ todayProgress.newDone }}</span>
              </div>
              <div class="today-item">
                <span class="today-label">今日复习</span>
                <span class="today-num">{{ todayProgress.reviewDone }}</span>
              </div>
              <div class="today-item">
                <span class="today-label">正确率</span>
                <span class="today-num">{{ todayProgress.accuracy }}%</span>
              </div>
              <div class="today-item">
                <span class="today-label">连续</span>
                <span class="today-num">{{ streak }} 天</span>
              </div>
            </div>

        <!-- ===== 掌握度 ===== -->
        <div class="mastery">
          <div class="mastery-head">
            <span>掌握度</span>
            <span class="mastery-total">{{ mastery.total }} 词</span>
          </div>
          <div class="mastery-bar">
            <span class="seg fresh" :style="{ width: masteryPercent.fresh + '%' }"></span>
            <span class="seg learning" :style="{ width: masteryPercent.learning + '%' }"></span>
            <span class="seg familiar" :style="{ width: masteryPercent.familiar + '%' }"></span>
            <span class="seg mastered" :style="{ width: masteryPercent.mastered + '%' }"></span>
          </div>
          <div class="mastery-legend">
            <span><i class="dot fresh"></i>新词 {{ mastery.fresh }}</span>
            <span><i class="dot learning"></i>学习中 {{ mastery.learning }}</span>
            <span><i class="dot familiar"></i>熟悉 {{ mastery.familiar }}</span>
            <span><i class="dot mastered"></i>已掌握 {{ mastery.mastered }}</span>
          </div>
        </div>

        <!-- ===== 设置 ===== -->
        <div class="settings">
          <button class="settings-toggle" @click="showSettings = !showSettings">
            设置 {{ showSettings ? '▴' : '▾' }}
          </button>
          <div v-if="showSettings" class="settings-body">
            <label class="set-item">
              音标
              <SelectMenu
                :model-value="settings.phonetic"
                :options="phoneticOptions"
                class="phonetic-menu"
                @change="changeSetting('phonetic', $event)"
              />
            </label>
            <label class="set-item checkbox">
              <input
                type="checkbox"
                :checked="settings.autoSpeak"
                @change="changeSetting('autoSpeak', $event.target.checked)"
              />
              自动发音
            </label>
          </div>
          </div>

          <div class="export-row">
            <button class="ghost-btn" @click="doExportLearning">导出学习数据</button>
          </div>
          </div>
        </div>
      </template>

      <!-- ===== 词根词缀 ===== -->
      <RootsView v-else />

      <!-- ===== 导入面板 ===== -->
      <div v-if="showImport" class="import-panel">
        <div class="import-head">
          <strong>导入词库</strong>
          <button class="x" @click="closeImport">×</button>
        </div>
        <p class="import-desc">
          直接选择 kajweb/dict 的词书 <code>.zip</code>，或解压后的 <code>.json</code>（JSONL，每行一个单词），
          或 CSV / TXT：每行 <code>单词,音标,释义,例句</code>
        </p>
        <input
          ref="fileInput"
          type="file"
          accept=".zip,.json,.txt,.csv,application/zip,application/json,text/plain"
          class="file-input"
          @change="onFile"
        />
        <div v-if="parsing || importing" class="import-progress">
          <div class="ip-head">
            <span>{{ progressLabel }}</span>
            <span class="ip-pct">{{ progress }}%</span>
          </div>
          <div class="ip-track">
            <div class="ip-fill" :style="{ width: progress + '%' }"></div>
          </div>
        </div>
        <div v-if="parseError" class="parse-error">{{ parseError }}</div>

        <div v-if="parsed" class="preview">
          <div class="preview-count">解析到 <strong>{{ parsed.list.length }}</strong> 个单词</div>
          <div class="preview-list">
            <div v-for="w in parsed.list.slice(0, 3)" :key="w.id" class="preview-item">
              <span class="pv-word">{{ w.word }}</span>
              <span class="pv-mean">{{ w.meaning || '（无释义）' }}</span>
            </div>
          </div>
          <label class="name-row">
            词库名称
            <input v-model="importName" class="name-input" maxlength="30" />
          </label>
          <button class="primary-btn full" :disabled="importing" @click="doImport">
            {{ importing ? '导入中…' : `导入 ${parsed.list.length} 个单词` }}
          </button>
        </div>

        <p class="import-tip">词库与学习进度都保存在本机浏览器，清理站点数据会丢失。</p>
      </div>

    </div>
  </div>
</template>

<style scoped>
.vocab-card {
  max-width: 760px;
  position: relative;
}

/* ===== 模式切换 ===== */
.mode-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 1.2rem;
  border-radius: 12px;
  background: rgba(219, 234, 254, 0.55);
  border: 1px solid rgba(37, 99, 235, 0.14);
}

.mode-tab {
  padding: 0.4rem 1.05rem;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-dim);
  background: transparent;
  border: none;
  border-radius: 9px;
  transition: 0.2s;
}

.mode-tab.active {
  color: #fff;
  background: linear-gradient(135deg, #1d4ed8, #2563eb);
  box-shadow: 0 4px 12px -4px rgba(37, 99, 235, 0.5);
}

/* ===== 学习页标签 ===== */
.study-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 0.9rem;
  border-radius: 12px;
  background: rgba(219, 234, 254, 0.55);
  border: 1px solid rgba(37, 99, 235, 0.14);
}

.study-tab {
  flex: 1;
  padding: 0.4rem 0.3rem;
  font-family: inherit;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--text-dim);
  background: transparent;
  border: none;
  border-radius: 9px;
  transition: 0.2s;
}

.study-tab.active {
  color: #fff;
  background: linear-gradient(135deg, #1d4ed8, #2563eb);
  box-shadow: 0 4px 12px -4px rgba(37, 99, 235, 0.5);
}

/* 自定义任务提示条 */
.task-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.5rem 0.8rem;
  margin-bottom: 0.8rem;
  border-radius: 10px;
  font-size: 0.74rem;
  color: #8a5a1a;
  background: rgba(232, 162, 60, 0.12);
  border: 1px solid rgba(232, 162, 60, 0.32);
}

/* ===== 单词表 ===== */
.list-toolbar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}

.list-search {
  flex: 1;
  min-width: 0;
  padding: 0.45rem 0.7rem;
  font-family: inherit;
  font-size: 0.78rem;
  color: var(--text-dark);
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(37, 99, 235, 0.18);
  border-radius: 10px;
  outline: none;
}

.list-search:focus {
  border-color: var(--accent);
}

.list-filter-menu {
  flex-shrink: 0;
  width: 108px;
}

.list-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.7rem;
}

.word-rows {
  max-height: 430px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-right: 2px;
}

.word-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.6rem;
  font-size: 0.76rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid transparent;
  transition: 0.15s;
  cursor: pointer;
}

.word-row:hover {
  background: #fff;
}

.word-row.selected {
  border-color: var(--accent);
  background: rgba(37, 99, 235, 0.08);
}

.word-row input {
  accent-color: var(--accent);
  flex-shrink: 0;
}

.w-word {
  flex-shrink: 0;
  width: 108px;
  font-weight: 700;
  color: var(--text-dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.w-phon {
  flex-shrink: 0;
  width: 104px;
  font-family: monospace;
  font-size: 0.68rem;
  color: #7a8fab;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.w-mean {
  flex: 1;
  min-width: 0;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.w-status {
  flex-shrink: 0;
  font-size: 0.62rem;
  padding: 1px 6px;
  border-radius: 8px;
}

.w-status.new { color: #8d9bb5; background: rgba(140, 160, 190, 0.12); }
.w-status.learning { color: #b9772a; background: rgba(232, 162, 60, 0.14); }
.w-status.familiar { color: #2563eb; background: rgba(96, 165, 250, 0.16); }
.w-status.mastered { color: #248a57; background: rgba(52, 168, 108, 0.14); }

.more-btn {
  width: 100%;
  margin-top: 0.6rem;
}

.list-hint {
  margin-top: 0.6rem;
  font-size: 0.68rem;
  line-height: 1.6;
  color: #9aa8c0;
}

@media (max-width: 560px) {
  .w-phon {
    display: none;
  }
  .w-word {
    width: 84px;
  }
}

/* ===== 拖拽导入遮罩 ===== */
.drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border-radius: var(--card-radius);
  background: rgba(235, 244, 255, 0.92);
  backdrop-filter: blur(4px);
  border: 2px dashed var(--accent);
  pointer-events: none;
  animation: fadeIn 0.2s ease-out;
}

.drop-icon {
  font-size: 2.6rem;
}

.drop-overlay p {
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent);
}

.drop-overlay span {
  font-size: 0.76rem;
  color: var(--text-dim);
}

.loading {
  text-align: center;
  color: #8d9bb5;
  font-size: 0.85rem;
  padding: 3rem 0;
}

/* ===== 空状态 ===== */
.empty-state {
  text-align: center;
  padding: 2rem 0 1rem;
}

.empty-icon {
  font-size: 2.6rem;
}

.empty-state h3 {
  margin: 0.6rem 0 0.3rem;
  color: var(--text-dark);
}

.empty-state p {
  font-size: 0.78rem;
  color: var(--text-dim);
  line-height: 1.7;
}

.empty-hint {
  margin-top: 0.8rem;
  color: #9aa8c0 !important;
}

/* ===== 词书选择 ===== */
.lib-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.lib-head-title {
  font-size: 1.02rem;
  font-weight: 700;
  color: var(--text-dark);
}

.lib-head-sub {
  margin-top: 2px;
  font-size: 0.7rem;
  color: var(--text-dim);
}

.empty-mini {
  margin-bottom: 0.9rem;
  padding: 0.8rem 1rem;
  font-size: 0.78rem;
  color: var(--text-dim);
  background: rgba(219, 234, 254, 0.45);
  border: 1px dashed rgba(37, 99, 235, 0.25);
  border-radius: 12px;
}

.lib-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.7rem;
}

.lib-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.9rem;
  text-align: left;
  background: rgba(245, 249, 255, 0.78);
  border: 1px solid rgba(37, 99, 235, 0.14);
  border-radius: 16px;
  transition: 0.22s;
}

.lib-card:hover {
  transform: translateY(-3px);
  border-color: var(--accent);
  background: rgba(37, 99, 235, 0.08);
  box-shadow: 0 10px 22px -12px rgba(30, 60, 110, 0.35);
}

.lib-cover {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #60a5fa, #2563eb);
  box-shadow: 0 5px 14px -6px rgba(37, 99, 235, 0.6);
}

.lib-info {
  min-width: 0;
}

.lib-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lib-meta {
  margin-top: 2px;
  font-size: 0.68rem;
  color: var(--text-dim);
}

.add-card {
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  border-style: dashed;
  background: transparent;
  color: var(--accent);
}

.add-icon {
  font-size: 1.3rem;
  line-height: 1;
}

.add-text {
  font-size: 0.75rem;
  font-weight: 600;
}

/* ===== 学习页顶部 ===== */
.study-top {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.9rem;
}

.back-btn {
  flex-shrink: 0;
  padding: 0.35rem 0.8rem;
  font-size: 0.76rem;
  color: var(--accent);
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 20px;
  transition: 0.2s;
}

.back-btn:hover {
  background: var(--accent);
  color: #fff;
}

.study-lib-name {
  flex: 1;
  min-width: 0;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== 顶部工具栏 ===== */
.toolbar {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.9rem;
}

.lib-select {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 0.7rem;
  font-family: inherit;
  font-size: 0.82rem;
  color: var(--text-dark);
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 10px;
  outline: none;
}

.ghost-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0.5rem 0.8rem;
  font-size: 0.78rem;
  color: var(--accent);
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 10px;
  transition: 0.2s;
  white-space: nowrap;
}

.ghost-btn:hover {
  background: var(--accent);
  color: #fff;
}

.ghost-btn.danger:hover {
  background: #e15b5b;
  border-color: #e15b5b;
}

.ghost-btn.small {
  padding: 0.35rem 0.7rem;
  font-size: 0.72rem;
}

/* ===== 今日进度 ===== */
.today-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin-bottom: 1.2rem;
}

.today-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0.5rem 0.3rem;
  background: rgba(219, 234, 254, 0.55);
  border: 1px solid rgba(37, 99, 235, 0.14);
  border-radius: 12px;
}

.today-label {
  font-size: 0.66rem;
  color: var(--text-dim);
}

.today-num {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--accent);
}

/* ===== 单词卡 ===== */
.study {
  margin-bottom: 1.2rem;
}

.card-wrap {
  perspective: 1400px;
  margin-bottom: 1rem;
}

.flashcard {
  position: relative;
  width: 100%;
  height: 290px;
  transform-style: preserve-3d;
  transition: transform 0.55s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: pointer;
}

.flashcard.flipped {
  transform: rotateY(180deg);
}

.face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 22px;
  padding: 1.2rem 1.4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  overflow: hidden;
}

.front {
  background: linear-gradient(150deg, #eaf2ff 0%, #d7e6fb 55%, #c7dcfa 100%);
  border: 1px solid rgba(37, 99, 235, 0.22);
  box-shadow: 0 16px 34px -18px rgba(30, 60, 110, 0.4);
}

.front::before {
  content: '';
  position: absolute;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(96, 165, 250, 0.28), transparent 70%);
  top: -70px;
  right: -60px;
}

.back {
  transform: rotateY(180deg);
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(37, 99, 235, 0.18);
  box-shadow: 0 16px 34px -18px rgba(30, 60, 110, 0.35);
  justify-content: flex-start;
  padding-top: 1.6rem;
  overflow-y: auto;
}

.card-index {
  position: absolute;
  top: 0.85rem;
  left: 1.2rem;
  font-size: 0.68rem;
  font-family: monospace;
  color: var(--accent);
  opacity: 0.75;
}

.word {
  font-size: 2.4rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: #16305c;
  word-break: break-word;
}

.phonetic {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  margin-top: 0.5rem;
  font-family: 'Segoe UI', 'Lucida Sans Unicode', 'Arial Unicode MS', monospace;
  font-size: 0.95rem;
  line-height: 1.5;
  color: #4a6a8f;
}

.phonetic-text {
  text-align: center;
  letter-spacing: 0.02em;
}

/* 与按钮同宽的空白占位，保证音标水平居中 */
.speak-spacer {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
}

.speak-btn {
  flex-shrink: 0;
  border: none;
  background: rgba(37, 99, 235, 0.1);
  border-radius: 50%;
  width: 30px;
  height: 30px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: 0.2s;
}

.speak-btn:hover {
  background: rgba(37, 99, 235, 0.22);
}

.flip-hint {
  position: absolute;
  bottom: 0.9rem;
  font-size: 0.66rem;
  color: #7a8fab;
}

.meaning {
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.7;
  color: var(--text-dark);
  margin-bottom: 0.9rem;
}

.example {
  padding: 0.7rem 0.9rem;
  border-radius: 12px;
  background: rgba(37, 99, 235, 0.06);
  border-left: 3px solid var(--accent-light);
  text-align: left;
  max-width: 100%;
}

.ex-en {
  font-size: 0.82rem;
  color: var(--text-dark);
  line-height: 1.6;
}

.ex-cn {
  margin-top: 0.2rem;
  font-size: 0.75rem;
  color: var(--text-dim);
  line-height: 1.6;
}

.phrases {
  margin-top: 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  width: 100%;
  text-align: left;
}

.phrase {
  display: flex;
  gap: 0.5rem;
  font-size: 0.74rem;
  line-height: 1.5;
  flex-wrap: wrap;
}

.ph-en {
  color: var(--text-dark);
  font-weight: 600;
}

.ph-cn {
  color: var(--text-dim);
}

/* ===== 评分 ===== */
.grades {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.55rem;
}

.grade {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0.55rem 0.3rem;
  border-radius: 12px;
  border: 1px solid transparent;
  color: #fff;
  transition: 0.2s;
  font-family: inherit;
}

.grade.again { background: #e15b5b; }
.grade.hard { background: #e8a23c; }
.grade.good { background: #3b82f6; }
.grade.easy { background: #34a86c; }

.grade:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px -8px rgba(30, 60, 110, 0.4);
}

.grade.dim {
  opacity: 0.35;
}

.grade:disabled {
  cursor: default;
}

.grade-label {
  font-size: 0.8rem;
  font-weight: 700;
}

.grade-key {
  font-size: 0.6rem;
  opacity: 0.75;
  font-family: monospace;
}

.hint {
  margin-top: 0.6rem;
  text-align: center;
  font-size: 0.66rem;
  color: #9aa8c0;
}

/* ===== 完成态 ===== */
.done-state {
  text-align: center;
  padding: 2.2rem 0 1.6rem;
}

.done-icon {
  font-size: 2.6rem;
}

.done-state h3 {
  margin: 0.5rem 0 0.3rem;
  color: var(--text-dark);
}

.done-state p {
  font-size: 0.8rem;
  color: var(--text-dim);
}

.done-actions {
  margin-top: 1rem;
}

.done-hint {
  margin-top: 0.7rem;
  color: var(--accent) !important;
}

/* ===== 掌握度 ===== */
.mastery {
  margin-top: 0.4rem;
  padding-top: 1rem;
  border-top: 1px dashed rgba(37, 99, 235, 0.16);
}

.mastery-head {
  display: flex;
  justify-content: space-between;
  font-size: 0.74rem;
  color: var(--text-dim);
  margin-bottom: 0.45rem;
}

.mastery-total {
  font-family: monospace;
}

.mastery-bar {
  display: flex;
  height: 9px;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(37, 99, 235, 0.08);
}

.seg {
  display: block;
  height: 100%;
  transition: width 0.4s ease;
}

.seg.fresh { background: #c9d6ea; }
.seg.learning { background: #e8a23c; }
.seg.familiar { background: #60a5fa; }
.seg.mastered { background: #34a86c; }

.mastery-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
  margin-top: 0.5rem;
  font-size: 0.68rem;
  color: var(--text-dim);
}

.mastery-legend span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}

.dot.fresh { background: #c9d6ea; }
.dot.learning { background: #e8a23c; }
.dot.familiar { background: #60a5fa; }
.dot.mastered { background: #34a86c; }

/* ===== 设置 ===== */
.settings {
  margin-top: 0.9rem;
}

.settings-toggle {
  font-size: 0.72rem;
  color: var(--text-dim);
  background: none;
  border: none;
  padding: 0.2rem 0;
}

.settings-toggle:hover {
  color: var(--accent);
}

.settings-body {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem 1.2rem;
  margin-top: 0.6rem;
  padding: 0.8rem;
  border-radius: 12px;
  background: rgba(219, 234, 254, 0.5);
  border: 1px solid rgba(37, 99, 235, 0.12);
}

.set-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.74rem;
  color: var(--text-dim);
}

.set-item input[type='number'] {
  width: 64px;
  padding: 0.25rem 0.4rem;
  font-family: inherit;
  font-size: 0.75rem;
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 7px;
  outline: none;
  background: #fff;
}

.phonetic-menu {
  width: 118px;
}

.set-item.checkbox input {
  accent-color: var(--accent);
}

/* ===== 学习数据导出 ===== */
.export-row {
  margin-top: 0.9rem;
}

/* ===== 导入面板 ===== */
.import-panel {
  margin-top: 1.2rem;
  padding: 1rem 1.1rem;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(37, 99, 235, 0.22);
  box-shadow: 0 10px 24px -16px rgba(30, 60, 110, 0.4);
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.import-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.import-head strong {
  font-size: 0.9rem;
  color: var(--text-dark);
}

.import-head .x {
  border: none;
  background: none;
  font-size: 1.2rem;
  color: #9aa8c0;
  line-height: 1;
}

.import-desc {
  margin: 0.5rem 0 0.8rem;
  font-size: 0.74rem;
  line-height: 1.7;
  color: var(--text-dim);
}

.import-desc code {
  font-family: monospace;
  padding: 1px 4px;
  border-radius: 4px;
  background: rgba(37, 99, 235, 0.08);
  color: var(--accent);
}

.file-input {
  font-size: 0.76rem;
  color: var(--text-dim);
}

/* ===== 导入进度条 ===== */
.import-progress {
  margin-top: 0.8rem;
}

.ip-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.76rem;
  color: var(--accent);
  margin-bottom: 5px;
}

.ip-pct {
  font-family: monospace;
  font-weight: 700;
}

.ip-track {
  height: 7px;
  border-radius: 5px;
  background: rgba(37, 99, 235, 0.12);
  overflow: hidden;
}

.ip-fill {
  height: 100%;
  border-radius: 5px;
  background: linear-gradient(90deg, #60a5fa, #2563eb);
  box-shadow: 0 0 8px rgba(37, 99, 235, 0.45);
  transition: width 0.18s ease-out;
}

.parse-error {
  margin-top: 0.6rem;
  font-size: 0.76rem;
  color: #d64545;
}

.preview {
  margin-top: 0.8rem;
}

.preview-count {
  font-size: 0.78rem;
  color: var(--text-dark);
}

.preview-count strong {
  color: var(--accent);
  font-size: 0.95rem;
}

.preview-list {
  margin: 0.5rem 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.preview-item {
  display: flex;
  gap: 0.6rem;
  font-size: 0.72rem;
  padding: 0.3rem 0.5rem;
  border-radius: 7px;
  background: rgba(219, 234, 254, 0.5);
}

.pv-word {
  font-weight: 700;
  color: var(--text-dark);
  flex-shrink: 0;
}

.pv-mean {
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.76rem;
  color: var(--text-dim);
  margin-bottom: 0.7rem;
}

.name-input {
  flex: 1;
  padding: 0.4rem 0.6rem;
  font-family: inherit;
  font-size: 0.78rem;
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 8px;
  outline: none;
}

.import-tip {
  margin-top: 0.8rem;
  font-size: 0.68rem;
  color: #9aa8c0;
  line-height: 1.6;
}

/* ===== 按钮 ===== */
.primary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0.55rem 1.2rem;
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #1d4ed8, #2563eb);
  border: none;
  border-radius: 10px;
  transition: 0.2s;
}

.primary-btn:hover:not(:disabled) {
  box-shadow: 0 6px 16px -4px rgba(37, 99, 235, 0.55);
  transform: translateY(-1px);
}

.primary-btn:disabled {
  opacity: 0.5;
}

.primary-btn.full {
  width: 100%;
}

/* ===== 响应式 ===== */
@media (max-width: 560px) {
  .vocab-card {
    padding: 1rem;
  }
  .today-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .flashcard {
    height: 250px;
  }
  .word {
    font-size: 1.9rem;
  }
  .grades {
    grid-template-columns: repeat(4, 1fr);
    gap: 0.35rem;
  }
  .grade-label {
    font-size: 0.72rem;
  }
}
</style>
